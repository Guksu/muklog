// src/features/room/useMyLogs.ts
// 내 로그 목록 조회 훅 (plan §3.5, C1·C9). useMembership(단일 maybeSingle)을 대체한다.
//
// 생산자: list_my_rooms() DEFINER RPC → rows(snake) [{ room_id, mode, member_count, created_at, joined_at,
//   spot_count, last_muklog_at }]. member_count·spot_count·last_muklog_at은 DEFINER로 전 멤버 집계(RLS 우회).
//   solo/couple 파생(C2) + 카드 통계행(맛집 수·마지막 기록, home-fidelity).
// 소비자: MyLogsProvider → LogListScreen(목록/빈상태/에러) + PlusHeaderButton(생성 성공 후 refresh).
//
// 정책: 앱 진입(Provider 마운트) 1회 조회 + 성공 후 refresh()만. 폴링/주기 조회 금지(비용 가드레일 §8).
//   로딩/에러/캐시/refresh 는 useCachedQuery 가 소유(진입 1회 + 명시적 refresh).
//
// 캐시(query-cache T4): 키가 ['myLogs', userId]라 같은 사용자의 두 관찰자(MyLogsProvider·ProfileScreen)가
//   조회 1회를 공유한다 → list_my_rooms RPC가 1회 줄고, 프로필 통계가 로딩 없이 즉시 뜬다(AC4-2).
//   계정이 바뀌면 키가 달라져 이전 사용자의 목록이 새 계정 화면으로 새지 않는다(E1).
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useCachedQuery } from '@/lib/useCachedQuery';

import { type RoomMode } from '../modes';

/** 내가 속한 로그 1건. mode는 레거시(표시 배지는 memberCount에서 파생 — plan 함정3). */
export type MyLog = {
  roomId: string;
  mode: RoomMode;
  memberCount: number; // 1=혼자 / 2=둘이 (DEFINER 집계)
  createdAt: string; // ISO
  joinedAt: string; // ISO
  name: string | null; // 사용자 지정 로그 이름(null=미지정 → 카드에서 폴백 표기, log-name)
  deleteScheduledAt: string | null; // 예약 삭제 시각(ISO) | null. LogList 배지 후속 대비 투영(이번 표시 OUT, room-lifecycle).
  deleteRequestedBy: string | null; // 나가기를 요청한 사용자 id | null.
  previewPaths: string[]; // 카드 썸네일용 최근 사진 경로 최대 4장(storage_path). signed URL은 useLogPreviewUrls가 발급.
  spotCount: number; // 로그의 맛집(muklog) 총 개수(DEFINER 집계). 카드 통계행·+N·홈 합계(home-fidelity). 레거시 RPC=0.
  lastMuklogAt: string | null; // 가장 최근 muklog 기록 시각(ISO) | null(기록 0 또는 레거시). 카드 "마지막 기록 N일 전".
};

export type MyLogsState =
  | { status: 'loading' }
  | { status: 'ready'; logs: MyLog[] } // logs:[] = 빈 상태(정상, 에러 아님)
  | { status: 'error'; message: string };

// RPC가 반환하는 행 형태(snake_case). 매핑 경계의 단일 출처.
type MyLogRow = {
  room_id: string;
  mode: RoomMode;
  member_count: number;
  created_at: string;
  joined_at: string;
  name?: string | null; // list_my_rooms name 투영(log-name). 누락/null 모두 null로 흡수.
  delete_scheduled_at?: string | null; // room-lifecycle 투영. 누락/null 모두 null로 흡수.
  delete_requested_by?: string | null; // room-lifecycle 투영. 동상.
  preview_paths?: string[] | null; // log_preview_photos 투영. 누락/null → [].
  spot_count?: number | null; // muklog 집계(home-fidelity). 누락/null → 0(레거시 RPC 안전 폴백).
  last_muklog_at?: string | null; // 최근 muklog 시각(home-fidelity). 누락/null → null.
};

/**
 * RPC 행(snake_case)을 MyLog(camelCase)로 매핑한다.
 * @param row list_my_rooms RPC가 반환한 단일 행
 * @returns 화면/카드가 소비하는 MyLog
 */
const toMyLog = ({ row }: { row: MyLogRow }): MyLog => ({
  roomId: row.room_id,
  mode: row.mode,
  memberCount: row.member_count,
  createdAt: row.created_at,
  joinedAt: row.joined_at,
  name: row.name ?? null,
  deleteScheduledAt: row.delete_scheduled_at ?? null,
  deleteRequestedBy: row.delete_requested_by ?? null,
  previewPaths: row.preview_paths ?? [],
  spotCount: row.spot_count ?? 0, // 누락/null → 0(레거시 RPC면 빈카드로 안전 폴백, 거짓 카운트 0).
  lastMuklogAt: row.last_muklog_at ?? null,
});

/**
 * 현재 사용자가 속한 로그 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useMyLogs = ({ userId }: { userId: string }): {
  state: MyLogsState;
  refresh: () => Promise<void>;
} => {
  // 쿼리+매핑만 정의 — 로딩/에러/캐시/refresh 는 useCachedQuery 가 소유.
  const fetchMyLogs = async (): Promise<{ logs: MyLog[] }> => {
    // 무인자 RPC. 행 집합 반환(0행=빈 목록=정상).
    const { data, error } = await supabase.rpc('list_my_rooms');
    if (error) throw error;

    const rows = (data ?? []) as MyLogRow[];
    return { logs: rows.map((row) => toMyLog({ row })) };
  };

  return useCachedQuery<{ logs: MyLog[] }>({
    queryKey: queryKeys.myLogs({ userId }),
    queryFn: fetchMyLogs,
    mapError: () => '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.',
  });
};
