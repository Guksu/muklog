// src/features/room/useLeaveRoom.ts
// 로그 나가기 훅 (plan §3.7-leave·§5 T3c, C-LEAVE).
//
// 생산자: leave_room(p_room_id uuid) RPC(SECURITY DEFINER) → jsonb { room_deleted, room_id } (snake_case).
//   room_deleted: 이번 호출로 로그가 삭제됐는지(0명 true / 잔존 false / 멤버 아님 false).
//   room_id: 나간 로그 id(멤버였으면) | null(멤버 아니었으면 — 멱등 성공).
// 소비자: ⚠️ 多로그 전환(multi-log-home)으로 이번 슬라이스엔 UI 호출부 없음(Profile 나가기 제거).
//   차기 LogScreen 로그별 나가기가 사용하도록 인자화(p_room_id)만 선반영(지뢰 제거).
// ⚠️ C-LEAVE: 인자명 p_room_id는 RPC 시그니처와 정확히 일치해야 한다(어느 로그를 나갈지 명시).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';

export type LeaveRoomResult = { roomDeleted: boolean; roomId: string | null };

/**
 * 로그 나가기 액션과 로딩/에러 상태를 제공하는 훅.
 * leaveRoom({ roomId }) 호출 시 leave_room(p_room_id) RPC를 수행하고 { roomDeleted, roomId }를 반환한다.
 * 멤버가 아니어도(이미 나간 상태) 멱등 성공({ roomDeleted:false, roomId:null })으로 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 * @param roomId 나갈 로그(room)의 id
 */
export const useLeaveRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leaveRoom = async ({ roomId }: { roomId: string }): Promise<LeaveRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      // 인자명 p_room_id는 RPC 시그니처와 일치해야 한다(C-LEAVE). 어느 로그를 나갈지 명시.
      const { data, error: rpcError } = await supabase.rpc('leave_room', { p_room_id: roomId });
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { room_deleted?: unknown; room_id?: unknown };
      // room_deleted는 필수 boolean. room_id는 string|null 허용(멱등 성공 시 null).
      if (typeof obj.room_deleted !== 'boolean') {
        throw new Error('LEAVE_ROOM_BAD_RESPONSE');
      }
      // 반환 roomId는 응답값에서 파생(매개변수 roomId와 이름 충돌 회피 위해 별도 변수명 사용).
      const leftRoomId = typeof obj.room_id === 'string' ? obj.room_id : null;
      return { roomDeleted: obj.room_deleted, roomId: leftRoomId };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { leaveRoom, loading, error };
};
