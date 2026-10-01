// supabase/functions/send-join-push/handler.test.ts
// 합류 알림 핸들러 Deno 단위 테스트 (join-push plan AC1~AC6 · DT5). deps 주입 모킹 — 네트워크 0.
//   ⚠️ Deno 런타임 전용 — jest 대상 아님. 실행: 이 폴더에서 `deno task test`(= deno test --allow-env --no-lock).
//   보안 핵심: 본문의 userId 류는 읽지 않는다 — JWT 로 확인한 callerId 만 claim·수신자 조회에 쓴다.
//             claim_join_push 가 true 일 때만 보낸다(같은 합류로 1회, 실패·오류는 보내지 않음).
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { captureWarnings } from '../_shared/captureWarnings.ts';
import type { ExpoPushMessage, PushTarget } from '../_shared/pushDelivery.ts';
import { handleSendJoinPush, type SendJoinPushDeps } from './handler.ts';

type Calls = {
  claimedFor: { roomId: string; userId: string }[];
  listedFor: { roomId: string; actorId: string }[];
  sentMessages: ExpoPushMessage[][];
  deletedTokens: string[];
};

const makeDeps = ({
  over = {},
}: {
  over?: Partial<SendJoinPushDeps>;
} = {}): { deps: SendJoinPushDeps; calls: Calls } => {
  const calls: Calls = { claimedFor: [], listedFor: [], sentMessages: [], deletedTokens: [] };
  const deps: SendJoinPushDeps = {
    getUserId: ({ token }) => Promise.resolve(token === 'valid' ? 'caller-uid' : null),
    claimJoinPush: ({ roomId, userId }) => {
      calls.claimedFor.push({ roomId, userId });
      return Promise.resolve(true);
    },
    listPushTargets: ({ roomId, actorId }) => {
      calls.listedFor.push({ roomId, actorId });
      return Promise.resolve([{ expoPushToken: 'ExponentPushToken[partner]', platform: 'ios' }]);
    },
    getActorNickname: () => Promise.resolve('민지'),
    getRoomName: () => Promise.resolve('우리의 맛집'),
    sendExpoPush: ({ messages }) => {
      calls.sentMessages.push(messages);
      return Promise.resolve(messages.map(() => ({ status: 'ok' })));
    },
    deleteToken: ({ expoPushToken }) => {
      calls.deletedTokens.push(expoPushToken);
      return Promise.resolve();
    },
    ...over,
  };
  return { deps, calls };
};

const reqWith = ({ auth, body, rawBody }: { auth?: string; body?: unknown; rawBody?: string }): Request =>
  new Request('http://localhost/send-join-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: rawBody ?? JSON.stringify(body ?? {}),
  });

// 본문 roomId 는 UUID 표준 표기여야 한다(S2-1 입력 검사 — rooms.id 형식). 테스트 표본 값.
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const validBody = { roomId: ROOM_ID };
const EMOJI = /\p{Extended_Pictographic}/u;

// ── AC1 인증 ───────────────────────────────────────────────────────────────

Deno.test('OPTIONS → CORS preflight 200', async () => {
  const { deps } = makeDeps();
  const res = await handleSendJoinPush({
    req: new Request('http://localhost/send-join-push', { method: 'OPTIONS' }),
    deps,
  });
  assertEquals(res.status, 200);
});

Deno.test('AC1: Authorization 없음 → 401 UNAUTHENTICATED, claim·발송 0', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendJoinPush({ req: reqWith({ body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'UNAUTHENTICATED' });
  assertEquals(calls.claimedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC1: JWT 무효 → 401, claim 0', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer invalid', body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(calls.claimedFor.length, 0);
});

Deno.test('AC1: getUserId 예외 → 401, claim 0', async () => {
  const { deps, calls } = makeDeps({ over: { getUserId: () => Promise.reject(new Error('AUTH_DOWN')) } });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(calls.claimedFor.length, 0);
});

// ── AC2 본문·신원 ──────────────────────────────────────────────────────────

Deno.test('AC2: roomId 가 비어 있지 않은 문자열이 아니면 400 BAD_REQUEST, claim 0', async () => {
  const bodies: Array<{ body?: unknown; rawBody?: string }> = [
    { body: {} },
    { body: { roomId: '' } },
    { body: { roomId: 42 } },
    { body: [ROOM_ID] },
    { rawBody: 'not-json' },
  ];
  for (const input of bodies) {
    const { deps, calls } = makeDeps();
    const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', ...input }), deps });
    assertEquals(res.status, 400, JSON.stringify(input));
    assertEquals(await res.json(), { error: 'BAD_REQUEST' });
    assertEquals(calls.claimedFor.length, 0);
  }
});

Deno.test('AC2 보안: 본문의 userId·actorId·p_user_id 를 무시하고 JWT callerId 로 claim·수신자 조회', async () => {
  const { deps, calls } = makeDeps();
  await handleSendJoinPush({
    req: reqWith({
      auth: 'Bearer valid',
      body: { roomId: ROOM_ID, userId: 'victim', actorId: 'victim', p_user_id: 'victim' },
    }),
    deps,
  });
  assertEquals(calls.claimedFor, [{ roomId: ROOM_ID, userId: 'caller-uid' }]);
  assertEquals(calls.listedFor, [{ roomId: ROOM_ID, actorId: 'caller-uid' }]);
});

// ── AC3 1회 보장 ───────────────────────────────────────────────────────────

Deno.test('AC3: claim false(이미 보냄·멤버 아님·10분 지남·생성자) → 200 { sent: 0 }, 수신자 조회·발송 0', async () => {
  const { deps, calls } = makeDeps({ over: { claimJoinPush: () => Promise.resolve(false) } });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.listedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC3: claim 오류(RPC 실패·마이그레이션 미적용) → fail closed 200 { sent: 0 }, 발송 0', async () => {
  const { deps, calls } = makeDeps({
    over: { claimJoinPush: () => Promise.reject(new Error('function does not exist')) },
  });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.listedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC3: 같은 요청 두 번(claim true → false) → 발송 묶음은 첫 번째 1번뿐', async () => {
  const claims = [true, false];
  const { deps, calls } = makeDeps({ over: { claimJoinPush: () => Promise.resolve(claims.shift() ?? false) } });
  const first = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  const second = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(await first.json(), { sent: 1 });
  assertEquals(await second.json(), { sent: 0 });
  assertEquals(calls.sentMessages.length, 1);
});

// ── AC4 발송 형태 ──────────────────────────────────────────────────────────

Deno.test('AC4: claim true + 토큰 2개 → 메시지 2건(객체 전체 — data 에 muklogId 키 없음), 응답 { sent: 2 }', async () => {
  const { deps, calls } = makeDeps({
    over: {
      listPushTargets: () =>
        Promise.resolve([
          { expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
          { expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
        ]),
    },
  });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 2 });
  assertEquals(calls.sentMessages.length, 1);
  const messages = calls.sentMessages[0];
  assertEquals(messages.length, 2);
  assertEquals(messages[0], {
    to: 'ExponentPushToken[a]',
    title: '우리의 맛집',
    body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.',
    sound: 'default',
    data: { type: 'member_joined', roomId: ROOM_ID },
  });
  assertEquals(messages[1].to, 'ExponentPushToken[b]');
});

Deno.test('AC4: 수신 토큰 0건(혼자·알림 끔) → 200 { sent: 0 }, 발송 0', async () => {
  const { deps, calls } = makeDeps({ over: { listPushTargets: () => Promise.resolve([]) } });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC4: 수신자 조회 reject → 200 { sent: 0 }', async () => {
  const { deps, calls } = makeDeps({ over: { listPushTargets: () => Promise.reject(new Error('RPC')) } });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.sentMessages.length, 0);
});

// ── AC5 문구 ───────────────────────────────────────────────────────────────

Deno.test('AC5: 닉네임·로그 이름 없음 → 제목 "우리 로그", 본문 "오소리4294님이 들어왔어요…"(앱 defaultNickname)', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.resolve(null),
      getRoomName: () => Promise.resolve(null),
    },
  });
  await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  const message = calls.sentMessages[0][0];
  assertEquals(message.title, '우리 로그');
  assertEquals(message.body, '오소리4294님이 들어왔어요. 이제 함께 기록할 수 있어요.');
});

Deno.test('AC5: 닉네임이 공백뿐이어도 같은 폴백', async () => {
  const { deps, calls } = makeDeps({ over: { getActorNickname: () => Promise.resolve('   ') } });
  await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].body, '오소리4294님이 들어왔어요. 이제 함께 기록할 수 있어요.');
});

Deno.test('AC5: 닉네임·로그 이름 조회가 reject 해도 폴백 문구로 1번 발송', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.reject(new Error('DB')),
      getRoomName: () => Promise.reject(new Error('DB')),
    },
  });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(await res.json(), { sent: 1 });
  assertEquals(calls.sentMessages.length, 1);
  assertEquals(calls.sentMessages[0][0].title, '우리 로그');
  assertEquals(calls.sentMessages[0][0].body, '오소리4294님이 들어왔어요. 이제 함께 기록할 수 있어요.');
});

Deno.test('AC5: 제목·본문에 이모지 0, "연인" 0', async () => {
  for (const nickname of ['민지', null]) {
    const { deps, calls } = makeDeps({ over: { getActorNickname: () => Promise.resolve(nickname) } });
    await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
    const { title, body } = calls.sentMessages[0][0];
    for (const text of [title, body]) {
      assert(!EMOJI.test(text), text);
      assert(!text.includes('연인'), text);
    }
  }
});

// ── AC6 best-effort·비노출 ─────────────────────────────────────────────────

Deno.test('AC6: Expo 발송 실패 → 200 { sent: 0 }', async () => {
  const { deps } = makeDeps({ over: { sendExpoPush: () => Promise.reject(new Error('NETWORK')) } });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
});

Deno.test('AC6: DeviceNotRegistered 티켓 → 그 토큰만 삭제(삭제 실패는 무시)', async () => {
  const { deps, calls } = makeDeps({
    over: {
      listPushTargets: () =>
        Promise.resolve([
          { expoPushToken: 'ExponentPushToken[dead]', platform: 'ios' },
          { expoPushToken: 'ExponentPushToken[ok]', platform: 'ios' },
        ] as PushTarget[]),
      sendExpoPush: () =>
        Promise.resolve([{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok' }]),
      deleteToken: ({ expoPushToken }) => {
        calls.deletedTokens.push(expoPushToken);
        return Promise.reject(new Error('DB'));
      },
    },
  });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(calls.deletedTokens, ['ExponentPushToken[dead]']);
});

Deno.test('AC6: 응답에 토큰·JWT 문자열 0', async () => {
  const { deps } = makeDeps();
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  const text = await res.clone().text();
  assertEquals(text.includes('ExponentPushToken'), false);
  assertEquals(text.includes('valid'), false);
});

// ── R1(보안 QA 권고 · 리더 결정 2026-10-01) — 문구 재료 정리가 발송 메시지까지 이어지는지 ────────────────
//   닉네임·로그 이름은 사용자가 고른 원문이다(앱을 거치지 않고 직접 넣을 수 있다). 줄바꿈·방향 제어 문자는 정리하고 앱 상한으로 잘라
//   잠금 화면 알림에 가짜 안내 줄이 끼지 않게 한다. 문구 단위 경계값은 _shared/pushCopy.test.ts 가 잠근다.
Deno.test('R1: 닉네임·로그 이름의 줄바꿈·방향 제어 문자를 정리하고 앱 상한(20자)으로 잘라 보낸다(메시지 전체)', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.resolve('민지\n[먹로그 안내] 다시 로그인해 주세요\u202e'),
      getRoomName: () => Promise.resolve('우리의\r\n맛집\u2066'),
    },
  });
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(await res.json(), { sent: 1 });
  assertEquals(calls.sentMessages[0][0], {
    to: 'ExponentPushToken[partner]',
    title: '우리의 맛집',
    body: '민지 [먹로그 안내] 다시 로그인해님이 들어왔어요. 이제 함께 기록할 수 있어요.',
    sound: 'default',
    data: { type: 'member_joined', roomId: ROOM_ID },
  });
});

Deno.test('R1: 정리하면 비는 닉네임·로그 이름은 기본 닉네임·폴백 제목으로 보낸다', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.resolve('\u202e\n\t'),
      getRoomName: () => Promise.resolve('\u2066\u2069'),
    },
  });
  await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].title, '우리 로그');
  assertEquals(calls.sentMessages[0][0].body, '오소리4294님이 들어왔어요. 이제 함께 기록할 수 있어요.');
});

// ── R3(보안 QA O-1 · 리더 결정 2026-10-01) — 오류 로그는 code·message 만 ──────────────────────────────
//   claim 실패 원인이 "함수 없음(PGRST202 — 마이그레이션 미적용)"인지 "권한 없음(42501)"인지 로그로 가릴 수 있어야 한다.
//   오류 객체를 통째로 찍지 않는다(details·hint 등 · 토큰 · JWT 미포함).
Deno.test('R3: claim 실패 로그 = [머리말, { code, message }] — 배포 순서 문제(PGRST202·42501)를 구별한다', async () => {
  for (const [code, message] of [
    ['PGRST202', 'Could not find the function public.claim_join_push(p_room_id, p_user_id) in the schema cache'],
    ['42501', 'permission denied for function claim_join_push'],
  ]) {
    const { deps } = makeDeps({
      over: {
        claimJoinPush: () =>
          Promise.reject({
            code,
            message,
            details: 'caller ExponentPushToken[partner]',
            hint: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2In0.c2ln',
          }),
      },
    });
    const warnings = await captureWarnings({
      run: () => handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps }),
    });
    assertEquals(warnings, [['send-join-push: claim failed (fail closed)', { code, message }]]);
    assertEquals(JSON.stringify(warnings).includes('ExponentPushToken'), false);
    assertEquals(JSON.stringify(warnings).includes('eyJ'), false);
  }
});

// ── S2-1(보안 QA 2차 · 중간) — 입력 단계: roomId 는 UUID 표준 표기만 ─────────────────────────────────
//   형식이 틀린 id 는 DB 에 닿기 전에 400 으로 거른다. Postgres 는 틀린 uuid 입력을 오류 문구(22P02)에 그대로 되돌려 주므로,
//   길이 상한 없는 값이 오류 로그 처리(가림 정규식)까지 흘러가지 않게 한다. 앱(출시본 1.3.0 포함)은 늘 DB 가 준 UUID 를 보낸다.
const NOT_UUIDS = [
  'room-1',
  `{${ROOM_ID}}`,
  ROOM_ID.replaceAll('-', ''),
  `${ROOM_ID}0`,
  ROOM_ID.slice(0, 35),
  ` ${ROOM_ID}`,
  `${ROOM_ID}\n`,
  'zzzzzzzz-1111-4111-8111-111111111111',
];
const ATTACK_ROOM_ID = 'eyJ'.repeat(26_667); // 약 80KB — 옛 코드에서 로그 가림이 십수 초 걸리던 입력

Deno.test('S2-1(a): roomId 가 UUID 표준 표기가 아니면 400 BAD_REQUEST, claim 0(형식 틀린 id 는 DB 에 닿기 전에 거른다)', async () => {
  for (const roomId of NOT_UUIDS) {
    const { deps, calls } = makeDeps();
    const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: { roomId } }), deps });
    assertEquals(res.status, 400, JSON.stringify(roomId));
    assertEquals(await res.json(), { error: 'BAD_REQUEST' });
    assertEquals(calls.claimedFor.length, 0);
  }
});

Deno.test('S2-1(a): 대문자 UUID 도 받는다(Postgres uuid 와 같은 판정) — 값은 그대로 넘긴다', async () => {
  const upper = 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11';
  const { deps, calls } = makeDeps();
  const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: { roomId: upper } }), deps });
  assertEquals(res.status, 200);
  assertEquals(calls.claimedFor, [{ roomId: upper, userId: 'caller-uid' }]);
});

Deno.test('S2-1: 80KB 공격 roomId("eyJ" 반복) → 50ms 안에 400, claim 0 — DB 오류 문구로 되돌아가 로그 가림까지 가지 않는다', async () => {
  const { deps, calls } = makeDeps({
    over: {
      // 실제 DB 처럼 틀린 uuid 입력을 오류 문구에 그대로 되돌려 준다(Postgres 22P02).
      claimJoinPush: ({ roomId, userId }) => {
        calls.claimedFor.push({ roomId, userId });
        return Promise.reject({ code: '22P02', message: `invalid input syntax for type uuid: "${roomId}"` });
      },
    },
  });
  let elapsed = 0;
  let status = 0;
  const warnings = await captureWarnings({
    run: async () => {
      const started = performance.now();
      const res = await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: { roomId: ATTACK_ROOM_ID } }), deps });
      elapsed = performance.now() - started;
      status = res.status;
    },
  });
  assert(elapsed < 50, `${elapsed.toFixed(1)}ms`);
  assertEquals(status, 400);
  assertEquals(calls.claimedFor.length, 0);
  assertEquals(warnings, []);
});

Deno.test('S2-1(b): 형식이 맞아도 DB 오류 문구가 80KB 면 — 로그 처리 50ms 안, 로그는 code·message 한 줄', async () => {
  const { deps } = makeDeps({
    over: {
      claimJoinPush: () =>
        Promise.reject({ code: '22P02', message: `invalid input syntax for type uuid: "${ATTACK_ROOM_ID}"` }),
    },
  });
  let elapsed = 0;
  const warnings = await captureWarnings({
    run: async () => {
      const started = performance.now();
      await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
      elapsed = performance.now() - started;
    },
  });
  assert(elapsed < 50, `${elapsed.toFixed(1)}ms`);
  assertEquals(warnings, [
    ['send-join-push: claim failed (fail closed)', { code: '22P02', message: 'invalid input syntax for type uuid: "[jwt]' }],
  ]);
});

// ── S2-2(보안 QA 2차 · 낮음) — 보이는 글자가 없는 이름은 폴백한다(발송 메시지까지) ─────────────────────
Deno.test('S2-2: 한글 채움 문자만 있는 닉네임·제로폭 문자만 있는 로그 이름 → 기본 닉네임·폴백 제목으로 보낸다', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.resolve('\u3164'),
      getRoomName: () => Promise.resolve('\u200b\u2060'),
    },
  });
  await handleSendJoinPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].title, '우리 로그');
  assertEquals(calls.sentMessages[0][0].body, '오소리4294님이 들어왔어요. 이제 함께 기록할 수 있어요.');
});
