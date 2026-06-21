// supabase/functions/delete-account/index.ts
// account-deletion 스프린트: 인앱 회원 탈퇴(계정 삭제, Apple 5.1.1(v)) Edge Function (service_role).
//   plan §2 — Authorization JWT 로 검증된 **본인** id 만 삭제. 솔로 룸=cascade 삭제(best-effort),
//   커플 룸=보존(profile cascade 가 멤버십 제거, FK SET NULL 이 작성자 익명화), 아바타 best-effort 삭제,
//   마지막에 auth.admin.deleteUser(본인) → profiles ON DELETE CASCADE 로 멤버십·기기토큰 정리 + created_by/added_by SET NULL.
//
// ⚠️ 보안 최우선(plan §2·리스크): 요청 body 의 userId 를 **절대 신뢰하지 않는다**. 본인 식별은
//    Authorization 헤더의 JWT → auth.getUser() 검증 id 만. 미인증/무효 토큰 → 401(권한상승 차단).
// ⚠️ SUPABASE_SERVICE_ROLE_KEY 는 **함수 환경변수에서만** 참조 — 응답/로그/클라이언트 번들에 절대 미노출(시크릿 규칙).
// ⚠️ Deno 런타임(Supabase Edge). 앱 jest/tsc 대상 아님(tsconfig exclude). 실 검증: `supabase functions serve` + 디바이스 스모크.
//    실 service_role / auth.admin / RPC 는 키 발급 후 라이브 스모크(developer 는 배포 금지 — 사용자 전담).
//
// 환경변수: SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · SUPABASE_ANON_KEY (Edge 기본 주입 + secrets).
// 인증: verify_jwt = true 권장(config.toml) — 함수 내부에서도 getUser()로 본인 재검증(이중 방어).
//
// 부분 실패(plan §2-7): 솔로 룸 cascade / 아바타 삭제 / 룸 조회 는 best-effort(실패 시 로그만, 핵심 삭제 진행).
//   deleteUser(핵심·최종) 실패만 500 DELETE_FAILED 반환(재시도 가능, 세션 유지).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AVATARS_BUCKET = 'avatars';
// muklog-photos 버킷 정리는 _delete_room_cascade(DB 함수) 내부에서 처리(여기선 직접 참조 불필요).

/**
 * 핸들러가 의존하는 외부 작업(주입 가능). Deno 테스트가 모킹하고, serve 진입점은 실 Supabase 로 구성한다.
 *   getUserId       : Authorization 토큰 → 검증된 본인 user id(무효면 null). 본문 userId 미사용.
 *   listSoloRoomIds : 본인만 멤버인(솔로) 룸 id 목록. 커플 룸은 제외(보존).
 *   deleteRoomCascade: 솔로 룸 1개 전체 삭제(_delete_room_cascade RPC 재사용 — 룸+하위+Storage 메타).
 *   deleteAvatarObjects: 본인 아바타 Storage 객체 정리(best-effort).
 *   deleteUser      : auth.admin.deleteUser(본인) — profiles cascade 발화(핵심·최종).
 */
export type DeleteAccountDeps = {
  getUserId: (args: { token: string }) => Promise<string | null>;
  listSoloRoomIds: (args: { userId: string }) => Promise<string[]>;
  deleteRoomCascade: (args: { roomId: string }) => Promise<void>;
  deleteAvatarObjects: (args: { userId: string }) => Promise<void>;
  deleteUser: (args: { userId: string }) => Promise<void>;
};

/**
 * JSON 응답을 CORS 헤더와 함께 만든다.
 * @param body 응답 본문
 * @param status HTTP 상태코드
 * @returns Response
 */
const jsonResponse = ({ body, status }: { body: unknown; status: number }): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

/**
 * Authorization 헤더에서 Bearer 토큰을 추출한다(없으면 null).
 * @param req 들어온 Request
 * @returns JWT 문자열 또는 null
 */
const extractBearer = ({ req }: { req: Request }): string | null => {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

/**
 * 회원 탈퇴 요청을 처리한다. 핸들러를 분리 export 해 Deno 테스트에서 deps 모킹으로 단위 검증한다.
 *   1) OPTIONS preflight  2) JWT 본인 검증(미인증 401)  3) 솔로 룸 cascade(best-effort)
 *   4) 아바타 삭제(best-effort)  5) deleteUser(핵심, 실패만 500).
 * @param req 들어온 Request
 * @param deps 외부 작업 의존성(주입)
 * @returns Response
 */
export const handleDeleteAccount = async (
  req: Request,
  deps: DeleteAccountDeps,
): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS_HEADERS });

  // 본인 식별: Authorization JWT 만 신뢰. body 의 userId 류는 읽지도 않는다(권한상승 차단).
  const token = extractBearer({ req });
  if (!token) return jsonResponse({ body: { error: 'UNAUTHENTICATED' }, status: 401 });

  let userId: string | null;
  try {
    userId = await deps.getUserId({ token });
  } catch {
    userId = null;
  }
  if (!userId) return jsonResponse({ body: { error: 'UNAUTHENTICATED' }, status: 401 });

  // (3) 솔로 룸 cascade — best-effort. 조회/삭제 실패가 핵심 삭제를 막지 않는다(부분 실패 격리, plan §2-7).
  try {
    const soloRoomIds = await deps.listSoloRoomIds({ userId });
    for (const roomId of soloRoomIds) {
      try {
        await deps.deleteRoomCascade({ roomId });
      } catch (err) {
        // best-effort: 룸 1개 삭제 실패는 로그만(고아 룸은 후속 정리). 다음 룸·핵심 삭제 진행.
        console.warn('delete-account: solo room cascade skipped', roomId, String(err));
      }
    }
  } catch (err) {
    console.warn('delete-account: solo room listing skipped', String(err));
  }

  // (4) 아바타 Storage 삭제 — best-effort(파일 고아는 후속 GC).
  try {
    await deps.deleteAvatarObjects({ userId });
  } catch (err) {
    console.warn('delete-account: avatar cleanup skipped', String(err));
  }

  // (5) 핵심·최종: auth.admin.deleteUser → profiles cascade(멤버십·기기토큰 삭제, created_by/added_by SET NULL).
  try {
    await deps.deleteUser({ userId });
  } catch (err) {
    // 핵심 실패만 사용자 에러(재시도 가능). 토큰/시크릿은 응답에 싣지 않는다.
    console.error('delete-account: deleteUser failed', String(err));
    return jsonResponse({ body: { error: 'DELETE_FAILED' }, status: 500 });
  }

  return jsonResponse({ body: { deleted: true }, status: 200 });
};

// =====================================================================
// 실 Supabase 구성(serve 진입점) — service_role 클라이언트로 deps 구현.
//   ⚠️ service_role 키는 env 에서만. 응답/로그에 미노출.
// =====================================================================

/**
 * 환경변수에서 실 Supabase deps 를 구성한다(serve 전용). 테스트는 이 경로를 타지 않는다.
 * @returns DeleteAccountDeps (실 service_role 클라이언트 기반)
 */
const buildRealDeps = (): DeleteAccountDeps => {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  const supabaseUrl = env?.get('SUPABASE_URL') as string;
  const serviceRoleKey = env?.get('SUPABASE_SERVICE_ROLE_KEY') as string;

  // service_role 클라이언트(RLS 우회) — 룸 조회·RPC·storage·admin 전용.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    // 토큰 검증: getUser(token) 가 토큰 주체를 돌려준다(본문 신뢰 금지의 핵심).
    getUserId: async ({ token }) => {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return null;
      return data.user.id;
    },
    // 솔로 룸 = 본인이 멤버이면서 멤버 수 1(본인뿐)인 룸. service_role 로 직접 집계.
    listSoloRoomIds: async ({ userId }) => {
      const { data: myRows, error: myErr } = await admin
        .from('room_members')
        .select('room_id')
        .eq('user_id', userId);
      if (myErr || !myRows) return [];
      const roomIds = myRows.map((r: { room_id: string }) => r.room_id);
      if (roomIds.length === 0) return [];

      // 해당 룸들의 전체 멤버십 조회 후 룸별 카운트 — 멤버 수 1 인 룸만 솔로.
      const { data: allRows, error: allErr } = await admin
        .from('room_members')
        .select('room_id')
        .in('room_id', roomIds);
      if (allErr || !allRows) return [];
      const counts = new Map<string, number>();
      for (const row of allRows as { room_id: string }[]) {
        counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1);
      }
      return roomIds.filter((id) => counts.get(id) === 1);
    },
    // 솔로 룸 전체 삭제 — 기존 _delete_room_cascade(SECURITY DEFINER) 재사용(룸+하위 cascade + Storage 메타 best-effort).
    deleteRoomCascade: async ({ roomId }) => {
      const { error } = await admin.rpc('_delete_room_cascade', { p_room_id: roomId });
      if (error) throw error;
    },
    // 아바타: avatars/{userId}/* 객체 목록 후 일괄 remove(best-effort).
    deleteAvatarObjects: async ({ userId }) => {
      const { data: list, error: listErr } = await admin.storage
        .from(AVATARS_BUCKET)
        .list(userId);
      if (listErr || !list || list.length === 0) return;
      const paths = list.map((obj: { name: string }) => `${userId}/${obj.name}`);
      const { error: rmErr } = await admin.storage.from(AVATARS_BUCKET).remove(paths);
      if (rmErr) throw rmErr;
    },
    // 핵심: auth.admin.deleteUser — profiles ON DELETE CASCADE 발화.
    deleteUser: async ({ userId }) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };
};

// Supabase Edge(Deno) 진입점 — 실 deps 로 핸들러 서빙.
// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve?.((req: Request) => handleDeleteAccount(req, buildRealDeps()));
