// supabase/functions/send-muklog-push/index.test.ts
// send-muklog-push 핸들러 Deno 단위 스모크 (plan §2·AC2·AC3·AC6). deps 주입으로 인증/게이팅/발송/best-effort 검증.
//   ⚠️ Deno 런타임 전용 — jest 대상 아님(package.json testPathIgnorePatterns: /supabase/). 실행: `deno test --allow-env`.
//   실 service_role/RPC/Expo Push 는 키 발급 후 `supabase functions serve` + 디바이스 스모크로 검증.
//   보안 핵심: body 의 userId 는 절대 신뢰하지 않는다 — Authorization JWT → getUserId 로 검증된 callerId 만.
//             list_room_push_targets(roomId, callerId) 의 멤버십 게이트가 타인 룸 스팸을 차단한다.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleSendMuklogPush, type SendPushDeps, type PushTarget } from './index.ts';

type Calls = {
  listedFor: { roomId: string; actorId: string }[];
  sentMessages: unknown[][];
  deletedTokens: string[];
};

const makeDeps = (over: Partial<SendPushDeps> = {}): { deps: SendPushDeps; calls: Calls } => {
  const calls: Calls = { listedFor: [], sentMessages: [], deletedTokens: [] };
  const deps: SendPushDeps = {
    getUserId: ({ token }) => Promise.resolve(token === 'valid' ? 'caller-uid' : null),
    listPushTargets: ({ roomId, actorId }) => {
      calls.listedFor.push({ roomId, actorId });
      return Promise.resolve([{ expoPushToken: 'ExponentPushToken[partner]', platform: 'ios' }]);
    },
    getActorNickname: () => Promise.resolve('민지'),
    getRoomName: () => Promise.resolve('우리의 맛집'),
    sendExpoPush: ({ messages }) => {
      calls.sentMessages.push(messages);
      return Promise.resolve([{ status: 'ok' }]);
    },
    deleteToken: ({ expoPushToken }) => {
      calls.deletedTokens.push(expoPushToken);
      return Promise.resolve();
    },
    ...over,
  };
  return { deps, calls };
};

const reqWith = ({ auth, body }: { auth?: string; body?: unknown }): Request =>
  new Request('http://localhost/send-muklog-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body ?? {}),
  });

const validBody = { roomId: 'room-1', muklogId: 'mk-1' };

Deno.test('OPTIONS → CORS preflight 200', async () => {
  const { deps } = makeDeps();
  const res = await handleSendMuklogPush(
    new Request('http://localhost/send-muklog-push', { method: 'OPTIONS' }),
    deps,
  );
  assertEquals(res.status, 200);
});

Deno.test('Authorization 헤더 없음 → 401 (본인 미검증 차단, 발송 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush(reqWith({ body: validBody }), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('JWT 무효 → 401 (발송 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer invalid', body: validBody }), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.listedFor.length, 0);
});

Deno.test('보안: body 의 userId 를 무시하고 JWT callerId(caller-uid)로 게이팅한다(스팸 차단)', async () => {
  const { deps, calls } = makeDeps();
  // 공격자가 actor 를 본문에 주입해도 무시 — 멤버십은 JWT callerId 로만 판정.
  await handleSendMuklogPush(
    reqWith({ auth: 'Bearer valid', body: { ...validBody, userId: 'victim', p_actor: 'victim' } }),
    deps,
  );
  assertEquals(calls.listedFor, [{ roomId: 'room-1', actorId: 'caller-uid' }]);
});

Deno.test('roomId 누락 → 400 BAD_REQUEST (발송 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: { muklogId: 'mk-1' } }), deps);
  assertEquals(res.status, 400);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('수신 토큰 0건(비멤버/전원 mute) → 200 no-op, 발송 미호출', async () => {
  const { deps, calls } = makeDeps({ listPushTargets: () => Promise.resolve([]) });
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('발송 내용: to/title/body/data shape + 닉네임 본문(AC3)', async () => {
  const { deps, calls } = makeDeps({
    listPushTargets: () =>
      Promise.resolve([
        { expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
        { expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
      ]),
  });
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  assertEquals(res.status, 200);
  const messages = calls.sentMessages[0] as Array<Record<string, unknown>>;
  assertEquals(messages.length, 2);
  assertEquals(messages[0].to, 'ExponentPushToken[a]');
  assertEquals(messages[0].title, '우리의 맛집');
  assertEquals(messages[0].body, '민지님이 새 맛집을 기록했어요 🍽️');
  assertEquals(messages[0].sound, 'default');
  assertEquals(messages[0].data, { roomId: 'room-1', muklogId: 'mk-1' });
});

Deno.test('카피 폴백: 닉네임 없으면 "연인님이 ...", 로그명 없으면 폴백 title', async () => {
  const { deps, calls } = makeDeps({
    getActorNickname: () => Promise.resolve(null),
    getRoomName: () => Promise.resolve(null),
  });
  await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  const messages = calls.sentMessages[0] as Array<Record<string, unknown>>;
  // 폴백 저자도 닉네임 케이스("민지님이")와 동일하게 "님이" 접미(구현 buildCopy와 정합).
  assertEquals(messages[0].body, '연인님이 새 맛집을 기록했어요 🍽️');
  assert(typeof messages[0].title === 'string' && (messages[0].title as string).length > 0);
});

Deno.test('best-effort: Expo 발송 실패해도 200(먹로그 저장은 이미 끝남)', async () => {
  const { deps } = makeDeps({ sendExpoPush: () => Promise.reject(new Error('NETWORK')) });
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  assertEquals(res.status, 200);
});

Deno.test('DeviceNotRegistered ticket → 해당 토큰 best-effort 삭제(무효 토큰 정리)', async () => {
  const { deps, calls } = makeDeps({
    listPushTargets: () =>
      Promise.resolve([
        { expoPushToken: 'ExponentPushToken[dead]', platform: 'ios' },
        { expoPushToken: 'ExponentPushToken[ok]', platform: 'ios' },
      ] as PushTarget[]),
    sendExpoPush: () =>
      Promise.resolve([
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'ok' },
      ]),
  });
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedTokens, ['ExponentPushToken[dead]']);
});

Deno.test('응답에 토큰/시크릿 미포함(토큰 클라 미반환)', async () => {
  const { deps } = makeDeps();
  const res = await handleSendMuklogPush(reqWith({ auth: 'Bearer valid', body: validBody }), deps);
  const text = await res.clone().text();
  assertEquals(text.includes('ExponentPushToken'), false);
  assertEquals(text.includes('valid'), false);
});
