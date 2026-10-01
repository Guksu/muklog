// supabase/functions/_shared/http.ts
// Edge Function HTTP 도우미 — send-join-push·send-muklog-push 가 함께 쓴다 (join-push plan §5.4, 옛 send-muklog-push/index.ts 에서 이동).
//   본인 식별은 Authorization JWT → getUserId 로 확인한 callerId 만(본문의 userId 류는 읽지 않는다).
//   ⚠️ 응답에는 토큰·JWT·시크릿을 싣지 않는다.

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 오류 응답 토큰(앱은 결과를 보지 않지만 상태·토큰으로 원인을 구분한다). */
export const ErrorCode = {
  Unauthenticated: 'UNAUTHENTICATED',
  BadRequest: 'BAD_REQUEST',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * JSON 응답을 CORS 헤더와 함께 만든다.
 * @param body 응답 본문
 * @param status HTTP 상태코드
 * @returns Response
 */
export const jsonResponse = ({ body, status }: { body: unknown; status: number }): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

/**
 * CORS preflight(OPTIONS) 응답을 만든다.
 * @returns 200 'ok'
 */
export const optionsResponse = (): Response =>
  new Response('ok', { status: 200, headers: CORS_HEADERS });

/**
 * Authorization 헤더에서 Bearer 토큰을 꺼낸다(없으면 null).
 * @param req 들어온 Request
 * @returns JWT 문자열 또는 null
 */
export const extractBearer = ({ req }: { req: Request }): string | null => {
  const header = req.headers.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

/**
 * 요청 본문을 JSON 객체로 읽는다. JSON 이 아니거나 객체가 아니면(배열·숫자·null 포함) 빈 객체.
 * @param req 들어온 Request
 * @returns 본문 객체(읽을 수 없으면 {})
 */
export const readJsonObject = async ({ req }: { req: Request }): Promise<Record<string, unknown>> => {
  try {
    const parsed: unknown = await req.json();
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

/** UUID 표준 표기 길이(8-4-4-4-12 + 하이픈 4개). 본문 id 의 길이 상한을 겸한다. */
const UUID_LENGTH = 36;
/** UUID 표준 표기(16진수, 대소문자 무관 — Postgres uuid 입력과 같은 판정). rooms.id·muklogs.id 형식이다. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 본문 값이 UUID 표준 표기일 때만 골라낸다(roomId·muklogId 검증용 — 보안 QA S2-1).
 *   형식이 틀린 id 는 DB 에 닿기 전에 거른다. Postgres 는 틀린 uuid 입력을 오류 문구(22P02)에 그대로 되돌려 주므로,
 *   길이 상한 없는 값이 오류 로그 처리까지 흘러가지 않게 한다. 형식이 맞아도 행이 없으면 기존처럼 claim·검증이 거른다.
 * @param value 본문에서 읽은 값
 * @returns UUID 표기 문자열이면 그 값(대소문자 그대로), 아니면 null
 */
export const pickUuid = ({ value }: { value: unknown }): string | null =>
  typeof value === 'string' && value.length === UUID_LENGTH && UUID_PATTERN.test(value) ? value : null;

/**
 * Authorization JWT 로 호출한 사람(callerId)을 확인한다. Bearer 없음·무효·확인 중 예외면 null(→ 401).
 * @param req 들어온 Request
 * @param getUserId JWT → 사용자 id(무효면 null)
 * @returns 확인된 callerId 또는 null
 */
export const resolveCallerId = async ({
  req,
  getUserId,
}: {
  req: Request;
  getUserId: (args: { token: string }) => Promise<string | null>;
}): Promise<string | null> => {
  const token = extractBearer({ req });
  if (!token) return null;
  try {
    return (await getUserId({ token })) || null;
  } catch {
    return null;
  }
};
