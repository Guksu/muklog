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
import { supabase } from '@/lib/supabase';
import { useOneShotQuery } from '@/lib/useOneShotQuery';

import { createSignedUrlMap } from '../signedUrlMap';
import { type Muklog, type MuklogsState } from '../types';

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
  created_by: string | null; // 탈퇴자 익명화 시 NULL(ON DELETE SET NULL)
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
 * 한 로그(roomId)의 먹로그 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useMuklogs = ({ roomId }: { roomId: string }): {
  state: MuklogsState;
  refresh: () => Promise<void>;
} => {
  // 쿼리 + 대표 사진 signed URL 매핑만 정의 — 로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유.
  const fetchMuklogs = async (): Promise<{ muklogs: Muklog[] }> => {
    const { data, error } = await supabase
      .from('muklogs')
      .select(MUKLOG_SELECT_COLUMNS)
      .eq('room_id', roomId)
      .order('visited_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as MuklogRow[];
    const withCoverPath = rows.map((row) => toMuklogWithCoverPath({ row }));

    // 대표 path만 모아 1회 배치 signed URL 발급(개별 N회 금지, §8).
    const coverPaths = withCoverPath
      .map((m) => m.coverPath)
      .filter((p): p is string => p !== null);
    const signedMap = await createSignedUrlMap({ paths: coverPaths });

    const muklogs: Muklog[] = withCoverPath.map(({ coverPath, ...muklog }) => ({
      ...muklog,
      coverUri: coverPath ? (signedMap[coverPath] ?? null) : null,
    }));
    return { muklogs };
  };

  return useOneShotQuery<{ muklogs: Muklog[] }>({
    deps: [roomId],
    fetch: fetchMuklogs,
    // 목록 조회 실패는 고정 카피(토큰 매핑 대상 아님).
    mapError: () => '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.',
  });
};
