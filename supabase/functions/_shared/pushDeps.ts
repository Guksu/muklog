// supabase/functions/_shared/pushDeps.ts
// 발송 함수 두 개의 실제 외부 작업(조회·RPC·Expo 호출) 구현 (join-push plan §5.4 · AC12).
//   service_role 클라이언트는 주입받는다(createAdminClient) — 이 파일은 supabase-js 를 import 하지 않아
//   테스트가 원격 모듈 없이 가짜 클라이언트로 호출 계약을 확인한다(pushDeps.test.ts).
//   ⚠️ 토큰은 이 경계 안에서만 쓴다 — 응답·로그에 싣지 않는다.
import type { ExpoPushTicket, PushBaseDeps } from './pushDelivery.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** 쿼리·RPC 결과(우리가 보는 필드만). */
type QueryResult = { data: unknown; error: unknown };

/** 필터 빌더(우리가 쓰는 메서드만). supabase-js 처럼 eq 는 자기 자신을 돌려주고 그대로 await 할 수 있다. */
type FilterChain = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => FilterChain;
  maybeSingle: () => PromiseLike<QueryResult>;
};

/** service_role 클라이언트 중 이 파일이 쓰는 부분만 담은 최소 구조 타입. */
export type PushAdminClient = {
  auth: {
    getUser: (jwt: string) => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<QueryResult>;
  from: (relation: string) => {
    select: (columns: string) => FilterChain;
    delete: () => FilterChain;
  };
};

/** 두 핸들러의 deps 를 모두 만족하는 실제 구현 묶음. */
export type PushDeps = PushBaseDeps & {
  claimJoinPush: (args: { roomId: string; userId: string }) => Promise<boolean>;
  getOwnMuklogPlaceName: (args: {
    muklogId: string;
    roomId: string;
    userId: string;
  }) => Promise<string | null>;
};

/** list_room_push_targets RPC 반환 행(snake_case). */
type PushTargetRow = { expo_push_token: string; platform: string };

/**
 * 실제 조회·RPC·Expo 호출로 발송 deps 를 만든다.
 * @param client service_role 클라이언트(RLS 우회 — 서버 전용)
 * @param fetchImpl Expo Push API 호출에 쓸 fetch
 * @returns send-join-push·send-muklog-push 핸들러 deps 를 모두 만족하는 객체
 */
export const createPushDeps = ({
  client,
  fetchImpl,
}: {
  client: PushAdminClient;
  fetchImpl: typeof fetch;
}): PushDeps => ({
  getUserId: async ({ token }) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  },

  // 멤버십 게이트(actor 가 멤버가 아니면 빈 결과) + 수신 설정 게이팅은 RPC 본문이 한다. 오류면 빈 배열(보내지 않음).
  listPushTargets: async ({ roomId, actorId }) => {
    const { data, error } = await client.rpc('list_room_push_targets', {
      p_room_id: roomId,
      p_actor: actorId,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as PushTargetRow[]).map((row) => ({
      expoPushToken: row.expo_push_token,
      platform: row.platform,
    }));
  },

  getActorNickname: async ({ userId }) => {
    const { data, error } = await client
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { nickname: string | null }).nickname ?? null;
  },

  getRoomName: async ({ roomId }) => {
    const { data, error } = await client.from('rooms').select('name').eq('id', roomId).maybeSingle();
    if (error || !data) return null;
    return (data as { name: string | null }).name ?? null;
  },

  // 위조 muklogId 차단 — 이 로그(roomId)에 caller 가 직접 쓴 기록일 때만 가게명을 돌려준다.
  //   세 조건 중 하나라도 어긋나면 행 없음(null → 핸들러가 보내지 않음). 조회 오류는 throw(fail closed).
  getOwnMuklogPlaceName: async ({ muklogId, roomId, userId }) => {
    const { data, error } = await client
      .from('muklogs')
      .select('place_name')
      .eq('id', muklogId)
      .eq('room_id', roomId)
      .eq('created_by', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const placeName = (data as { place_name: unknown }).place_name;
    // place_name 은 NOT NULL 이라 문자열이 아닐 수 없다 — 그래도 검증은 통과한 것이므로 빈 값(폴백 본문)으로 돌린다.
    return typeof placeName === 'string' ? placeName : '';
  },

  // 합류 알림 발송권(1회) — claim_join_push 가 조건 확인과 기록을 한 문장으로 한다. 오류는 throw(fail closed).
  claimJoinPush: async ({ roomId, userId }) => {
    const { data, error } = await client.rpc('claim_join_push', {
      p_room_id: roomId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data === true;
  },

  // Expo Push API — 메시지 배열을 한 번에 보낸다. 응답 data 가 티켓 배열(없으면 빈 배열).
  sendExpoPush: async ({ messages }) => {
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = (await res.json()) as { data?: unknown } | null;
    return Array.isArray(json?.data) ? (json.data as ExpoPushTicket[]) : [];
  },

  // 무효 토큰 정리 — expo_push_token 이 UNIQUE 라 1행. 오류는 throw(호출부가 경고만 남긴다).
  deleteToken: async ({ expoPushToken }) => {
    const { error } = await client.from('device_tokens').delete().eq('expo_push_token', expoPushToken);
    if (error) throw error;
  },
});
