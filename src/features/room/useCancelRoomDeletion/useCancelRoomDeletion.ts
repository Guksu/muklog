// src/features/room/useCancelRoomDeletion.ts
// 삭제 예약 취소 훅 (plan §3.3·§3.6·§5 T6, room-lifecycle).
//
// 생산자: cancel_room_deletion(p_room_id uuid) RPC(SECURITY DEFINER) → jsonb { canceled, room_id } (snake).
//   요청자(delete_requested_by == auth.uid())만 두 필드 NULL 복원. 타인 → NOT_DELETION_REQUESTER,
//   예약없음/방없음 → NOT_SCHEDULED.
// 소비자: LogScreen 예약삭제 배너의 "삭제 취소" 버튼(요청자에게만 노출) → 성공 시 refresh로 배너 사라짐.
// ⚠️ C-LEAVE: 인자명 p_room_id는 RPC 시그니처와 정확히 일치해야 한다.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from '../errors';

export type CancelRoomDeletionResult = { canceled: boolean; roomId: string | null };

/**
 * 삭제 예약 취소 액션과 로딩/에러 상태를 제공하는 훅.
 * cancelRoomDeletion({ roomId }) 호출 시 cancel_room_deletion(p_room_id) RPC를 수행하고 { canceled, roomId }를 반환한다.
 * 실패(요청자 아님/예약 없음/네트워크) 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 * @param roomId 삭제 예약을 취소할 로그(room)의 id
 */
export const useCancelRoomDeletion = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRoomDeletion = async ({
    roomId,
  }: {
    roomId: string;
  }): Promise<CancelRoomDeletionResult> => {
    setLoading(true);
    setError(null);
    try {
      // 인자명 p_room_id는 RPC 시그니처와 일치해야 한다(C-LEAVE).
      const { data, error: rpcError } = await supabase.rpc('cancel_room_deletion', {
        p_room_id: roomId,
      });
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { canceled?: unknown; room_id?: unknown };
      if (typeof obj.canceled !== 'boolean') {
        throw new Error('CANCEL_ROOM_DELETION_BAD_RESPONSE');
      }
      const canceledRoomId = typeof obj.room_id === 'string' ? obj.room_id : null;
      return { canceled: obj.canceled, roomId: canceledRoomId };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { cancelRoomDeletion, loading, error };
};
