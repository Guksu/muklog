// src/features/room/useJoinRoom.ts
// 방 입장 훅 (plan §3.6, C1·C2).
//
// 생산자: join_room(p_code) RPC → jsonb { room_id } (snake_case).
// 소비자: JoinLogScreen(초대코드 입장). 토큰별 에러는 mapRoomError로 매핑.
// 합류 알림(join-push U74): 입장 성공 직후 send-join-push 를 triggerPush 로 부르고 기다리지 않는다 — 그 로그의 기존 멤버에게
//   "{닉}님이 들어왔어요" 알림. 실패·지연이 입장 UX 를 막지 않는다(best-effort, 실패 안내 없음). 입장 실패면 부르지 않는다.
//   새 합류와 같은 코드 재입장(멱등 성공)을 앱은 구별할 수 없다 — 같은 합류로 두 번 보내지 않는 보장은 서버(claim_join_push)가 한다.
import { useState } from 'react';

// 발송 트리거는 알림 바렐이 아니라 직접 경로로(supabase 의존을 바렐 소비처에 전가하지 않는 notif 규칙).
import { PushEvent, triggerPush } from '@/features/notif/triggerPush';
import { supabase } from '@/lib/supabase';

import { mapRoomError } from '../errors';

export type JoinRoomResult = { roomId: string };

/**
 * 방 입장 액션과 로딩/에러 상태를 제공하는 훅.
 * joinRoom({ code }) 호출 시 join_room RPC를 수행하고 { roomId }를 반환한다.
 * 성공하면 합류 알림(send-join-push)을 기다리지 않고 요청한다.
 * 실패 시 error에 토큰별 한국어 메시지를 세팅하고 원본 에러를 throw한다.
 * clearError()는 실패 문구만 지운다(입장 화면이 코드가 바뀔 때 부른다 — invite-share U24 ①). loading·네트워크 불변.
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

      const obj = (data ?? {}) as { room_id?: string; error?: string };
      // invite-code-hardening: INVALID_CODE는 raise가 아니라 jsonb { error } 반환 계약이다 —
      // raise는 트랜잭션 롤백으로 서버의 실패 카운터 INSERT까지 지우기 때문. 토큰 throw로 변환.
      if (obj.error) {
        throw new Error(obj.error);
      }
      if (!obj.room_id) {
        throw new Error('JOIN_ROOM_BAD_RESPONSE');
      }
      // 합류 알림 요청 — 기다리지 않는다(void). triggerPush 는 reject 하지 않아 입장 결과·error 에 영향 0.
      void triggerPush({ event: { type: PushEvent.MemberJoined, roomId: obj.room_id } });
      return { roomId: obj.room_id };
    } catch (err) {
      setError(mapRoomError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 실패 문구를 다음 제출까지 남기지 않는다 — 코드가 바뀌면 이전 코드의 실패는 더 이상 맞는 말이 아니다.
  const clearError = () => setError(null);

  return { joinRoom, loading, error, clearError };
};
