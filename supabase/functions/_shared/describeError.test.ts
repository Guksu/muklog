// supabase/functions/_shared/describeError.test.ts
// 오류 로그 재료 (join-push 리더 지시 R3 · 보안 QA O-1). 잡은 오류에서 code·message 두 필드만 — 객체 통째·토큰·키·JWT 미포함.
//   왜: supabase-js 오류는 일반 객체라 String(err) 은 "[object Object]"만 남아 배포 순서 문제(PGRST202 함수 없음 = 마이그레이션
//   미적용 / 42501 권한 없음)를 로그로 가릴 수 없었다. 그렇다고 통째로 찍으면 details·hint 등에 무엇이 실릴지 모른다.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { describeError } from './describeError.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWxsZXItdWlkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ';

Deno.test('describeError: PostgREST 오류 객체 → code·message 두 필드만(details·hint·status 는 버린다)', () => {
  const error = {
    code: 'PGRST202',
    message: 'Could not find the function public.claim_join_push(p_room_id, p_user_id) in the schema cache',
    details: 'Searched for the function with parameters ExponentPushToken[secret-token]',
    hint: `Perhaps you meant ${JWT}`,
    status: 404,
  };
  assertEquals(describeError({ error }), {
    code: 'PGRST202',
    message: 'Could not find the function public.claim_join_push(p_room_id, p_user_id) in the schema cache',
  });
});

Deno.test('describeError: 권한 오류(42501)도 code 로 구별된다', () => {
  assertEquals(
    describeError({ error: { code: '42501', message: 'permission denied for function claim_join_push' } }),
    { code: '42501', message: 'permission denied for function claim_join_push' },
  );
});

Deno.test('describeError: Error 인스턴스 → code 없음(null) + message(이름·스택은 남기지 않는다)', () => {
  assertEquals(describeError({ error: new TypeError('error sending request') }), {
    code: null,
    message: 'error sending request',
  });
});

Deno.test('describeError: 숫자 code 는 문자열로, 문자열이 아닌 message·객체 code 는 null', () => {
  assertEquals(describeError({ error: { code: 503, message: { nested: 'x' } } }), { code: '503', message: null });
  assertEquals(describeError({ error: { code: { raw: 'x' }, message: 'm' } }), { code: null, message: 'm' });
});

Deno.test('describeError: 문자열을 던지면 그 문자열이 message, null·undefined·숫자는 두 필드 모두 null', () => {
  assertEquals(describeError({ error: 'boom' }), { code: null, message: 'boom' });
  // QA O13(4차 V05): 문자열로 던진 오류도 객체의 message 와 같이 가리고 한 줄로 정리한다.
  assertEquals(describeError({ error: `bad\n${JWT}` }), { code: null, message: 'bad [jwt]' });
  for (const error of [null, undefined, 42]) {
    assertEquals(describeError({ error }), { code: null, message: null }, String(error));
  }
});

Deno.test('describeError: message·code 안의 JWT·Expo 푸시 토큰·Supabase 비밀 키는 가린다', () => {
  assertEquals(describeError({ error: { message: `invalid JWT: ${JWT} rejected` } }), {
    code: null,
    message: 'invalid JWT: [jwt] rejected',
  });
  assertEquals(describeError({ error: { message: 'ExponentPushToken[abc-123] is not registered' } }), {
    code: null,
    message: '[push-token] is not registered',
  });
  assertEquals(describeError({ error: { message: 'ExpoPushToken[xyz_9] is not registered' } }), {
    code: null,
    message: '[push-token] is not registered',
  });
  assertEquals(describeError({ error: { code: 'sb_secret_AbC-12_x', message: 'key sb_secret_AbC-12_x rejected' } }), {
    code: '[secret-key]',
    message: 'key [secret-key] rejected',
  });
});

Deno.test('describeError: 오류 문구에 섞인 줄바꿈·방향 제어 문자를 정리한다(로그 한 줄 — 가짜 로그 줄 끼우기 방지)', () => {
  assertEquals(
    describeError({
      error: { code: '22P02', message: 'invalid input syntax for type uuid: "mk\n[send-muklog-push] 가짜 줄\u202e"' },
    }),
    { code: '22P02', message: 'invalid input syntax for type uuid: "mk [send-muklog-push] 가짜 줄"' },
  );
});

Deno.test('describeError: 각 필드는 200자(코드 포인트)까지만 남긴다 — 가린 뒤에 자른다(토큰 일부가 남지 않게)', () => {
  assertEquals(describeError({ error: { message: 'x'.repeat(500) } }), { code: null, message: 'x'.repeat(200) });
  assertEquals(describeError({ error: { code: 'c'.repeat(300), message: 'm' } }), { code: 'c'.repeat(200), message: 'm' });
  // JWT 가 200자 경계에 걸쳐 있어도 먼저 가리므로 머리·몸통 조각이 로그에 남지 않는다.
  assertEquals(describeError({ error: { message: `${'y'.repeat(190)}${JWT}` } }), {
    code: null,
    message: `${'y'.repeat(190)}[jwt]`,
  });
});

Deno.test('describeError: 정리하고 나면 빈 필드는 null', () => {
  assertEquals(describeError({ error: { code: '\u202e', message: ' \n ' } }), { code: null, message: null });
});

// ── S2-1(보안 QA 2차 · 중간) — 가림 정규식 계산량 · 가림 결과 불변 ─────────────────────────────────
//   공격자가 고른 값(예: 형식이 틀린 roomId)이 Postgres 오류 문구(22P02)로 되돌아오면, 옛 JWT 패턴은 "eyJ" 반복 입력에서
//   입력 길이의 제곱으로 느려졌다(80KB → 십수 초). 고친 뒤: 가리기 전에 한 줄·2000자로 먼저 자르고, 가림 패턴은 실패 뒤
//   되돌아가기가 없는 모양으로, Expo·비밀 키를 JWT 보다 먼저 가린다. 시간 상한 50ms 는 넉넉한 값이다(고친 코드는 수 ms).
const ATTACK_LENGTH = 80_000;
const UUID_ERROR_PREFIX = 'invalid input syntax for type uuid: "';

Deno.test('S2-1: 공격자가 고른 80KB 오류 문구("eyJ"·"ExpoPushToken[" 반복)도 50ms 안에 가림·정리를 끝낸다', () => {
  const expectedByUnit: Record<string, string> = {
    // 마침표 없는 eyJ 덩어리도 JWT 조각으로 보고 가린다(아래 "잘린 JWT" 테스트와 같은 규칙).
    eyJ: `${UUID_ERROR_PREFIX}[jwt]`,
    // 닫는 괄호가 없으면 토큰이 아니다 — 가리지 않고 200자로 자른다.
    'ExpoPushToken[': `${UUID_ERROR_PREFIX}${'ExpoPushToken['.repeat(12)}`.slice(0, 200),
  };
  for (const [unit, expected] of Object.entries(expectedByUnit)) {
    const attack = unit.repeat(Math.ceil(ATTACK_LENGTH / unit.length));
    const started = performance.now();
    const logged = describeError({ error: { code: '22P02', message: `${UUID_ERROR_PREFIX}${attack}"` } });
    const elapsed = performance.now() - started;
    assert(elapsed < 50, `${unit} 반복 ${attack.length}자: ${elapsed.toFixed(1)}ms`);
    assertEquals(logged, { code: '22P02', message: expected });
  }
});

Deno.test('S2-1: 실제 토큰 모양의 가림 결과는 고치기 전과 같다(고치기 전 구현의 출력을 그대로 기대값으로 잠금)', () => {
  const cases: Array<[{ code?: string; message: string }, { code: string | null; message: string | null }]> = [
    [{ message: `invalid JWT: ${JWT} rejected` }, { code: null, message: 'invalid JWT: [jwt] rejected' }],
    [{ message: JWT }, { code: null, message: '[jwt]' }],
    [{ message: `"${JWT}"` }, { code: null, message: '"[jwt]"' }],
    [{ message: `token=${JWT}, retry` }, { code: null, message: 'token=[jwt], retry' }],
    [{ message: `first ${JWT} second ${JWT}` }, { code: null, message: 'first [jwt] second [jwt]' }],
    // 문장 끝 마침표는 토큰이 아니다 — 남긴다.
    [{ message: `token ${JWT}.` }, { code: null, message: 'token [jwt].' }],
    [{ message: `Bearer ${JWT}` }, { code: null, message: 'Bearer [jwt]' }],
    [{ message: `x${JWT}` }, { code: null, message: 'x[jwt]' }],
    [{ message: 'ExponentPushToken[abc-123] is not registered' }, { code: null, message: '[push-token] is not registered' }],
    [
      { message: 'ExpoPushToken[xyz_9] and ExponentPushToken[q] both' },
      { code: null, message: '[push-token] and [push-token] both' },
    ],
    [
      { code: 'sb_secret_AbC-12_x', message: 'key sb_secret_AbC-12_x rejected' },
      { code: '[secret-key]', message: 'key [secret-key] rejected' },
    ],
    [
      { message: `jwt ${JWT} push ExponentPushToken[t1] key sb_secret_k9` },
      { code: null, message: 'jwt [jwt] push [push-token] key [secret-key]' },
    ],
    [{ message: `line1\n${JWT}\u202e tail` }, { code: null, message: 'line1 [jwt] tail' }],
    [{ message: `${'y'.repeat(190)}${JWT}` }, { code: null, message: `${'y'.repeat(190)}[jwt]` }],
    [{ code: 'PGRST301', message: 'JWT expired' }, { code: 'PGRST301', message: 'JWT expired' }],
  ];
  for (const [error, expected] of cases) {
    assertEquals(describeError({ error }), expected, error.message.slice(0, 60));
  }
});

Deno.test('S2-1·S2-4: JWT 바로 뒤에 Expo 토큰이 구분자 없이 붙어도 둘 다 가린다(Expo 를 먼저 가린다)', () => {
  assertEquals(describeError({ error: { message: `${JWT}ExponentPushToken[abc]` } }), {
    code: null,
    message: '[jwt][push-token]',
  });
});

Deno.test('S2-1: 잘린 JWT(마침표가 모자란 머리·몸통 조각)도 가린다 — 옛 패턴은 마침표 두 개를 요구해 그대로 남겼다', () => {
  const [header, payload] = JWT.split('.');
  assertEquals(describeError({ error: { message: `token ${header}.${payload} cut` } }), {
    code: null,
    message: 'token [jwt] cut',
  });
  assertEquals(describeError({ error: { message: `token ${header} cut` } }), { code: null, message: 'token [jwt] cut' });
});
