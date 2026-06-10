// src/features/room/useLeaveRoom.ts
// 방 나가기 훅 (plan §3.5·§5 T2, C1·C2·C-IDEM).
//
// 생산자: leave_room() RPC(무인자, SECURITY DEFINER) → jsonb { room_deleted, room_id } (snake_case).
//   room_deleted: 이번 호출로 방이 삭제됐는지(0명 true / 잔존 false / 멤버 아님 false).
//   room_id: 나간 방 id(멤버였으면) | null(멤버 아니었으면 — 멱등 성공).
// 소비자: ProfileScreen(나가기 확인 후). 성공 시 membership.refresh + navigation.reset(Onboarding).
// ⚠️ C2: leave_room은 무인자 RPC → rpc('leave_room')에 인자를 전달하지 않는다(오버로드 함정 방지).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';

export type LeaveRoomResult = { roomDeleted: boolean; roomId: string | null };

/**
 * 방 나가기 액션과 로딩/에러 상태를 제공하는 훅.
 * leaveRoom() 호출 시 leave_room RPC를 인자 없이 수행하고 { roomDeleted, roomId }를 반환한다.
 * 멤버가 아니어도(이미 나간 상태) 멱등 성공({ roomDeleted:false, roomId:null })으로 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 */
export const useLeaveRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leaveRoom = async (): Promise<LeaveRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      // 무인자 호출(auth.uid 기준 동작). 인자를 넘기지 않는다(C2).
      const { data, error: rpcError } = await supabase.rpc('leave_room');
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { room_deleted?: unknown; room_id?: unknown };
      // room_deleted는 필수 boolean. room_id는 string|null 허용(멱등 성공 시 null).
      if (typeof obj.room_deleted !== 'boolean') {
        throw new Error('LEAVE_ROOM_BAD_RESPONSE');
      }
      const roomId = typeof obj.room_id === 'string' ? obj.room_id : null;
      return { roomDeleted: obj.room_deleted, roomId };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { leaveRoom, loading, error };
};
