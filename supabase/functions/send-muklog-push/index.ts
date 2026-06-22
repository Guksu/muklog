// supabase/functions/send-muklog-push/index.ts
// push-send 스프린트(S2): 새 먹로그 등록 시 같은 로그의 *상대*에게 푸시 알림을 발송하는 Edge Function (service_role).
//   plan §2 — Authorization JWT 로 검증된 callerId 만 신뢰. body 의 userId 류는 절대 읽지 않는다(권한상승/스팸 차단).
//   list_room_push_targets(roomId, callerId) 의 멤버십 게이트가 "타인 룸에 발송" 을 막고, 수신자 prefs(master/room)
//   가 발송을 게이팅한다(수신자 설정이 실제 발송을 차단 — 이 스프린트 핵심).
//
// ⚠️ 보안 최우선(plan §2·리스크):
//    · 본인 식별 = Authorization JWT → getUserId 검증 callerId 만(body userId 미사용). 미인증 → 401.
//    · SUPABASE_SERVICE_ROLE_KEY 는 **함수 env 에서만** 참조 — 응답/로그/클라이언트에 절대 미노출(시크릿 규칙).
//    · Expo 푸시 토큰은 service_role 경계 안에서만 사용 — **응답에 절대 반환하지 않는다**(토큰 클라 미노출).
// ⚠️ Deno 런타임(Supabase Edge). 앱 jest/tsc 대상 아님(tsconfig·jest 모두 /supabase/ exclude).
//    실 검증: `deno test`(deps 모킹) + `supabase functions serve` + 디바이스 스모크.
//
// 환경변수: SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (Edge 기본 주입). verify_jwt = true(인증 사용자만).
//
// best-effort(plan §2): 먹로그 저장은 이미 끝났으므로 발송 실패는 사용자 에러가 아니다 — 네트워크/Expo 에러는
//   로그만(200 유지). 수신자 0건 = 200 no-op. ticket.DeviceNotRegistered 토큰은 best-effort 삭제(무효 토큰 정리, 격리).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FALLBACK_TITLE = '새 먹로그';
const FALLBACK_AUTHOR = '연인';

/** list_room_push_targets RPC 반환 1건(수신자 토큰). 토큰은 service_role 경계 안에서만 사용. */
export type PushTarget = { expoPushToken: string; platform: string };

/** Expo Push API 메시지 1건(우리가 보내는 필드만). */
export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { roomId: string; muklogId: string };
};

/** Expo Push API 응답 ticket 1건(우리가 보는 필드만). DeviceNotRegistered 판정용. */
export type ExpoPushTicket = {
  status?: string;
  details?: { error?: string };
};

/**
 * 핸들러가 의존하는 외부 작업(주입 가능). Deno 테스트가 모킹하고, serve 진입점은 실 Supabase 로 구성한다.
 *   getUserId        : Authorization 토큰 → 검증된 callerId(무효면 null). 본문 userId 미사용.
 *   listPushTargets  : list_room_push_targets(roomId, actorId) — 멤버십 게이트 + 수신자 prefs 게이팅된 토큰만.
 *   getActorNickname : 작성자 닉네임(본문 카피, 없으면 null).
 *   getRoomName      : 로그 이름(title, 없으면 null → 폴백).
 *   sendExpoPush     : Expo Push API 호출(메시지 배열 → ticket 배열).
 *   deleteToken      : 무효 토큰(DeviceNotRegistered) best-effort 삭제.
 */
export type SendPushDeps = {
  getUserId: (args: { token: string }) => Promise<string | null>;
  listPushTargets: (args: { roomId: string; actorId: string }) => Promise<PushTarget[]>;
  getActorNickname: (args: { userId: string }) => Promise<string | null>;
  getRoomName: (args: { roomId: string }) => Promise<string | null>;
  sendExpoPush: (args: { messages: ExpoPushMessage[] }) => Promise<ExpoPushTicket[]>;
  deleteToken: (args: { expoPushToken: string }) => Promise<void>;
};

/**
 * JSON 응답을 CORS 헤더와 함께 만든다. 토큰/시크릿은 절대 싣지 않는다.
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
 * 발송 본문 카피를 만든다(해요체). 닉네임 없으면 "연인", 로그명 없으면 폴백 title.
 * @param nickname 작성자 닉네임(또는 null)
 * @param roomName 로그 이름(또는 null)
 * @returns title/body 카피
 */
const buildCopy = ({
  nickname,
  roomName,
}: {
  nickname: string | null;
  roomName: string | null;
}): { title: string; body: string } => {
  const author = nickname && nickname.trim().length > 0 ? nickname.trim() : FALLBACK_AUTHOR;
  const title = roomName && roomName.trim().length > 0 ? roomName.trim() : FALLBACK_TITLE;
  return { title, body: `${author}님이 새 맛집을 기록했어요 🍽️` };
};

/**
 * 새 먹로그 푸시 발송을 처리한다. 핸들러를 분리 export 해 Deno 테스트에서 deps 모킹으로 단위 검증한다.
 *   1) OPTIONS preflight  2) JWT callerId 검증(미인증 401)  3) body roomId/muklogId(roomId 필수)
 *   4) listPushTargets(멤버십·prefs 게이팅, 0건이면 no-op)  5) 카피 빌드  6) Expo 발송(best-effort)
 *   7) DeviceNotRegistered 토큰 best-effort 삭제. 발송 결과는 항상 200(저장은 이미 끝남) — 토큰 미반환.
 * @param req 들어온 Request
 * @param deps 외부 작업 의존성(주입)
 * @returns Response
 */
export const handleSendMuklogPush = async (
  req: Request,
  deps: SendPushDeps,
): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS_HEADERS });

  // 본인 식별: Authorization JWT 만 신뢰. body 의 userId/p_actor 류는 읽지도 않는다(스팸/권한상승 차단).
  const token = extractBearer({ req });
  if (!token) return jsonResponse({ body: { error: 'UNAUTHENTICATED' }, status: 401 });

  let callerId: string | null;
  try {
    callerId = await deps.getUserId({ token });
  } catch {
    callerId = null;
  }
  if (!callerId) return jsonResponse({ body: { error: 'UNAUTHENTICATED' }, status: 401 });

  // 권한은 roomId 멤버십(아래 listPushTargets 의 게이트)으로 판정. muklogId 는 data/로깅용.
  let parsed: { roomId?: unknown; muklogId?: unknown };
  try {
    parsed = (await req.json()) as { roomId?: unknown; muklogId?: unknown };
  } catch {
    parsed = {};
  }
  const roomId = typeof parsed.roomId === 'string' ? parsed.roomId : '';
  const muklogId = typeof parsed.muklogId === 'string' ? parsed.muklogId : '';
  if (!roomId) return jsonResponse({ body: { error: 'BAD_REQUEST' }, status: 400 });

  // (4) 수신 토큰 조회 — 멤버십 게이트(비멤버 actor=빈 결과) + 수신자 prefs 게이팅(master/room off 제외).
  //   조회 실패는 best-effort(발송 못해도 저장은 끝남) → no-op 200.
  let targets: PushTarget[] = [];
  try {
    targets = await deps.listPushTargets({ roomId, actorId: callerId });
  } catch (err) {
    console.warn('send-muklog-push: target listing skipped', String(err));
    return jsonResponse({ body: { sent: 0 }, status: 200 });
  }
  if (targets.length === 0) return jsonResponse({ body: { sent: 0 }, status: 200 });

  // (5) 카피 — 작성자 닉/로그명 조회 best-effort(실패 시 폴백 카피).
  let nickname: string | null = null;
  let roomName: string | null = null;
  try {
    nickname = await deps.getActorNickname({ userId: callerId });
  } catch (err) {
    console.warn('send-muklog-push: nickname lookup skipped', String(err));
  }
  try {
    roomName = await deps.getRoomName({ roomId });
  } catch (err) {
    console.warn('send-muklog-push: room name lookup skipped', String(err));
  }
  const { title, body } = buildCopy({ nickname, roomName });

  const messages: ExpoPushMessage[] = targets.map((t) => ({
    to: t.expoPushToken,
    title,
    body,
    sound: 'default',
    data: { roomId, muklogId },
  }));

  // (6) Expo 발송 — best-effort. 네트워크/Expo 에러는 로그만(저장은 이미 끝남), 200 유지.
  let tickets: ExpoPushTicket[] = [];
  try {
    tickets = await deps.sendExpoPush({ messages });
  } catch (err) {
    console.warn('send-muklog-push: expo push failed', String(err));
    return jsonResponse({ body: { sent: 0 }, status: 200 });
  }

  // (7) DeviceNotRegistered ticket → 해당 토큰 best-effort 삭제(무효 토큰 정리, 격리 — 삭제 실패는 무시).
  //   ticket 순서는 messages 순서와 1:1(Expo 계약). 길이 불일치는 방어적으로 min 까지만.
  const count = Math.min(tickets.length, messages.length);
  for (let i = 0; i < count; i += 1) {
    if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
      try {
        await deps.deleteToken({ expoPushToken: messages[i].to });
      } catch (err) {
        console.warn('send-muklog-push: dead token cleanup skipped', String(err));
      }
    }
  }

  // 토큰/시크릿 미반환 — 발송 건수만(클라는 fire-and-forget 이라 결과를 보지 않음).
  return jsonResponse({ body: { sent: messages.length }, status: 200 });
};

// =====================================================================
// 실 Supabase 구성(serve 진입점) — service_role 클라이언트로 deps 구현.
//   ⚠️ service_role 키는 env 에서만. 응답/로그에 미노출. 토큰은 응답에 싣지 않는다.
// =====================================================================

/**
 * 환경변수에서 실 Supabase deps 를 구성한다(serve 전용). 테스트는 이 경로를 타지 않는다.
 * @returns SendPushDeps (실 service_role 클라이언트 기반)
 */
const buildRealDeps = (): SendPushDeps => {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  const supabaseUrl = env?.get('SUPABASE_URL') as string;
  const serviceRoleKey = env?.get('SUPABASE_SERVICE_ROLE_KEY') as string;

  // service_role 클라이언트(RLS 우회) — DEFINER RPC·prefs/profiles/rooms 조회·토큰 삭제 전용.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    getUserId: async ({ token }) => {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return null;
      return data.user.id;
    },
    // 멤버십 게이트 + 수신자 prefs 게이팅은 RPC 본문이 수행(plan §1). 토큰은 여기서만 머문다.
    listPushTargets: async ({ roomId, actorId }) => {
      const { data, error } = await admin.rpc('list_room_push_targets', {
        p_room_id: roomId,
        p_actor: actorId,
      });
      if (error || !data) return [];
      return (data as { expo_push_token: string; platform: string }[]).map((row) => ({
        expoPushToken: row.expo_push_token,
        platform: row.platform,
      }));
    },
    getActorNickname: async ({ userId }) => {
      const { data, error } = await admin
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return (data as { nickname: string | null }).nickname ?? null;
    },
    getRoomName: async ({ roomId }) => {
      const { data, error } = await admin
        .from('rooms')
        .select('name')
        .eq('id', roomId)
        .maybeSingle();
      if (error || !data) return null;
      return (data as { name: string | null }).name ?? null;
    },
    // Expo Push API — 메시지 배열을 한 번에 전송. data.data 가 ticket 배열(없으면 빈).
    sendExpoPush: async ({ messages }) => {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as { data?: ExpoPushTicket[] };
      return Array.isArray(json?.data) ? json.data : [];
    },
    // 무효 토큰 정리 — expo_push_token UNIQUE 라 1행. service_role 로 직접 삭제.
    deleteToken: async ({ expoPushToken }) => {
      const { error } = await admin.from('device_tokens').delete().eq('expo_push_token', expoPushToken);
      if (error) throw error;
    },
  };
};

// Supabase Edge(Deno) 진입점 — 실 deps 로 핸들러 서빙.
// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve?.((req: Request) => handleSendMuklogPush(req, buildRealDeps()));
