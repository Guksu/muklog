// src/features/muklog/useMuklogs.ts
// 한 로그(roomId)의 먹로그 목록 조회 훅 (plan §5.2·§3.5 / §5 ⑥, D3, AC1·AC6·AC11).
//
// 생산자: 클라 직접 select(RLS 하, RPC 아님) — from('muklogs').select(컬럼 + muklog_photos 임베드)
//   .eq('room_id', roomId).order('visited_at', desc).order('created_at', desc). RLS(`room_id IN 내 방`)가 방 격리.
//   카드용 대표 사진 1장(order_index 최소)의 storage_path를 createSignedUrls로 1회 배치 발급(만료 1h) → coverUri.
// 소비자: MuklogList → MuklogCard(coverUri 있으면 Image, 없으면 FoodCover 폴백 + photoCount 배지).
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()(저장 후 호출)만. 폴링/Realtime 미도입(비용 가드레일 §8).
//   signed URL은 목록의 대표 path만 1회 배치 발급(개별 N회 호출 금지, §8). 발급 실패는 coverUri null로 폴백(목록은 유지).
//   임베드는 대표 path 추출용 (storage_path, order_index)만 — 전체 5장 바이너리 미조회(전송량 절감 §8).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { MUKLOG_PHOTOS_BUCKET } from './photoPath';
import { type Muklog, type MuklogsState } from './types';

const SIGNED_URL_TTL_SECONDS = 3600; // signed URL 만료 1h (plan §3.5)

// 카드가 소비하는 컬럼 + muklog_photos 임베드(대표 추출용 메타만). 정렬/매핑 단일 출처.
const MUKLOG_SELECT_COLUMNS =
  'id, room_id, place_name, category, area, memo, rating, visited_at, created_by, created_at, muklog_photos(storage_path, order_index)';

// 임베드된 사진 메타(snake_case). 대표 1장 추출 + 개수에만 사용.
type MuklogPhotoEmbed = { storage_path: string; order_index: number };

// 조회 행 형태(snake_case). 매핑 경계의 단일 출처.
type MuklogRow = {
  id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  memo: string | null;
  rating: number | null;
  visited_at: string | null;
  created_by: string;
  created_at: string;
  muklog_photos?: MuklogPhotoEmbed[] | null;
};

// 매핑 1단계 결과 — coverPath(대표 storage_path)는 아직 signed URL로 치환 전.
type MuklogWithCoverPath = Muklog & { coverPath: string | null };

/**
 * 임베드 사진 배열에서 대표(order_index 최소) storage_path를 고른다.
 * @param photos 임베드된 사진 메타 배열(없으면 빈 배열)
 * @returns 대표 storage_path, 사진이 없으면 null
 */
const pickCoverPath = ({ photos }: { photos: MuklogPhotoEmbed[] }): string | null => {
  if (photos.length === 0) return null;
  const cover = photos.reduce((min, p) => (p.order_index < min.order_index ? p : min));
  return cover.storage_path;
};

/**
 * 조회 행(snake_case)을 Muklog(camelCase) + coverPath로 매핑한다(signed URL 치환 전 1단계).
 * @param row muklogs select가 반환한 단일 행(muklog_photos 임베드 포함)
 * @returns 카드가 소비하는 Muklog + 대표 storage_path(coverPath)
 */
const toMuklogWithCoverPath = ({ row }: { row: MuklogRow }): MuklogWithCoverPath => {
  const photos = row.muklog_photos ?? [];
  return {
    id: row.id,
    roomId: row.room_id,
    placeName: row.place_name,
    category: row.category,
    area: row.area,
    memo: row.memo,
    rating: row.rating,
    visitedAt: row.visited_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    photoCount: photos.length,
    coverUri: null, // 2단계(배치 signed URL)에서 채움
    coverPath: pickCoverPath({ photos }),
  };
};

/**
 * 대표 path 목록의 signed URL을 1회 배치 발급해 path→URL 맵을 만든다(비용 가드레일 §8).
 * 발급 실패/누락 path는 맵에서 빠져 coverUri null로 폴백된다(목록은 막지 않음).
 * @param paths 대표 storage_path 목록(중복/빈 값 제외)
 * @returns storage_path → signed URL 맵(빈 입력이면 빈 맵)
 */
const fetchCoverSignedUrls = async ({
  paths,
}: {
  paths: string[];
}): Promise<Record<string, string>> => {
  if (paths.length === 0) return {};
  const map: Record<string, string> = {};
  try {
    const { data, error } = await supabase.storage
      .from(MUKLOG_PHOTOS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return map;
    for (const item of data) {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    }
  } catch {
    // best-effort: 발급 실패는 coverUri null 폴백(사진 때문에 목록을 막지 않는다).
  }
  return map;
};

/**
 * 한 로그(roomId)의 먹로그 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useMuklogs = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<MuklogsState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [roomId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchMuklogs = async () => {
    const { data, error } = await supabase
      .from('muklogs')
      .select(MUKLOG_SELECT_COLUMNS)
      .eq('room_id', roomId)
      .order('visited_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (!mountedRef.current) return;
      setState({ status: 'error', message: '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    const rows = (data ?? []) as MuklogRow[];
    const withCoverPath = rows.map((row) => toMuklogWithCoverPath({ row }));

    // 대표 path만 모아 1회 배치 signed URL 발급(개별 N회 금지, §8).
    const coverPaths = withCoverPath
      .map((m) => m.coverPath)
      .filter((p): p is string => p !== null);
    const signedMap = await fetchCoverSignedUrls({ paths: coverPaths });

    if (!mountedRef.current) return;

    const muklogs: Muklog[] = withCoverPath.map(({ coverPath, ...muklog }) => ({
      ...muklog,
      coverUri: coverPath ? (signedMap[coverPath] ?? null) : null,
    }));
    setState({ status: 'ready', muklogs });
  };

  useEffect(
    function loadMuklogsOnRoom() {
      mountedRef.current = true;
      // 진입 1회(또는 roomId 변경 시) 조회. fetchMuklogs는 최신 렌더 클로저를 사용한다.
      void fetchMuklogs();
      return function cleanupMuklogs() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roomId 변경 시에만 재조회(폴링 방지). fetchMuklogs 의존 시 매 렌더 재조회됨.
    [roomId],
  );

  return { state, refresh: fetchMuklogs };
};
