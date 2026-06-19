// src/features/room/useMyLogs.ts
// 내 로그 목록 조회 훅 (plan §3.5, C1·C9). useMembership(단일 maybeSingle)을 대체한다.
//
// 생산자: list_my_rooms() DEFINER RPC → rows(snake) [{ room_id, mode, member_count, created_at, joined_at }].
//   member_count는 DEFINER로 전 멤버 집계(RLS 우회) → 솔로/커플 파생 가능(C2).
// 소비자: MyLogsProvider → LogListScreen(목록/빈상태/에러) + PlusHeaderButton(생성 성공 후 refresh).
//
// 정책: 앱 진입(Provider 마운트) 1회 조회 + 성공 후 refresh()만. 폴링/주기 조회 금지(비용 가드레일 §8,
//   기존 useMembership "진입 1회 + 성공 후 refresh" 정책 계승). refresh는 의도적으로 loading으로 되돌리지 않는다.
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { type RoomMode } from './modes';

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
});

/**
 * 현재 사용자가 속한 로그 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useMyLogs = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<MyLogsState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [userId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchMyLogs = async () => {
    // 무인자 RPC. 행 집합 반환(0행=빈 목록=정상).
    const { data, error } = await supabase.rpc('list_my_rooms');

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    const rows = (data ?? []) as MyLogRow[];
    setState({ status: 'ready', logs: rows.map((row) => toMyLog({ row })) });
  };

  useEffect(
    function loadMyLogsOnUser() {
      mountedRef.current = true;
      // 진입 1회(또는 userId 변경 시) 조회. fetchMyLogs는 최신 렌더 클로저를 사용한다.
      void fetchMyLogs();
      return function cleanupMyLogs() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId 변경 시에만 재조회(폴링 방지). fetchMyLogs 의존 시 매 렌더 재조회됨.
    [userId],
  );

  return { state, refresh: fetchMyLogs };
};
