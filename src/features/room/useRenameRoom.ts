// src/features/room/useRenameRoom.ts
// 로그 이름 수정 훅 (plan §3.4·§5 T3, C-ARG·C-LEN).
//
// 생산자: rename_room(p_room_id uuid, p_name text) RPC(SECURITY DEFINER, 멤버검증) → jsonb { room_id, name } (snake).
//   서버가 정규화한 최종 name(빈/공백→null)을 반환 — 클라도 동일 정규화하지만 서버 값이 단일 출처.
// 소비자: LogScreen 헤더 편집 시트(저장 → 성공 시 useRoom.refresh + 토스트).
//
// ⚠️ C-ARG: 인자명 p_room_id/p_name 은 RPC 시그니처와 정확히 일치해야 한다(오타 시 조용히 실패).
// ⚠️ 비-낙관적: 성공 후 useRoom.refresh()로 헤더 갱신(plan §3.4). 로컬 낙관적 상태 미도입.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';
import { normalizeLogName } from './logName';

export type RenameRoomResult = { roomId: string; name: string | null };

/**
 * 로그 이름 수정 액션과 로딩/에러 상태를 제공하는 훅.
 * renameRoom({ roomId, name }) 호출 시 name을 normalizeLogName으로 정규화해 rename_room RPC로 보내고,
 * 서버가 반환한 최종 name(정규화값)을 { roomId, name }으로 반환한다(서버 값이 단일 출처).
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 */
export const useRenameRoom = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renameRoom = async ({
    roomId,
    name,
  }: {
    roomId: string;
    name: string;
  }): Promise<RenameRoomResult> => {
    setLoading(true);
    setError(null);
    try {
      // 클라 1차 정규화(서버도 nullif(btrim())로 재정규화 — 이중). 인자명 p_room_id/p_name 정확 일치(C-ARG).
      const normalized = normalizeLogName({ input: name });
      const { data, error: rpcError } = await supabase.rpc('rename_room', {
        p_room_id: roomId,
        p_name: normalized,
      });
      if (rpcError) throw rpcError;

      const obj = (data ?? {}) as { room_id?: unknown; name?: unknown };
      // 서버 반환 name이 단일 출처(string | null).
      const resultName = typeof obj.name === 'string' ? obj.name : null;
      const resultRoomId = typeof obj.room_id === 'string' ? obj.room_id : roomId;
      return { roomId: resultRoomId, name: resultName };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { renameRoom, loading, error };
};
