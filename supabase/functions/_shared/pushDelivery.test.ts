// supabase/functions/_shared/pushDelivery.test.ts
// 발송 공통 단계 (join-push plan §5.4 · DT3). deps 주입 모킹 — 네트워크 0.
//   toPushMessages: 토큰마다 메시지 1건(data 그대로) / deliverPush: throw 0·무효 토큰만 정리 /
//   sendRoomPush: 수신자 조회 → 문구 재료(best-effort) → 발송.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { captureWarnings } from './captureWarnings.ts';
import {
  deliverPush,
  type ExpoPushMessage,
  type ExpoPushTicket,
  PushDataType,
  type PushRoomDeps,
  sendRoomPush,
  toPushMessages,
} from './pushDelivery.ts';

const message = ({ to }: { to: string }): ExpoPushMessage => ({
  to,
  title: '우리의 맛집',
  body: '본문',
  sound: 'default',
  data: { roomId: 'room-1', muklogId: 'mk-1' },
});

type SendCalls = { sent: ExpoPushMessage[][]; deleted: string[] };

const makeSendDeps = ({
  tickets = [],
  sendError = null,
  deleteError = null,
}: {
  tickets?: ExpoPushTicket[];
  sendError?: Error | null;
  deleteError?: Error | null;
}) => {
  const calls: SendCalls = { sent: [], deleted: [] };
  const deps = {
    sendExpoPush: ({ messages }: { messages: ExpoPushMessage[] }) => {
      calls.sent.push(messages);
      return sendError ? Promise.reject(sendError) : Promise.resolve(tickets);
    },
    deleteToken: ({ expoPushToken }: { expoPushToken: string }) => {
      calls.deleted.push(expoPushToken);
      return deleteError ? Promise.reject(deleteError) : Promise.resolve();
    },
  };
  return { deps, calls };
};

Deno.test('toPushMessages: 토큰 2개 → 메시지 2건, 각각 { to, title, body, sound, data }', () => {
  const data = { type: PushDataType.MemberJoined, roomId: 'room-1' } as const;
  const messages = toPushMessages({
    targets: [
      { expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
      { expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
    ],
    title: '우리 로그',
    body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.',
    data,
  });
  assertEquals(messages, [
    {
      to: 'ExponentPushToken[a]',
      title: '우리 로그',
      body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.',
      sound: 'default',
      data: { type: 'member_joined', roomId: 'room-1' },
    },
    {
      to: 'ExponentPushToken[b]',
      title: '우리 로그',
      body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.',
      sound: 'default',
      data: { type: 'member_joined', roomId: 'room-1' },
    },
  ]);
});

Deno.test('PushDataType.MemberJoined 는 앱 NotificationType 과 같은 문자열 member_joined', () => {
  assertEquals(PushDataType.MemberJoined, 'member_joined');
});

Deno.test('deliverPush: 메시지 0건 → 발송 0회, { sent: 0 }', async () => {
  const { deps, calls } = makeSendDeps({});
  assertEquals(await deliverPush({ messages: [], deps, logTag: 't' }), { sent: 0 });
  assertEquals(calls.sent.length, 0);
});

Deno.test('deliverPush: 성공 → 한 묶음으로 1회 발송, { sent: 메시지 수 }', async () => {
  const { deps, calls } = makeSendDeps({ tickets: [{ status: 'ok' }, { status: 'ok' }] });
  const messages = [message({ to: 'ExponentPushToken[a]' }), message({ to: 'ExponentPushToken[b]' })];
  assertEquals(await deliverPush({ messages, deps, logTag: 't' }), { sent: 2 });
  assertEquals(calls.sent, [messages]);
  assertEquals(calls.deleted, []);
});

Deno.test('deliverPush: 발송 reject → throw 없이 { sent: 0 }', async () => {
  const { deps } = makeSendDeps({ sendError: new Error('NETWORK') });
  assertEquals(
    await deliverPush({ messages: [message({ to: 'ExponentPushToken[a]' })], deps, logTag: 't' }),
    { sent: 0 },
  );
});

Deno.test('deliverPush: DeviceNotRegistered 티켓의 토큰만 지운다(삭제 reject 여도 throw 0)', async () => {
  const { deps, calls } = makeSendDeps({
    tickets: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok' }],
    deleteError: new Error('DB'),
  });
  const result = await deliverPush({
    messages: [message({ to: 'ExponentPushToken[dead]' }), message({ to: 'ExponentPushToken[ok]' })],
    deps,
    logTag: 't',
  });
  assertEquals(result, { sent: 2 });
  assertEquals(calls.deleted, ['ExponentPushToken[dead]']);
});

Deno.test('deliverPush: 다른 오류 코드의 티켓은 토큰을 지우지 않는다', async () => {
  const { deps, calls } = makeSendDeps({
    tickets: [{ status: 'error', details: { error: 'MessageRateExceeded' } }],
  });
  await deliverPush({ messages: [message({ to: 'ExponentPushToken[a]' })], deps, logTag: 't' });
  assertEquals(calls.deleted, []);
});

Deno.test('deliverPush: 티켓이 메시지보다 적으면 짧은 쪽까지만 본다(예외 없음)', async () => {
  const { deps, calls } = makeSendDeps({
    tickets: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
  });
  const result = await deliverPush({
    messages: [message({ to: 'ExponentPushToken[a]' }), message({ to: 'ExponentPushToken[b]' })],
    deps,
    logTag: 't',
  });
  assertEquals(result, { sent: 2 });
  assertEquals(calls.deleted, ['ExponentPushToken[a]']);
});

// ── sendRoomPush ─────────────────────────────────────────────────────────────

type RoomCalls = {
  listedFor: { roomId: string; actorId: string }[];
  nicknameFor: string[];
  roomNameFor: string[];
  sent: ExpoPushMessage[][];
};

const makeRoomDeps = ({ over = {} }: { over?: Partial<PushRoomDeps> } = {}) => {
  const calls: RoomCalls = { listedFor: [], nicknameFor: [], roomNameFor: [], sent: [] };
  const deps: PushRoomDeps = {
    listPushTargets: ({ roomId, actorId }) => {
      calls.listedFor.push({ roomId, actorId });
      return Promise.resolve([{ expoPushToken: 'ExponentPushToken[a]', platform: 'ios' }]);
    },
    getActorNickname: ({ userId }) => {
      calls.nicknameFor.push(userId);
      return Promise.resolve('민지');
    },
    getRoomName: ({ roomId }) => {
      calls.roomNameFor.push(roomId);
      return Promise.resolve('우리의 맛집');
    },
    sendExpoPush: ({ messages }) => {
      calls.sent.push(messages);
      return Promise.resolve([{ status: 'ok' }]);
    },
    deleteToken: () => Promise.resolve(),
    ...over,
  };
  return { deps, calls };
};

const echoCopy = ({ actorName, roomName }: { actorName: string; roomName: string | null }) => ({
  title: `제목:${roomName ?? '-'}`,
  body: `본문:${actorName}`,
});

Deno.test('sendRoomPush: 수신자·작성자·로그 이름을 읽어 문구를 만들고 data 그대로 발송한다', async () => {
  const { deps, calls } = makeRoomDeps();
  const result = await sendRoomPush({
    deps,
    roomId: 'room-1',
    actorId: 'caller-uid',
    data: { roomId: 'room-1', muklogId: 'mk-1' },
    buildCopy: echoCopy,
    logTag: 't',
  });
  assertEquals(result, { sent: 1 });
  assertEquals(calls.listedFor, [{ roomId: 'room-1', actorId: 'caller-uid' }]);
  assertEquals(calls.nicknameFor, ['caller-uid']);
  assertEquals(calls.roomNameFor, ['room-1']);
  assertEquals(calls.sent, [
    [
      {
        to: 'ExponentPushToken[a]',
        title: '제목:우리의 맛집',
        body: '본문:민지',
        sound: 'default',
        data: { roomId: 'room-1', muklogId: 'mk-1' },
      },
    ],
  ]);
});

Deno.test('sendRoomPush: 수신자 0건 → 이름 조회·발송 0, { sent: 0 }', async () => {
  const { deps, calls } = makeRoomDeps({ over: { listPushTargets: () => Promise.resolve([]) } });
  const result = await sendRoomPush({
    deps,
    roomId: 'room-1',
    actorId: 'caller-uid',
    data: { roomId: 'room-1', muklogId: 'mk-1' },
    buildCopy: echoCopy,
    logTag: 't',
  });
  assertEquals(result, { sent: 0 });
  assertEquals(calls.nicknameFor, []);
  assertEquals(calls.sent, []);
});

Deno.test('sendRoomPush: 수신자 조회 reject → throw 없이 { sent: 0 }, 발송 0', async () => {
  const { deps, calls } = makeRoomDeps({ over: { listPushTargets: () => Promise.reject(new Error('RPC')) } });
  const result = await sendRoomPush({
    deps,
    roomId: 'room-1',
    actorId: 'caller-uid',
    data: { roomId: 'room-1', muklogId: 'mk-1' },
    buildCopy: echoCopy,
    logTag: 't',
  });
  assertEquals(result, { sent: 0 });
  assertEquals(calls.sent, []);
});

Deno.test('sendRoomPush: 닉네임·로그 이름 조회가 reject 해도 폴백(defaultNickname·null)으로 발송한다', async () => {
  const { deps, calls } = makeRoomDeps({
    over: {
      getActorNickname: () => Promise.reject(new Error('DB')),
      getRoomName: () => Promise.reject(new Error('DB')),
    },
  });
  const result = await sendRoomPush({
    deps,
    roomId: 'room-1',
    actorId: 'caller-uid',
    data: { type: PushDataType.MemberJoined, roomId: 'room-1' },
    buildCopy: echoCopy,
    logTag: 't',
  });
  assertEquals(result, { sent: 1 });
  assertEquals(calls.sent[0][0].title, '제목:-');
  assertEquals(calls.sent[0][0].body, '본문:오소리4294');
});

// ── R3(보안 QA O-1 · 리더 결정 2026-10-01) — 오류 로그는 code·message 만 ──────────────────────────────
//   supabase-js 오류는 일반 객체라 String(err) 은 "[object Object]"만 남았다. 객체를 통째로 찍지 않고 두 필드만 남긴다
//   (details·hint 등 다른 필드 · 토큰 · JWT 미포함). 호출 인자 전체를 비교해 다른 것이 섞이지 않았는지 잠근다.
const PG_DENIED = {
  code: '42501',
  message: 'permission denied for table device_tokens',
  details: 'expo_push_token = ExponentPushToken[dead]',
  hint: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln',
};

Deno.test('R3: deliverPush 발송 실패 로그 = [머리말, { code, message }]', async () => {
  const { deps } = makeSendDeps({ sendError: new TypeError('error sending request') });
  const warnings = await captureWarnings({
    run: () => deliverPush({ messages: [message({ to: 'ExponentPushToken[a]' })], deps, logTag: 't' }),
  });
  assertEquals(warnings, [['t: expo push failed', { code: null, message: 'error sending request' }]]);
});

Deno.test('R3: 무효 토큰 삭제 실패 로그에 토큰·오류 객체의 다른 필드가 없다', async () => {
  const { deps } = makeSendDeps({
    tickets: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    deleteError: PG_DENIED as unknown as Error,
  });
  const warnings = await captureWarnings({
    run: () => deliverPush({ messages: [message({ to: 'ExponentPushToken[dead]' })], deps, logTag: 't' }),
  });
  assertEquals(warnings, [
    ['t: dead token cleanup skipped', { code: '42501', message: 'permission denied for table device_tokens' }],
  ]);
  assertEquals(JSON.stringify(warnings).includes('ExponentPushToken'), false);
  assertEquals(JSON.stringify(warnings).includes('eyJ'), false);
});

Deno.test('R3: sendRoomPush 수신자 조회 실패 로그 = code·message', async () => {
  const { deps } = makeRoomDeps({ over: { listPushTargets: () => Promise.reject(PG_DENIED) } });
  const warnings = await captureWarnings({
    run: () =>
      sendRoomPush({
        deps,
        roomId: 'room-1',
        actorId: 'caller-uid',
        data: { roomId: 'room-1', muklogId: 'mk-1' },
        buildCopy: echoCopy,
        logTag: 't',
      }),
  });
  assertEquals(warnings, [
    ['t: target listing skipped', { code: '42501', message: 'permission denied for table device_tokens' }],
  ]);
});

Deno.test('R3: sendRoomPush 닉네임·로그 이름 조회 실패 로그 = 각각 code·message(발송은 폴백으로 계속)', async () => {
  const { deps, calls } = makeRoomDeps({
    over: {
      getActorNickname: () => Promise.reject({ code: 'PGRST301', message: 'JWT expired', details: 'x' }),
      getRoomName: () => Promise.reject(new Error('DB')),
    },
  });
  const warnings = await captureWarnings({
    run: () =>
      sendRoomPush({
        deps,
        roomId: 'room-1',
        actorId: 'caller-uid',
        data: { roomId: 'room-1', muklogId: 'mk-1' },
        buildCopy: echoCopy,
        logTag: 't',
      }),
  });
  assertEquals(warnings, [
    ['t: nickname lookup skipped', { code: 'PGRST301', message: 'JWT expired' }],
    ['t: room name lookup skipped', { code: null, message: 'DB' }],
  ]);
  assertEquals(calls.sent.length, 1);
});
