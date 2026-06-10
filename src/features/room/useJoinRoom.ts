// src/features/room/useJoinRoom.ts
// 방 입장 훅 (plan §3.6, C1·C2).
//
// 생산자: join_room(p_code) RPC → jsonb { room_id } (snake_case).
// 소비자: ⚠️ 이번 슬라이스 미사용(보존). 차기 log-invite의 로그 입장 UI가 사용. 토큰별 에러는 mapRoomError로 매핑.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';

export type JoinRoomResult = { roomId: string };

/**
 * 방 입장 액션과 로딩/에러 상태를 제공하는 훅.
 * joinRoom({ code }) 호출 시 join_room RPC를 수행하고 { roomId }를 반환한다.
 * 실패 시 error에 토큰별 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 */
export const useJoinRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinRoom = async ({ code }: { code: string }): Promise<JoinRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      // 인자명은 RPC 시그니처(p_code)와 일치해야 한다.
      const { data, error: rpcError } = await supabase.rpc('join_room', { p_code: code });
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { room_id?: string };
      if (!obj.room_id) {
        throw new Error('JOIN_ROOM_BAD_RESPONSE');
      }
      return { roomId: obj.room_id };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { joinRoom, loading, error };
};
