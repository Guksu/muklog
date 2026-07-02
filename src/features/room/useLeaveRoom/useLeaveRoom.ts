// src/features/room/useLeaveRoom.ts
// 로그 나가기 훅 — 유예 예약(커플)/즉시 삭제(솔로) 모델 (plan §3.2·§3.6·§5 T5, C-LEAVE).
//
// 생산자: leave_room(p_room_id uuid) RPC(SECURITY DEFINER) → jsonb (snake_case):
//   { scheduled, room_deleted, delete_scheduled_at, room_id }.
//   - 커플(2명): scheduled=true, room_deleted=false, delete_scheduled_at=now+24h, room_id=대상.
//   - 솔로(1명): scheduled=false, room_deleted=true, delete_scheduled_at=null, room_id=대상.
//   - 멤버 아님(멱등): 모두 false/null.
// 소비자: LogScreen 나가기 확인 → 성공 시 scheduled면 refresh(배너 표시)·roomDeleted면 goBack.
// ⚠️ C-LEAVE: 인자명 p_room_id는 RPC 시그니처와 정확히 일치해야 한다(어느 로그를 나갈지 명시).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from '../errors';

export type LeaveRoomResult = {
  scheduled: boolean; // 커플 유예 예약됨(24h 뒤 삭제)
  roomDeleted: boolean; // 솔로/0명 → 즉시 삭제됨
  deleteScheduledAt: string | null; // 예약 시각(ISO) | null
  roomId: string | null; // 대상 로그 id | null(멤버 아님)
};

/**
 * 로그 나가기 액션과 로딩/에러 상태를 제공하는 훅.
 * leaveRoom({ roomId }) 호출 시 leave_room(p_room_id) RPC를 수행하고 유예/삭제 결과를 매핑해 반환한다.
 * 멤버가 아니어도(이미 나간 상태) 멱등 성공(scheduled:false, roomDeleted:false, roomId:null)으로 반환한다.
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

      const obj = (data ?? {}) as {
        scheduled?: unknown;
        room_deleted?: unknown;
        delete_scheduled_at?: unknown;
        room_id?: unknown;
      };
      // scheduled·room_deleted는 필수 boolean(둘 중 하나라도 누락/비-boolean이면 bad shape).
      if (typeof obj.scheduled !== 'boolean' || typeof obj.room_deleted !== 'boolean') {
        throw new Error('LEAVE_ROOM_BAD_RESPONSE');
      }
      // 반환 roomId는 응답값에서 파생(매개변수 roomId와 이름 충돌 회피 위해 별도 변수명 사용).
      const leftRoomId = typeof obj.room_id === 'string' ? obj.room_id : null;
      const scheduledAt = typeof obj.delete_scheduled_at === 'string' ? obj.delete_scheduled_at : null;
      return {
        scheduled: obj.scheduled,
        roomDeleted: obj.room_deleted,
        deleteScheduledAt: scheduledAt,
        roomId: leftRoomId,
      };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { leaveRoom, loading, error };
};
