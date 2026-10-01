// src/features/notif/triggerPush/triggerPush.ts
// 푸시 발송 Edge Function 트리거 (join-push plan §5.5 · AC15). 새 기록 저장·로그 입장 직후 상대에게 알림을 요청한다.
//   호출부는 결과를 기다리지 않는다(`void triggerPush(...)` — fire-and-forget). 실패·지연이 저장·입장 UX 를 막지 않게.
//   이 함수는 절대 reject 하지 않는다 — invoke 의 throw 와 { error }(함수 404·500) 모두 console.warn 만 남긴다(best-effort).
//
// 생산자(서버): send-muklog-push(본문 { roomId, muklogId }) · send-join-push(본문 { roomId }).
// 소비자(앱): useCreateMuklog(새 기록) · useJoinRoom(입장 성공).
// 보안: 본문에 사용자 id 를 넣지 않는다 — invoke 가 Authorization(JWT)을 자동으로 붙이고 함수가 callerId 를 확인한다.
// ⚠️ supabase 클라이언트를 끌어오므로 알림 바렐(src/features/notif/index.ts)에 넣지 않는다 — 직접 경로로 import 한다.
import { supabase } from '@/lib/supabase';

/** 발송을 일으키는 앱 이벤트(앱 내부 식별자 — 서버 함수 이름과는 PushFunctionName 이 잇는다). */
export const PushEvent = {
  MuklogCreated: 'muklog_created',
  MemberJoined: 'member_joined',
} as const;
export type PushEvent = (typeof PushEvent)[keyof typeof PushEvent];

/** 이벤트별 입력. 새 기록은 기록 id 가, 합류는 로그 id 만 필요하다. */
export type PushEventInput =
  | { type: typeof PushEvent.MuklogCreated; roomId: string; muklogId: string }
  | { type: typeof PushEvent.MemberJoined; roomId: string };

/** Edge Function 이름 — 폴더 이름·config.toml 블록과 같은 철자여야 한다(경계면 단일 출처). */
const PushFunctionName = {
  SendMuklogPush: 'send-muklog-push',
  SendJoinPush: 'send-join-push',
} as const;
type PushFunctionName = (typeof PushFunctionName)[keyof typeof PushFunctionName];

/**
 * 이벤트를 부를 함수 이름과 요청 본문으로 바꾼다.
 * @param event 발송 이벤트
 * @returns 함수 이름과 본문(camelCase — 함수가 그대로 읽는다)
 */
const toInvocation = ({
  event,
}: {
  event: PushEventInput;
}): { name: PushFunctionName; body: Record<string, string> } => {
  switch (event.type) {
    case PushEvent.MuklogCreated:
      return {
        name: PushFunctionName.SendMuklogPush,
        body: { roomId: event.roomId, muklogId: event.muklogId },
      };
    case PushEvent.MemberJoined:
      return { name: PushFunctionName.SendJoinPush, body: { roomId: event.roomId } };
  }
};

/**
 * 푸시 발송 Edge Function 을 best-effort 로 부른다. 절대 reject 하지 않는다(실패는 console.warn 만).
 * @param event 발송 이벤트(새 기록 저장 · 로그 입장)
 */
export const triggerPush = async ({ event }: { event: PushEventInput }): Promise<void> => {
  let invocation: ReturnType<typeof toInvocation> | null = null;
  try {
    invocation = toInvocation({ event });
    const { error } = await supabase.functions.invoke(invocation.name, { body: invocation.body });
    if (error) console.warn('[triggerPush] 발송 요청 실패(무시):', invocation.name, error);
  } catch (error) {
    console.warn('[triggerPush] 발송 요청 예외(무시):', invocation?.name, error);
  }
};
