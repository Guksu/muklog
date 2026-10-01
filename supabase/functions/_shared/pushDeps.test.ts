// supabase/functions/_shared/pushDeps.test.ts
// 실제 조회·RPC·Expo 호출 계약 (join-push plan AC12 · DT4). 외부 SDK 자체가 아니라 "우리가 무엇을 어떤 인자로 부르는지"를 본다.
//   가짜 클라이언트: 메서드 호출을 순서대로 기록하고, 마지막 단계(maybeSingle·rpc·await)에서 정해 둔 { data, error } 를 돌려준다.
//   supabase-js 처럼 필터 빌더(eq)는 자기 자신을 돌려주고, delete().eq() 는 그대로 await 된다(thenable).
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { createPushDeps, type PushAdminClient } from './pushDeps.ts';
import type { ExpoPushMessage } from './pushDelivery.ts';

type Result = { data: unknown; error: unknown };
type Call = unknown[];

const makeClient = ({
  result = { data: null, error: null },
  authResult = { data: { user: null }, error: null },
}: {
  result?: Result;
  authResult?: { data: { user: { id: string } | null }; error: unknown };
}) => {
  const calls: Call[] = [];
  const chain = {
    select: (...args: unknown[]) => {
      calls.push(['select', ...args]);
      return chain;
    },
    delete: (...args: unknown[]) => {
      calls.push(['delete', ...args]);
      return chain;
    },
    eq: (...args: unknown[]) => {
      calls.push(['eq', ...args]);
      return chain;
    },
    maybeSingle: (...args: unknown[]) => {
      calls.push(['maybeSingle', ...args]);
      return Promise.resolve(result);
    },
    // delete().eq() 를 바로 await 하는 경로(supabase-js 필터 빌더는 thenable).
    then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  const client = {
    auth: {
      getUser: (jwt: string) => {
        calls.push(['auth.getUser', jwt]);
        return Promise.resolve(authResult);
      },
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push(['rpc', fn, args]);
      return Promise.resolve(result);
    },
    from: (relation: string) => {
      calls.push(['from', relation]);
      return chain;
    },
  };
  return { client: client as unknown as PushAdminClient, calls };
};

const noFetch: typeof fetch = () => Promise.reject(new Error('fetch 금지'));

const depsWith = ({ client }: { client: PushAdminClient }) =>
  createPushDeps({ client, fetchImpl: noFetch });

// ── getOwnMuklogPlaceName (위조 muklogId 차단의 근거) ───────────────────────────

Deno.test('getOwnMuklogPlaceName: muklogs 에서 id·room_id·created_by 세 조건 + maybeSingle 로 읽는다', async () => {
  const { client, calls } = makeClient({ result: { data: { place_name: '을지로 노포' }, error: null } });
  const placeName = await depsWith({ client }).getOwnMuklogPlaceName({
    muklogId: 'm1',
    roomId: 'r1',
    userId: 'u1',
  });
  assertEquals(placeName, '을지로 노포');
  assertEquals(calls, [
    ['from', 'muklogs'],
    ['select', 'place_name'],
    ['eq', 'id', 'm1'],
    ['eq', 'room_id', 'r1'],
    ['eq', 'created_by', 'u1'],
    ['maybeSingle'],
  ]);
});

Deno.test('getOwnMuklogPlaceName: 행이 없으면 null(다른 로그·다른 작성자·없는 id)', async () => {
  const { client } = makeClient({ result: { data: null, error: null } });
  assertEquals(
    await depsWith({ client }).getOwnMuklogPlaceName({ muklogId: 'm1', roomId: 'r1', userId: 'u1' }),
    null,
  );
});

Deno.test('getOwnMuklogPlaceName: 조회 오류면 reject(핸들러가 fail closed)', async () => {
  const { client } = makeClient({ result: { data: null, error: { message: 'invalid input syntax for type uuid' } } });
  await assertRejects(() =>
    depsWith({ client }).getOwnMuklogPlaceName({ muklogId: 'bad', roomId: 'r1', userId: 'u1' })
  );
});

// ── claimJoinPush (1회 보장) ────────────────────────────────────────────────

Deno.test('claimJoinPush: rpc("claim_join_push", { p_room_id, p_user_id }) — data true 일 때만 true', async () => {
  const { client, calls } = makeClient({ result: { data: true, error: null } });
  assertEquals(await depsWith({ client }).claimJoinPush({ roomId: 'r1', userId: 'u1' }), true);
  assertEquals(calls, [['rpc', 'claim_join_push', { p_room_id: 'r1', p_user_id: 'u1' }]]);
});

Deno.test('claimJoinPush: data false·null·문자열 "true" 는 false', async () => {
  for (const data of [false, null, 'true']) {
    const { client } = makeClient({ result: { data, error: null } });
    assertEquals(await depsWith({ client }).claimJoinPush({ roomId: 'r1', userId: 'u1' }), false);
  }
});

Deno.test('claimJoinPush: RPC 오류면 reject(핸들러가 fail closed — 마이그레이션 미적용 포함)', async () => {
  const { client } = makeClient({ result: { data: null, error: { message: 'function does not exist' } } });
  await assertRejects(() => depsWith({ client }).claimJoinPush({ roomId: 'r1', userId: 'u1' }));
});

// ── listPushTargets ─────────────────────────────────────────────────────────

Deno.test('listPushTargets: rpc("list_room_push_targets", { p_room_id, p_actor }) 행을 { expoPushToken, platform } 으로', async () => {
  const { client, calls } = makeClient({
    result: { data: [{ expo_push_token: 'ExponentPushToken[a]', platform: 'ios' }], error: null },
  });
  assertEquals(await depsWith({ client }).listPushTargets({ roomId: 'r1', actorId: 'u1' }), [
    { expoPushToken: 'ExponentPushToken[a]', platform: 'ios' },
  ]);
  assertEquals(calls, [['rpc', 'list_room_push_targets', { p_room_id: 'r1', p_actor: 'u1' }]]);
});

Deno.test('listPushTargets: 오류·배열 아님이면 빈 배열', async () => {
  const failed = makeClient({ result: { data: null, error: { message: 'x' } } });
  assertEquals(await depsWith({ client: failed.client }).listPushTargets({ roomId: 'r1', actorId: 'u1' }), []);
  const odd = makeClient({ result: { data: { expo_push_token: 't' }, error: null } });
  assertEquals(await depsWith({ client: odd.client }).listPushTargets({ roomId: 'r1', actorId: 'u1' }), []);
});

// ── getActorNickname · getRoomName ─────────────────────────────────────────

Deno.test('getActorNickname: profiles.nickname 을 id 로 읽는다(오류·없음 → null)', async () => {
  const ok = makeClient({ result: { data: { nickname: '민지' }, error: null } });
  assertEquals(await depsWith({ client: ok.client }).getActorNickname({ userId: 'u1' }), '민지');
  assertEquals(ok.calls, [['from', 'profiles'], ['select', 'nickname'], ['eq', 'id', 'u1'], ['maybeSingle']]);

  const failed = makeClient({ result: { data: null, error: { message: 'x' } } });
  assertEquals(await depsWith({ client: failed.client }).getActorNickname({ userId: 'u1' }), null);
  const empty = makeClient({ result: { data: { nickname: null }, error: null } });
  assertEquals(await depsWith({ client: empty.client }).getActorNickname({ userId: 'u1' }), null);
});

Deno.test('getRoomName: rooms.name 을 id 로 읽는다(오류·없음 → null)', async () => {
  const ok = makeClient({ result: { data: { name: '우리의 맛집' }, error: null } });
  assertEquals(await depsWith({ client: ok.client }).getRoomName({ roomId: 'r1' }), '우리의 맛집');
  assertEquals(ok.calls, [['from', 'rooms'], ['select', 'name'], ['eq', 'id', 'r1'], ['maybeSingle']]);

  const missing = makeClient({ result: { data: null, error: null } });
  assertEquals(await depsWith({ client: missing.client }).getRoomName({ roomId: 'r1' }), null);
});

// ── deleteToken ─────────────────────────────────────────────────────────────

Deno.test('deleteToken: device_tokens 에서 expo_push_token 일치 행 삭제(오류면 reject)', async () => {
  const ok = makeClient({ result: { data: null, error: null } });
  await depsWith({ client: ok.client }).deleteToken({ expoPushToken: 'ExponentPushToken[dead]' });
  assertEquals(ok.calls, [['from', 'device_tokens'], ['delete'], ['eq', 'expo_push_token', 'ExponentPushToken[dead]']]);

  const failed = makeClient({ result: { data: null, error: { message: 'x' } } });
  await assertRejects(() => depsWith({ client: failed.client }).deleteToken({ expoPushToken: 't' }));
});

// ── getUserId ───────────────────────────────────────────────────────────────

Deno.test('getUserId: auth.getUser(token) 의 user.id(오류·user 없음 → null)', async () => {
  const ok = makeClient({ authResult: { data: { user: { id: 'caller-uid' } }, error: null } });
  assertEquals(await depsWith({ client: ok.client }).getUserId({ token: 'jwt' }), 'caller-uid');
  assertEquals(ok.calls, [['auth.getUser', 'jwt']]);

  const failed = makeClient({ authResult: { data: { user: null }, error: { message: 'invalid' } } });
  assertEquals(await depsWith({ client: failed.client }).getUserId({ token: 'jwt' }), null);
  const noUser = makeClient({ authResult: { data: { user: null }, error: null } });
  assertEquals(await depsWith({ client: noUser.client }).getUserId({ token: 'jwt' }), null);
});

// ── sendExpoPush ────────────────────────────────────────────────────────────

const pushMessage: ExpoPushMessage = {
  to: 'ExponentPushToken[a]',
  title: '우리 로그',
  body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.',
  sound: 'default',
  data: { type: 'member_joined', roomId: 'r1' },
};

Deno.test('sendExpoPush: Expo push/send 에 POST + JSON 본문(메시지 배열), 응답 data 배열을 티켓으로', async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    seen.push({ url: String(input), init });
    return Promise.resolve(new Response(JSON.stringify({ data: [{ status: 'ok' }] })));
  };
  const { client } = makeClient({});
  const tickets = await createPushDeps({ client, fetchImpl }).sendExpoPush({ messages: [pushMessage] });
  assertEquals(tickets, [{ status: 'ok' }]);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].url, 'https://exp.host/--/api/v2/push/send');
  assertEquals(seen[0].init?.method, 'POST');
  assertEquals(seen[0].init?.headers, { Accept: 'application/json', 'Content-Type': 'application/json' });
  assertEquals(JSON.parse(String(seen[0].init?.body)), [pushMessage]);
});

Deno.test('sendExpoPush: 응답에 data 배열이 없으면 빈 티켓', async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(new Response(JSON.stringify({ errors: [{ code: 'X' }] }), { status: 400 }));
  const { client } = makeClient({});
  assertEquals(await createPushDeps({ client, fetchImpl }).sendExpoPush({ messages: [pushMessage] }), []);
});
