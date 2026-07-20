// src/features/room/useRoom.ts
// 단일 로그 상세 조회 훅 (plan §5.2, C1·C2·C3).
//
// 생산자: get_room(p_room_id) DEFINER RPC → jsonb { room_id, invite_code, member_count, mode } (snake).
//   member_count는 DEFINER로 전 멤버 집계(RLS 우회) → 솔로/커플 파생 가능. 본문 멤버십 검사 내장(C4-RLS).
// 소비자: LogScreen(초대코드 표시·복사 + 솔로/커플 분기).
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()만. 폴링/주기 조회·Realtime 미도입(비용 가드레일 §10).
//   useMyLogs의 "진입 1회 + refresh" 정책 계승. refresh는 의도적으로 loading으로 되돌리지 않는다.
import { supabase } from '@/lib/supabase';
import { useOneShotQuery } from '@/lib/useOneShotQuery';

import { mapRoomError } from '../errors';
import { type RoomMode } from '../modes';

/** 단일 로그 상세. 모두 get_room이 반환하는 단일 출처(클라 집계 아님). */
export type RoomDetail = {
  roomId: string;
  inviteCode: string;
  memberCount: number; // 1=혼자 / 2=둘이 (DEFINER 집계)
  mode: RoomMode;
  name: string | null; // 사용자 지정 로그 이름(null=미지정 → 헤더에서 폴백 표기, log-name)
  deleteScheduledAt: string | null; // 예약 삭제 시각(ISO) | null=예약 없음 (room-lifecycle)
  deleteRequestedBy: string | null; // 나가기를 요청한 사용자 id | null. meId와 비교해 취소권 판정.
};

export type RoomDetailState =
  | { status: 'loading' }
  | { status: 'ready'; room: RoomDetail }
  | { status: 'error'; message: string };

// RPC가 반환하는 형태(snake_case). 매핑 경계의 단일 출처.
type RoomRow = {
  room_id?: string;
  invite_code?: string;
  member_count?: number;
  mode?: RoomMode;
  name?: string | null; // get_room name 키(log-name). nullable — 누락 검사에 포함하지 않음(누락=정상).
  delete_scheduled_at?: string | null; // room-lifecycle 투영. nullable — 누락/null 모두 null로 흡수.
  delete_requested_by?: string | null; // room-lifecycle 투영. nullable — 동상.
};

/**
 * 단일 로그(roomId)의 상세를 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(상세 상태)와 refresh(재조회 함수)
 */
export const useRoom = ({ roomId }: { roomId: string }): {
  state: RoomDetailState;
  refresh: () => Promise<void>;
} => {
  // 쿼리+매핑만 정의 — 로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유(진입 1회 + 명시적 refresh).
  const fetchRoom = async (): Promise<{ room: RoomDetail }> => {
    // 인자명은 RPC 시그니처(p_room_id)와 일치해야 한다(C3).
    const { data, error } = await supabase.rpc('get_room', { p_room_id: roomId });
    if (error) throw error;

    const row = (data ?? {}) as RoomRow;
    // ⚠️ name은 누락 검사에 포함하지 않는다(nullable → 누락/null=정상, BAD_RESPONSE로 오판 금지, C4).
    if (!row.room_id || !row.invite_code || row.member_count == null || !row.mode) {
      throw new Error('GET_ROOM_BAD_RESPONSE'); // 토큰 미일치라 mapRoomError가 기본 메시지로 흡수.
    }

    return {
      room: {
        roomId: row.room_id,
        inviteCode: row.invite_code,
        memberCount: row.member_count,
        mode: row.mode,
        name: row.name ?? null,
        deleteScheduledAt: row.delete_scheduled_at ?? null,
        deleteRequestedBy: row.delete_requested_by ?? null,
      },
    };
  };

  return useOneShotQuery<{ room: RoomDetail }>({
    deps: [roomId],
    fetch: fetchRoom,
    mapError: (error) => mapRoomError({ error }),
  });
};
