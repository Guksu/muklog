// src/features/muklog/useMuklog.ts
// 단일 먹로그 + 전체 사진 조회 훅 (plan §3.3 / §6 ②, 경계면 §8). 상세 화면(읽기 전용)의 데이터 계층.
//
// 생산자: 클라 직접 select(RLS 하, RPC 아님) — from('muklogs').select(컬럼 + muklog_photos 임베드)
//   .eq('id', muklogId).maybeSingle(). RLS(`room_id IN 내 방`)가 권한 차단 → 타 방/삭제 = 0행 = null.
//   사진: 임베드 (storage_path, order_index)를 order_index 오름차순 정렬 후 path[]를
//   createSignedUrls(paths, 3600)로 1회 배치 발급(개별 N회 금지, §8) → photos[{orderIndex, uri}].
// 소비자: MuklogDetailScreen(컨테이너 경유) — state(loading/ready/notFound/error) + photos 캐러셀.
//
// 정책: 진입(muklogId 변경) 1회 조회 + 명시적 refresh()만. 폴링/Realtime 미도입(§3.5).
//   maybeSingle null → notFound(삭제/권한 차단을 권한 노출 없이 동일 처리, §3.2).
//   signed URL 부분/전체 실패는 해당 슬롯 제외(best-effort) — 사진 때문에 화면을 막지 않는다(§7 엣지).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { MUKLOG_PHOTOS_BUCKET } from './photoPath';

const SIGNED_URL_TTL_SECONDS = 3600; // signed URL 만료 1h (plan §3.5)

// 상세가 소비하는 컬럼 + 전체 사진 임베드(order_index, storage_path). 매핑/정렬 단일 출처.
const MUKLOG_DETAIL_SELECT_COLUMNS =
  'id, room_id, place_name, category, area, memo, rating, visited_at, lat, lng, address, road_address, kakao_place_id, created_by, created_at, muklog_photos(storage_path, order_index)';

// ── 반환 shape (camelCase — 매핑 단일 출처, plan §3.3) ─────────────────────────────
/**
 * 캐러셀 사진 1장 — order_index 오름차순. uri = signed URL(TTL 3600s).
 * storagePath는 같은 임베드 행에서 함께 zip(편집 reconcile 키 — 인덱스 산술 없이 매핑).
 *   ⚠️ order_index 갭(reindex 실패 등)에도 안전: photos 항목이 자신의 storage_path를 직접 보유한다.
 */
export type MuklogDetailPhoto = { orderIndex: number; uri: string; storagePath: string };

/** 단일 먹로그 상세(camelCase). MuklogDetailScreen이 그대로 소비. */
export type MuklogDetail = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key(8종) | null
  area: string | null;
  memo: string | null; // null/빈문자 = 메모 없음
  rating: number | null; // 1~5, null = 미평가
  visitedAt: string | null; // 'YYYY-MM-DD'
  // place 필드(muklog-place) — 편집 좌표 보존(§7-6)·미니맵. lat/lng는 쌍(nullable, 수동입력 시 null).
  lat: number | null;
  lng: number | null;
  address: string | null; // 지번 주소
  roadAddress: string | null; // road_address
  kakaoPlaceId: string | null; // kakao_place_id(수동입력 시 null)
  hasCoords: boolean; // lat != null && lng != null → 미니맵(map-tab) 핀 여부
  createdBy: string | null; // uuid | null(탈퇴자 익명화 — ON DELETE SET NULL, plan §1·§5)
  createdAt: string; // ISO
  photos: MuklogDetailPhoto[]; // order_index 오름차순. [] = 사진 0장
  // 삭제용 storage_path 전체(order_index 오름차순). 임베드에서 매핑 — 추가 쿼리 0(plan §3.6 e).
  //   signed URL 발급 성공/실패와 무관하게 항상 채운다(삭제는 path만 필요, photos와 분리).
  photoStoragePaths: string[];
};

export type MuklogDetailState =
  | { status: 'loading' }
  | { status: 'ready'; muklog: MuklogDetail }
  | { status: 'notFound' } // 0행(삭제됨/타 방 권한 차단) — "찾을 수 없어요" 화면
  | { status: 'error'; message: string };

// 임베드 사진 메타(snake_case). order 정렬 + signed URL 발급에만 사용.
type MuklogPhotoEmbed = { storage_path: string; order_index: number };

// 조회 행 형태(snake_case). 매핑 경계의 단일 출처.
type MuklogDetailRow = {
  id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  memo: string | null;
  rating: number | null;
  visited_at: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  road_address: string | null;
  kakao_place_id: string | null;
  created_by: string | null; // 탈퇴자 익명화 시 NULL(ON DELETE SET NULL)
  created_at: string;
  muklog_photos?: MuklogPhotoEmbed[] | null;
};

/**
 * 사진 path 목록의 signed URL을 1회 배치 발급해 path→URL 맵을 만든다(비용 가드레일 §8).
 * 발급 실패/누락 path는 맵에서 빠져 해당 슬롯이 제외된다(화면은 막지 않는다).
 * @param paths order_index 오름차순 storage_path 목록(빈 값 제외)
 * @returns storage_path → signed URL 맵(빈 입력이면 빈 맵)
 */
const fetchPhotoSignedUrls = async ({
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
    // best-effort: 발급 실패는 해당 슬롯 제외(사진 때문에 화면을 막지 않는다).
  }
  return map;
};

/**
 * 조회 행(snake_case) + signed URL 맵을 MuklogDetail(camelCase)로 매핑한다.
 * 사진은 order_index 오름차순 정렬 후, URL이 발급된 슬롯만 photos에 포함한다(best-effort).
 * @param row maybeSingle이 반환한 단일 행(muklog_photos 임베드 포함)
 * @param signedMap storage_path → signed URL 맵
 * @returns 화면이 소비하는 MuklogDetail
 */
const toMuklogDetail = ({
  row,
  signedMap,
}: {
  row: MuklogDetailRow;
  signedMap: Record<string, string>;
}): MuklogDetail => {
  const embeds = row.muklog_photos ?? [];
  // order_index 오름차순 정렬은 한 번만 — photos(URL 발급분)와 photoStoragePaths(전체 path)가 공유.
  const orderedEmbeds = [...embeds].sort((a, b) => a.order_index - b.order_index);
  // 각 사진은 자신의 storage_path를 함께 보유(편집 reconcile 키). order_index 갭이 있어도 인덱스 산술 불필요.
  const photos: MuklogDetailPhoto[] = orderedEmbeds
    .map((p) => ({
      orderIndex: p.order_index,
      storagePath: p.storage_path,
      uri: signedMap[p.storage_path] ?? null,
    }))
    .filter((p): p is MuklogDetailPhoto => p.uri !== null);
  // 삭제용 전체 storage_path(URL 발급 실패와 무관) — useDeleteMuklog photoPaths로 소비.
  const photoStoragePaths = orderedEmbeds.map((p) => p.storage_path);

  return {
    id: row.id,
    roomId: row.room_id,
    placeName: row.place_name,
    category: row.category,
    area: row.area,
    memo: row.memo,
    rating: row.rating,
    visitedAt: row.visited_at,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    roadAddress: row.road_address,
    kakaoPlaceId: row.kakao_place_id,
    hasCoords: row.lat !== null && row.lng !== null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    photos,
    photoStoragePaths,
  };
};

/**
 * 단일 먹로그(muklogId)와 전체 사진을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param muklogId 조회할 먹로그 id — 변경 시에만 재조회(폴링 방지). 빈 문자열이면 0행 → notFound.
 * @returns state(상세 상태)와 refresh(재조회 함수)
 */
export const useMuklog = ({ muklogId }: { muklogId: string }) => {
  const [state, setState] = useState<MuklogDetailState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [muklogId]에만 의존하므로
  // 매 렌더 새 참조여도 재조회 루프가 생기지 않는다.
  const fetchMuklog = async () => {
    const { data, error } = await supabase
      .from('muklogs')
      .select(MUKLOG_DETAIL_SELECT_COLUMNS)
      .eq('id', muklogId)
      .maybeSingle();

    if (error) {
      if (!mountedRef.current) return;
      setState({ status: 'error', message: '먹로그를 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    // 0행(삭제됨/타 방 권한 차단) → notFound(권한 노출 없이 동일 처리, §3.2).
    if (!data) {
      if (!mountedRef.current) return;
      setState({ status: 'notFound' });
      return;
    }

    const row = data as MuklogDetailRow;

    // 사진 path를 order_index 오름차순으로 모아 1회 배치 signed URL 발급(개별 N회 금지, §8).
    const orderedPaths = [...(row.muklog_photos ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((p) => p.storage_path);
    const signedMap = await fetchPhotoSignedUrls({ paths: orderedPaths });

    if (!mountedRef.current) return;
    setState({ status: 'ready', muklog: toMuklogDetail({ row, signedMap }) });
  };

  useEffect(
    function loadMuklogOnId() {
      mountedRef.current = true;
      // 진입 1회(또는 muklogId 변경 시) 조회. fetchMuklog는 최신 렌더 클로저를 사용한다.
      void fetchMuklog();
      return function cleanupMuklog() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muklogId 변경 시에만 재조회(폴링 방지). fetchMuklog 의존 시 매 렌더 재조회됨.
    [muklogId],
  );

  return { state, refresh: fetchMuklog };
};
