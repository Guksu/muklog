// supabase/functions/_shared/pushDelivery.ts
// 푸시 발송 공통 단계 — send-join-push·send-muklog-push 가 함께 쓴다 (join-push plan §5.4).
//   타입(수신 토큰·Expo 메시지·티켓·알림 data) + 메시지 조립 + 발송(throw 0, 무효 토큰 정리) +
//   "수신자 조회 → 문구 재료 → 발송" 묶음(sendRoomPush).
//   ⚠️ 토큰은 service_role 경계 안에서만 쓴다 — 응답·로그에 싣지 않는다. 오류 로그는 describeError 의 code·message 만(R3).
//   ⚠️ supabase-js 를 import 하지 않는다(테스트가 원격 모듈을 받지 않게). 실제 호출은 pushDeps.ts 가 주입한다.
import { describeError } from './describeError.ts';
import { type PushCopy, resolveActorName } from './pushCopy.ts';

/** 알림 data 의 type 값. 앱 notificationTarget 의 NotificationType 과 같은 문자열이어야 한다(양쪽 테스트가 각각 잠근다). */
export const PushDataType = { MemberJoined: 'member_joined' } as const;
export type PushDataType = (typeof PushDataType)[keyof typeof PushDataType];

/** 새 기록 알림 data — 출시본 1.3.0 과 같은 모양(type 키 없음 → 구·신 앱 모두 상세로 간다). */
export type MuklogPushData = { roomId: string; muklogId: string };
/** 합류 알림 data — 앱은 roomId 로 로그 화면을 연다. */
export type JoinPushData = { type: typeof PushDataType.MemberJoined; roomId: string };
export type PushData = MuklogPushData | JoinPushData;

/** list_room_push_targets RPC 반환 1건(수신자 토큰). */
export type PushTarget = { expoPushToken: string; platform: string };

/** Expo Push API 메시지 1건(우리가 보내는 필드만). */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: PushData;
};

/** Expo Push API 응답 티켓 1건(우리가 보는 필드만). */
export type ExpoPushTicket = {
  status?: string;
  details?: { error?: string };
};

/** Expo 티켓 오류 코드 중 우리가 처리하는 값. */
const ExpoTicketError = { DeviceNotRegistered: 'DeviceNotRegistered' } as const;

/** 발송 단계가 쓰는 외부 작업. */
export type PushSendDeps = {
  sendExpoPush: (args: { messages: ExpoPushMessage[] }) => Promise<ExpoPushTicket[]>;
  deleteToken: (args: { expoPushToken: string }) => Promise<void>;
};

/** "수신자 조회 → 문구 재료 → 발송" 묶음이 쓰는 외부 작업. */
export type PushRoomDeps = PushSendDeps & {
  listPushTargets: (args: { roomId: string; actorId: string }) => Promise<PushTarget[]>;
  getActorNickname: (args: { userId: string }) => Promise<string | null>;
  getRoomName: (args: { roomId: string }) => Promise<string | null>;
};

/** 두 핸들러가 공통으로 쓰는 외부 작업(인증 + 묶음). 함수별 확인 작업은 각 handler 가 더한다. */
export type PushBaseDeps = PushRoomDeps & {
  getUserId: (args: { token: string }) => Promise<string | null>;
};

/**
 * 수신 토큰마다 메시지 1건을 만든다.
 * @param targets 수신 토큰 목록
 * @param title 알림 제목
 * @param body 알림 본문
 * @param data 알림 data(딥링크 재료) — 모든 메시지에 그대로 싣는다
 * @returns Expo 메시지 배열
 */
export const toPushMessages = ({
  targets,
  title,
  body,
  data,
}: {
  targets: PushTarget[];
  title: string;
  body: string;
  data: PushData;
}): ExpoPushMessage[] =>
  targets.map((target) => ({ to: target.expoPushToken, title, body, sound: 'default', data }));

/**
 * 메시지를 Expo 로 한 번에 보내고, DeviceNotRegistered 티켓의 토큰을 지운다. 절대 throw 하지 않는다.
 *   수신자는 로그 정원(5명) 때문에 많아야 4명 × 기기 수라 Expo 1요청 100건 상한을 나누지 않는다.
 * @param messages 보낼 메시지(0건이면 보내지 않는다)
 * @param deps 발송·토큰 삭제 작업
 * @param logTag 경고 로그 머리말(함수 이름)
 * @returns { sent } — 발송 요청에 성공하면 메시지 수, 실패하면 0
 */
export const deliverPush = async ({
  messages,
  deps,
  logTag,
}: {
  messages: ExpoPushMessage[];
  deps: PushSendDeps;
  logTag: string;
}): Promise<{ sent: number }> => {
  if (messages.length === 0) return { sent: 0 };

  let tickets: ExpoPushTicket[];
  try {
    tickets = await deps.sendExpoPush({ messages });
  } catch (err) {
    console.warn(`${logTag}: expo push failed`, describeError({ error: err }));
    return { sent: 0 };
  }

  // 티켓 순서는 메시지 순서와 1:1(Expo 계약). 길이가 다르면 짧은 쪽까지만 본다.
  const count = Math.min(tickets.length, messages.length);
  for (let index = 0; index < count; index += 1) {
    if (tickets[index]?.details?.error !== ExpoTicketError.DeviceNotRegistered) continue;
    try {
      await deps.deleteToken({ expoPushToken: messages[index].to });
    } catch (err) {
      console.warn(`${logTag}: dead token cleanup skipped`, describeError({ error: err }));
    }
  }
  return { sent: messages.length };
};

/**
 * 비동기 조회를 best-effort 로 읽는다(실패하면 경고만 남기고 null).
 * @param read 조회 작업
 * @param warning 실패 시 경고 문구
 * @returns 조회 값 또는 null
 */
const readOrNull = async <T>({
  read,
  warning,
}: {
  read: () => Promise<T | null>;
  warning: string;
}): Promise<T | null> => {
  try {
    return await read();
  } catch (err) {
    console.warn(warning, describeError({ error: err }));
    return null;
  }
};

/**
 * 로그의 다른 멤버(수신 설정이 켜진 사람)에게 알림을 보낸다. 절대 throw 하지 않는다.
 *   1) 수신 토큰 조회(actor 멤버십·수신 설정 게이팅은 RPC 가 한다 — 실패·0건이면 보내지 않음)
 *   2) 작성자 닉네임·로그 이름 조회(실패해도 폴백 문구로 계속) 3) 문구 4) 발송.
 * @param deps 수신자·이름 조회와 발송 작업
 * @param roomId 로그 id
 * @param actorId 행동한 사람(JWT 로 확인한 callerId) — 수신자에서 빠지고 이름 폴백 키가 된다
 * @param data 알림 data
 * @param buildCopy 작성자 이름·로그 이름으로 문구를 만드는 함수
 * @param logTag 경고 로그 머리말(함수 이름)
 * @returns { sent }
 */
export const sendRoomPush = async ({
  deps,
  roomId,
  actorId,
  data,
  buildCopy,
  logTag,
}: {
  deps: PushRoomDeps;
  roomId: string;
  actorId: string;
  data: PushData;
  buildCopy: (args: { actorName: string; roomName: string | null }) => PushCopy;
  logTag: string;
}): Promise<{ sent: number }> => {
  let targets: PushTarget[];
  try {
    targets = await deps.listPushTargets({ roomId, actorId });
  } catch (err) {
    console.warn(`${logTag}: target listing skipped`, describeError({ error: err }));
    return { sent: 0 };
  }
  if (targets.length === 0) return { sent: 0 };

  const [nickname, roomName] = await Promise.all([
    readOrNull({
      read: () => deps.getActorNickname({ userId: actorId }),
      warning: `${logTag}: nickname lookup skipped`,
    }),
    readOrNull({
      read: () => deps.getRoomName({ roomId }),
      warning: `${logTag}: room name lookup skipped`,
    }),
  ]);
  const { title, body } = buildCopy({
    actorName: resolveActorName({ nickname, userId: actorId }),
    roomName,
  });

  return deliverPush({ messages: toPushMessages({ targets, title, body, data }), deps, logTag });
};
