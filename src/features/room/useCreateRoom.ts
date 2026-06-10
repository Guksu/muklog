// src/features/room/useCreateRoom.ts
// 방 만들기 훅 (plan §3.6, C1·C3).
//
// 생산자: create_room(p_mode) RPC → jsonb { room_id, invite_code, mode } (snake_case).
// 소비자: OnboardingScreen(select-mode → solo: 즉시 RoomTabs / couple: create-result).
// ⚠️ C3: rpc 인자명은 RPC 시그니처(p_mode)와 정확히 일치해야 한다.
//    오타 시 서버가 default 'couple'로 조용히 커플방을 만들어 solo 선택이 무시되는 함정.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';
import { type RoomMode } from './modes';

export type CreateRoomResult = { roomId: string; inviteCode: string; mode: RoomMode };

/**
 * 방 생성 액션과 로딩/에러 상태를 제공하는 훅.
 * createRoom({ mode }) 호출 시 create_room RPC를 수행하고 { roomId, inviteCode, mode }를 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 */
export const useCreateRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async ({ mode }: { mode: RoomMode }): Promise<CreateRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      // 인자명 p_mode는 RPC 시그니처와 일치(C3). snake_case jsonb 반환.
      const { data, error: rpcError } = await supabase.rpc('create_room', { p_mode: mode });
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { room_id?: string; invite_code?: string; mode?: RoomMode };
      if (!obj.room_id || !obj.invite_code || !obj.mode) {
        throw new Error('CREATE_ROOM_BAD_RESPONSE');
      }
      return { roomId: obj.room_id, inviteCode: obj.invite_code, mode: obj.mode };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRoom, loading, error };
};
