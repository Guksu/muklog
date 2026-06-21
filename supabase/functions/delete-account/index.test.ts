// supabase/functions/delete-account/index.test.ts
// delete-account 핸들러 Deno 단위 스모크 (plan §2·AC2·AC3). deps 주입으로 인증/삭제 순서/best-effort 검증.
//   ⚠️ Deno 런타임 전용 — jest 대상 아님(package.json testPathIgnorePatterns: /supabase/). 실행: `deno test --allow-env`.
//   실 service_role/auth.admin/RPC 는 키 발급 후 `supabase functions serve` + 디바이스 스모크로 검증.
//   보안 핵심: body 의 userId 는 절대 신뢰하지 않는다 — Authorization JWT → getUserId 로 검증된 본인만 삭제.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleDeleteAccount, type DeleteAccountDeps } from './index.ts';

// 호출 추적을 위한 기본 deps 팩토리. 각 테스트가 필요한 부분만 override.
const makeDeps = (over: Partial<DeleteAccountDeps> = {}): {
  deps: DeleteAccountDeps;
  calls: {
    deletedRooms: string[];
    deletedAvatarFor: string[];
    deletedUser: string[];
  };
} => {
  const calls = { deletedRooms: [] as string[], deletedAvatarFor: [] as string[], deletedUser: [] as string[] };
  const deps: DeleteAccountDeps = {
    getUserId: ({ token }) => Promise.resolve(token === 'valid' ? 'me-uid' : null),
    listSoloRoomIds: () => Promise.resolve([]),
    deleteRoomCascade: ({ roomId }) => {
      calls.deletedRooms.push(roomId);
      return Promise.resolve();
    },
    deleteAvatarObjects: ({ userId }) => {
      calls.deletedAvatarFor.push(userId);
      return Promise.resolve();
    },
    deleteUser: ({ userId }) => {
      calls.deletedUser.push(userId);
      return Promise.resolve();
    },
    ...over,
  };
  return { deps, calls };
};

const reqWith = ({ auth, body }: { auth?: string; body?: unknown }): Request =>
  new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

Deno.test('OPTIONS → CORS preflight 200', async () => {
  const { deps } = makeDeps();
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  // OPTIONS 는 메서드만 본다(별도 Request).
  const optRes = await handleDeleteAccount(
    new Request('http://localhost/delete-account', { method: 'OPTIONS' }),
    deps,
  );
  assertEquals(optRes.status, 200);
  // 본 테스트 부수: 정상 흐름은 아래에서 검증.
  assertEquals(res.status, 200);
});

Deno.test('Authorization 헤더 없음 → 401 UNAUTHENTICATED (본인 미검증 차단)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleDeleteAccount(reqWith({ body: {} }), deps);
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, 'UNAUTHENTICATED');
  // 어떤 삭제도 일어나지 않는다.
  assertEquals(calls.deletedUser.length, 0);
});

Deno.test('JWT 무효(getUserId null) → 401 UNAUTHENTICATED', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer invalid' }), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.deletedUser.length, 0);
});

Deno.test('보안: body 의 userId 를 무시하고 JWT 검증 id(me-uid)만 삭제한다(권한상승 차단)', async () => {
  const { deps, calls } = makeDeps();
  // 공격자가 타인 id 를 본문에 주입해도 무시되어야 한다.
  const res = await handleDeleteAccount(
    reqWith({ auth: 'Bearer valid', body: { userId: 'victim-uid', user_id: 'victim-uid' } }),
    deps,
  );
  assertEquals(res.status, 200);
  assertEquals(calls.deletedUser, ['me-uid']); // victim-uid 아님.
  assertEquals(calls.deletedAvatarFor, ['me-uid']);
});

Deno.test('솔로 룸 → _delete_room_cascade 호출 후 deleteUser (삭제 순서: cascade→avatar→user)', async () => {
  const order: string[] = [];
  const { deps, calls } = makeDeps({
    listSoloRoomIds: () => Promise.resolve(['solo-1', 'solo-2']),
    deleteRoomCascade: ({ roomId }) => {
      order.push(`room:${roomId}`);
      return Promise.resolve();
    },
    deleteAvatarObjects: ({ userId }) => {
      order.push(`avatar:${userId}`);
      return Promise.resolve();
    },
    deleteUser: ({ userId }) => {
      order.push(`user:${userId}`);
      return Promise.resolve();
    },
  });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedUser, []); // calls 객체는 override 로 안 쌓임 — order 로 검증.
  // 순서: 솔로 룸 cascade(둘 다) → 아바타 → deleteUser(마지막).
  assertEquals(order, ['room:solo-1', 'room:solo-2', 'avatar:me-uid', 'user:me-uid']);
});

Deno.test('커플 룸(솔로 목록 비어있음) → 룸 삭제 호출 0, deleteUser 만 (cascade 가 멤버십 제거·익명화)', async () => {
  const { deps, calls } = makeDeps({ listSoloRoomIds: () => Promise.resolve([]) });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedRooms, []); // 커플 룸은 보존(작성자 익명화는 SET NULL).
  assertEquals(calls.deletedUser, ['me-uid']);
});

Deno.test('best-effort: 솔로 룸 cascade 실패해도 deleteUser 는 진행한다(부분 실패 격리)', async () => {
  const { deps, calls } = makeDeps({
    listSoloRoomIds: () => Promise.resolve(['solo-1']),
    deleteRoomCascade: () => Promise.reject(new Error('STORAGE_PERMISSION_DENIED')),
  });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedUser, ['me-uid']); // 핵심 삭제는 계속.
});

Deno.test('best-effort: 아바타 삭제 실패해도 deleteUser 는 진행한다', async () => {
  const { deps, calls } = makeDeps({
    deleteAvatarObjects: () => Promise.reject(new Error('AVATAR_DELETE_FAILED')),
  });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedUser, ['me-uid']);
});

Deno.test('핵심 실패: deleteUser 실패 → 500 DELETE_FAILED (재시도 가능, 세션 유지)', async () => {
  const { deps } = makeDeps({
    deleteUser: () => Promise.reject(new Error('boom')),
  });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, 'DELETE_FAILED');
});

Deno.test('listSoloRoomIds 실패해도(조회 단계 best-effort) deleteUser 는 진행한다', async () => {
  const { deps, calls } = makeDeps({
    listSoloRoomIds: () => Promise.reject(new Error('QUERY_FAILED')),
  });
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedUser, ['me-uid']);
});

Deno.test('성공 응답에 시크릿/토큰 미포함 + { deleted:true }', async () => {
  const { deps } = makeDeps();
  const res = await handleDeleteAccount(reqWith({ auth: 'Bearer valid' }), deps);
  const text = await res.clone().text();
  assertEquals(text.includes('valid'), false); // 토큰 미반향.
  assertEquals((await res.json()).deleted, true);
});
