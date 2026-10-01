// supabase/functions/send-muklog-push/handler.test.ts
// 새 기록 알림 핸들러 Deno 단위 테스트 (push-send AC2·AC3·AC6 → join-push plan AC7~AC10 · DT6). deps 주입 — 네트워크 0.
//   옛 index.test.ts 를 옮겨 고쳤다(서버 시작을 하는 index.ts 를 import 하지 않게 — `--allow-env` 만으로 돈다).
//   ⚠️ Deno 런타임 전용 — jest 대상 아님. 실행: 이 폴더에서 `deno task test`(= deno test --allow-env --no-lock).
//   보안 핵심: 본문의 userId 는 절대 신뢰하지 않는다 — JWT 로 확인한 callerId 만.
//             muklogId 가 그 roomId 의 caller 작성 기록일 때만 보낸다(위조 muklogId → 무발송).
//   하위 호환: 출시본 1.3.0 본문 { roomId, muklogId } 그대로, 알림 data 도 { roomId, muklogId }(type 키 없음).
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { captureWarnings } from '../_shared/captureWarnings.ts';
import type { ExpoPushMessage, PushTarget } from '../_shared/pushDelivery.ts';
import { handleSendMuklogPush, type SendMuklogPushDeps } from './handler.ts';

type Calls = {
  verifiedFor: { muklogId: string; roomId: string; userId: string }[];
  listedFor: { roomId: string; actorId: string }[];
  sentMessages: ExpoPushMessage[][];
  deletedTokens: string[];
};

const makeDeps = ({
  over = {},
}: {
  over?: Partial<SendMuklogPushDeps>;
} = {}): { deps: SendMuklogPushDeps; calls: Calls } => {
  const calls: Calls = { verifiedFor: [], listedFor: [], sentMessages: [], deletedTokens: [] };
  const deps: SendMuklogPushDeps = {
    getUserId: ({ token }) => Promise.resolve(token === 'valid' ? 'caller-uid' : null),
    getOwnMuklogPlaceName: ({ muklogId, roomId, userId }) => {
      calls.verifiedFor.push({ muklogId, roomId, userId });
      return Promise.resolve('을지로 노포');
    },
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

// 본문 roomId·muklogId 는 UUID 표준 표기여야 한다(S2-1 입력 검사 — rooms.id·muklogs.id 형식). 테스트 표본 값.
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const MUKLOG_ID = '22222222-2222-4222-8222-222222222222';
const validBody = { roomId: ROOM_ID, muklogId: MUKLOG_ID };
const EMOJI = /\p{Extended_Pictographic}/u;

// ── 기존 케이스(AC10 회귀 0) ───────────────────────────────────────────────

Deno.test('OPTIONS → CORS preflight 200', async () => {
  const { deps } = makeDeps();
  const res = await handleSendMuklogPush({
    req: new Request('http://localhost/send-muklog-push', { method: 'OPTIONS' }),
    deps,
  });
  assertEquals(res.status, 200);
});

Deno.test('Authorization 헤더 없음 → 401 (본인 미검증 차단, 발송 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush({ req: reqWith({ body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'UNAUTHENTICATED' });
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('JWT 무효 → 401 (검증·수신자 조회 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer invalid', body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(calls.verifiedFor.length, 0);
  assertEquals(calls.listedFor.length, 0);
});

Deno.test('getUserId 예외 → 401', async () => {
  const { deps, calls } = makeDeps({ over: { getUserId: () => Promise.reject(new Error('AUTH_DOWN')) } });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 401);
  assertEquals(calls.listedFor.length, 0);
});

Deno.test('보안: body 의 userId 를 무시하고 JWT callerId(caller-uid)로 게이팅한다(스팸 차단)', async () => {
  const { deps, calls } = makeDeps();
  // 공격자가 actor 를 본문에 주입해도 무시 — 멤버십은 JWT callerId 로만 판정.
  await handleSendMuklogPush({
    req: reqWith({ auth: 'Bearer valid', body: { ...validBody, userId: 'victim', p_actor: 'victim' } }),
    deps,
  });
  assertEquals(calls.listedFor, [{ roomId: ROOM_ID, actorId: 'caller-uid' }]);
});

Deno.test('roomId 누락 → 400 BAD_REQUEST (검증·발송 0)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: { muklogId: MUKLOG_ID } }), deps });
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: 'BAD_REQUEST' });
  assertEquals(calls.verifiedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('수신 토큰 0건(비멤버/전원 mute) → 200 no-op, 발송 미호출', async () => {
  const { deps, calls } = makeDeps({ over: { listPushTargets: () => Promise.resolve([]) } });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('best-effort: Expo 발송 실패해도 200(먹로그 저장은 이미 끝남)', async () => {
  const { deps } = makeDeps({ over: { sendExpoPush: () => Promise.reject(new Error('NETWORK')) } });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
});

Deno.test('DeviceNotRegistered ticket → 해당 토큰 best-effort 삭제(무효 토큰 정리)', async () => {
  const { deps, calls } = makeDeps({
    over: {
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
    },
  });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(calls.deletedTokens, ['ExponentPushToken[dead]']);
});

Deno.test('응답에 토큰/시크릿 미포함(토큰 클라 미반환)', async () => {
  const { deps } = makeDeps();
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  const text = await res.clone().text();
  assertEquals(text.includes('ExponentPushToken'), false);
  assertEquals(text.includes('valid'), false);
});

// ── AC7·AC9 하위 호환 + 새 문구 ────────────────────────────────────────────

Deno.test('AC7·AC9: 1.3.0 본문 그대로 → 메시지 전체(새 문구 · data 에 type 키 없음), 응답 { sent: 2 }', async () => {
  const { deps, calls } = makeDeps({
    over: {
      listPushTargets: () =>
        Promise.resolve([
          { expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
          { expoPushToken: 'ExponentPushToken[b]', platform: 'android' },
        ]),
      sendExpoPush: ({ messages }) => {
        calls.sentMessages.push(messages);
        return Promise.resolve([{ status: 'ok' }, { status: 'ok' }]);
      },
    },
  });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 2 });
  const messages = calls.sentMessages[0];
  assertEquals(messages.length, 2);
  assertEquals(messages[0], {
    to: 'ExponentPushToken[a]',
    title: '우리의 맛집',
    body: '민지님이 ‘을지로 노포’ 기록을 남겼어요',
    sound: 'default',
    data: { roomId: ROOM_ID, muklogId: MUKLOG_ID },
  });
});

Deno.test('AC9: 닉네임 없음 → "오소리4294님이 …"(앱 defaultNickname), 로그 이름 없음 → 제목 "새 먹로그"', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getActorNickname: () => Promise.resolve(null),
      getRoomName: () => Promise.resolve(null),
    },
  });
  await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  const message = calls.sentMessages[0][0];
  assertEquals(message.body, '오소리4294님이 ‘을지로 노포’ 기록을 남겼어요');
  assertEquals(message.title, '새 먹로그');
});

Deno.test('AC9: 가게명이 공백뿐 → "민지님이 새 맛집을 기록했어요"', async () => {
  const { deps, calls } = makeDeps({ over: { getOwnMuklogPlaceName: () => Promise.resolve('  ') } });
  await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].body, '민지님이 새 맛집을 기록했어요');
});

Deno.test('AC9: 제목·본문에 이모지 0, "연인" 0', async () => {
  for (const nickname of ['민지', null]) {
    const { deps, calls } = makeDeps({ over: { getActorNickname: () => Promise.resolve(nickname) } });
    await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
    const { title, body } = calls.sentMessages[0][0];
    for (const text of [title, body]) {
      assert(!EMOJI.test(text), text);
      assert(!text.includes('연인'), text);
    }
  }
});

// ── AC8 위조 차단 ──────────────────────────────────────────────────────────

Deno.test('AC8: muklogId 누락·빈 문자열·숫자 → 400, 검증·발송 0', async () => {
  for (const body of [{ roomId: ROOM_ID }, { roomId: ROOM_ID, muklogId: '' }, { roomId: ROOM_ID, muklogId: 7 }]) {
    const { deps, calls } = makeDeps();
    const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body }), deps });
    assertEquals(res.status, 400, JSON.stringify(body));
    assertEquals(await res.json(), { error: 'BAD_REQUEST' });
    assertEquals(calls.verifiedFor.length, 0);
    assertEquals(calls.sentMessages.length, 0);
  }
});

Deno.test('AC8: 위조 muklogId(다른 로그·다른 작성자·없는 id = 검증 null) → 200 { sent: 0 }, 수신자 조회·발송 0', async () => {
  const { deps, calls } = makeDeps({ over: { getOwnMuklogPlaceName: () => Promise.resolve(null) } });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.listedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC8: 검증 조회 오류(형식 틀린 id 등) → fail closed 200 { sent: 0 }, 수신자 조회 0', async () => {
  const { deps, calls } = makeDeps({ over: { getOwnMuklogPlaceName: () => Promise.reject(new Error('22P02')) } });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { sent: 0 });
  assertEquals(calls.listedFor.length, 0);
  assertEquals(calls.sentMessages.length, 0);
});

Deno.test('AC8 보안: 검증 인자는 본문 userId 가 아니라 JWT callerId', async () => {
  const { deps, calls } = makeDeps();
  await handleSendMuklogPush({
    req: reqWith({ auth: 'Bearer valid', body: { ...validBody, userId: 'victim' } }),
    deps,
  });
  assertEquals(calls.verifiedFor, [{ muklogId: MUKLOG_ID, roomId: ROOM_ID, userId: 'caller-uid' }]);
});

// ── R1(보안 QA 권고 · 리더 결정 2026-10-01) — 문구 재료 정리가 발송 메시지까지 이어지는지 ────────────────
//   가게명(검증 조회가 돌려준 원문)·닉네임·로그 이름의 줄바꿈·방향 제어 문자를 정리하고 앱 상한(가게명 60·닉네임 20·로그 이름 20)으로
//   자른다. 문구 단위 경계값은 _shared/pushCopy.test.ts 가 잠근다.
Deno.test('R1: 가게명·닉네임·로그 이름의 줄바꿈·방향 제어 문자를 정리하고 앱 상한으로 잘라 보낸다(메시지 전체)', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getOwnMuklogPlaceName: () => Promise.resolve(`을지로\n노포\u202e${'B'.repeat(100)}`),
      getActorNickname: () => Promise.resolve('민지\u2028\u200f'),
      getRoomName: () => Promise.resolve(`우리의\n맛집${'C'.repeat(100)}`),
    },
  });
  const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(await res.json(), { sent: 1 });
  assertEquals(calls.sentMessages[0][0], {
    to: 'ExponentPushToken[partner]',
    title: `우리의 맛집${'C'.repeat(14)}`,
    body: `민지님이 ‘을지로 노포${'B'.repeat(54)}’ 기록을 남겼어요`,
    sound: 'default',
    data: { roomId: ROOM_ID, muklogId: MUKLOG_ID },
  });
});

Deno.test('R1: 정리하면 비는 가게명은 "{닉}님이 새 맛집을 기록했어요"로 보낸다', async () => {
  const { deps, calls } = makeDeps({ over: { getOwnMuklogPlaceName: () => Promise.resolve('\u202e\n\u2069') } });
  await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].body, '민지님이 새 맛집을 기록했어요');
});

// ── R3(보안 QA O-1 · 리더 결정 2026-10-01) — 오류 로그는 code·message 만 ──────────────────────────────
//   검증 조회 오류는 본문의 muklogId(호출자가 고른 값)가 문구에 섞일 수 있다 — 한 줄로 정리하고, 오류 객체를 통째로 찍지 않는다.
Deno.test('R3: 위조 검증 조회 실패 로그 = [머리말, { code, message }](줄바꿈 정리 · 다른 필드·토큰 미포함)', async () => {
  const { deps } = makeDeps({
    over: {
      getOwnMuklogPlaceName: () =>
        Promise.reject({
          code: '22P02',
          message: 'invalid input syntax for type uuid: "mk\n[send-muklog-push] 가짜 줄"',
          details: 'ExponentPushToken[partner]',
          hint: null,
        }),
    },
  });
  const warnings = await captureWarnings({
    run: () => handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps }),
  });
  assertEquals(warnings, [
    [
      'send-muklog-push: muklog check failed (fail closed)',
      { code: '22P02', message: 'invalid input syntax for type uuid: "mk [send-muklog-push] 가짜 줄"' },
    ],
  ]);
  assertEquals(JSON.stringify(warnings).includes('ExponentPushToken'), false);
});

// ── S2-1(보안 QA 2차 · 중간) — 입력 단계: roomId·muklogId 는 UUID 표준 표기만 ─────────────────────────
//   형식이 틀린 id 는 DB 에 닿기 전에 400 으로 거른다(검증 조회 0). Postgres 는 틀린 uuid 입력을 오류 문구(22P02)에 그대로 되돌려
//   주므로 길이 상한 없는 값이 오류 로그 처리까지 흘러가지 않게 한다. 앱(출시본 1.3.0 포함)은 늘 DB 가 준 UUID 를 보낸다.
const NOT_UUIDS = [
  'mk-1',
  `{${MUKLOG_ID}}`,
  MUKLOG_ID.replaceAll('-', ''),
  `${MUKLOG_ID}0`,
  MUKLOG_ID.slice(0, 35),
  ` ${MUKLOG_ID}`,
  `${MUKLOG_ID}\n`,
  'zzzzzzzz-2222-4222-8222-222222222222',
];
const ATTACK_ID = 'eyJ'.repeat(26_667); // 약 80KB — 옛 코드에서 로그 가림이 십수 초 걸리던 입력

Deno.test('S2-1(a): roomId·muklogId 가 UUID 표준 표기가 아니면 400 BAD_REQUEST, 검증 조회·발송 0', async () => {
  for (const bad of NOT_UUIDS) {
    for (const body of [{ roomId: ROOM_ID, muklogId: bad }, { roomId: bad, muklogId: MUKLOG_ID }]) {
      const { deps, calls } = makeDeps();
      const res = await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body }), deps });
      assertEquals(res.status, 400, JSON.stringify(body));
      assertEquals(await res.json(), { error: 'BAD_REQUEST' });
      assertEquals(calls.verifiedFor.length, 0);
      assertEquals(calls.sentMessages.length, 0);
    }
  }
});

Deno.test('S2-1(a): 대문자 UUID 도 받는다(Postgres uuid 와 같은 판정) — 값은 그대로 넘긴다', async () => {
  const upper = 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11';
  const { deps, calls } = makeDeps();
  const res = await handleSendMuklogPush({
    req: reqWith({ auth: 'Bearer valid', body: { roomId: ROOM_ID, muklogId: upper } }),
    deps,
  });
  assertEquals(res.status, 200);
  assertEquals(calls.verifiedFor, [{ muklogId: upper, roomId: ROOM_ID, userId: 'caller-uid' }]);
});

Deno.test('S2-1: 80KB 공격 muklogId("eyJ" 반복) → 50ms 안에 400, 검증 조회 0 — DB 오류 문구로 되돌아가 로그 가림까지 가지 않는다', async () => {
  const { deps, calls } = makeDeps({
    over: {
      // 실제 DB 처럼 틀린 uuid 입력을 오류 문구에 그대로 되돌려 준다(Postgres 22P02).
      getOwnMuklogPlaceName: ({ muklogId, roomId, userId }) => {
        calls.verifiedFor.push({ muklogId, roomId, userId });
        return Promise.reject({ code: '22P02', message: `invalid input syntax for type uuid: "${muklogId}"` });
      },
    },
  });
  let elapsed = 0;
  let status = 0;
  const warnings = await captureWarnings({
    run: async () => {
      const started = performance.now();
      const res = await handleSendMuklogPush({
        req: reqWith({ auth: 'Bearer valid', body: { roomId: ROOM_ID, muklogId: ATTACK_ID } }),
        deps,
      });
      elapsed = performance.now() - started;
      status = res.status;
    },
  });
  assert(elapsed < 50, `${elapsed.toFixed(1)}ms`);
  assertEquals(status, 400);
  assertEquals(calls.verifiedFor.length, 0);
  assertEquals(warnings, []);
});

Deno.test('S2-1(b): 형식이 맞아도 검증 조회 오류 문구가 80KB 면 — 로그 처리 50ms 안, 로그는 code·message 한 줄', async () => {
  const { deps } = makeDeps({
    over: {
      getOwnMuklogPlaceName: () =>
        Promise.reject({ code: '22P02', message: `invalid input syntax for type uuid: "${ATTACK_ID}"` }),
    },
  });
  let elapsed = 0;
  const warnings = await captureWarnings({
    run: async () => {
      const started = performance.now();
      await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
      elapsed = performance.now() - started;
    },
  });
  assert(elapsed < 50, `${elapsed.toFixed(1)}ms`);
  assertEquals(warnings, [
    [
      'send-muklog-push: muklog check failed (fail closed)',
      { code: '22P02', message: 'invalid input syntax for type uuid: "[jwt]' },
    ],
  ]);
});

// ── S2-2(보안 QA 2차 · 낮음) — 보이는 글자가 없는 가게명·닉네임은 폴백한다(발송 메시지까지) ──────────────
Deno.test('S2-2: 채움 문자만 있는 가게명·ZWJ 만 있는 닉네임 → "기본 닉네임님이 새 맛집을 기록했어요"로 보낸다', async () => {
  const { deps, calls } = makeDeps({
    over: {
      getOwnMuklogPlaceName: () => Promise.resolve('\u3164\uffa0'),
      getActorNickname: () => Promise.resolve('\u200d\ufe0f'),
    },
  });
  await handleSendMuklogPush({ req: reqWith({ auth: 'Bearer valid', body: validBody }), deps });
  assertEquals(calls.sentMessages[0][0].body, '오소리4294님이 새 맛집을 기록했어요');
});
