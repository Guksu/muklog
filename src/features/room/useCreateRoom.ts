// src/features/room/useCreateRoom.ts
// 방 만들기 훅 (plan §3.6, C1).
//
// 생산자: create_room() RPC → jsonb { room_id, invite_code } (snake_case).
// 소비자: OnboardingScreen(choose → create-result). 반환은 camelCase로 매핑.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';

export type CreateRoomResult = { roomId: string; inviteCode: string };

/**
 * 방 생성 액션과 로딩/에러 상태를 제공하는 훅.
 * createRoom() 호출 시 create_room RPC를 수행하고 { roomId, inviteCode }를 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 */
export const useCreateRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async (): Promise<CreateRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_room');
      if (rpcError) throw rpcError;

      // rpc는 jsonb 객체(배열 아님) 반환 → snake_case 필드.
      const obj = (data ?? {}) as { room_id?: string; invite_code?: string };
      if (!obj.room_id || !obj.invite_code) {
        throw new Error('CREATE_ROOM_BAD_RESPONSE');
      }
      return { roomId: obj.room_id, inviteCode: obj.invite_code };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRoom, loading, error };
};
