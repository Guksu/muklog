// supabase/functions/place-search/index.ts
// muklog-place 스프린트: Kakao Local 키워드 검색 프록시 (이 프로젝트 첫 Edge Function).
//   plan §3.2 — 요청 { query } → Kakao keyword.json 호출 → camelCase 정규화 { results: PlaceSearchItem[] } 반환.
//   ⚠️ REST 키(KAKAO_REST_API_KEY)는 서버 환경변수로만 보관 — 응답/클라이언트 번들에 절대 미노출(architecture §2).
//   ⚠️ Deno 런타임(Supabase Edge). 앱 jest/tsc 대상 아님(tsconfig exclude). 실 검증: `supabase functions serve` + 디바이스 스모크.
//
// 환경변수: KAKAO_REST_API_KEY  (`supabase secrets set KAKAO_REST_API_KEY=...`)
// 인증: verify_jwt = true (config.toml) — 인증 사용자만 호출(쿼터 보호, plan §8).
//
// 에러 계약(plan §3.2): 400 QUERY_REQUIRED / 500 KAKAO_KEY_MISSING / 502 KAKAO_REQUEST_FAILED.
//   클라(searchPlaces)가 body.error 토큰을 errors.ts 매핑으로 한국어화 → 모든 실패는 수동입력 폴백을 막지 않는다.

// CORS(웹/Expo 호출 대비 preflight 허용). 응답에 키를 싣지 않으므로 origin 와일드카드 안전.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_RESULT_SIZE = 15; // 상위 15건(1페이지) — 페이지네이션/대량 조회 안 함(비용 가드레일 §8).

/** Kakao keyword.json documents[] 원소(우리가 쓰는 필드만). x=경도(lng), y=위도(lat). */
type KakaoDocument = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_code?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string; // 경도(lng) — 문자열
  y?: string; // 위도(lat) — 문자열
  phone?: string;
};

/** 클라(PlaceSearchItem)와 1:1 정합되는 정규화 항목(camelCase). 경계면 단일 출처(plan §7-1). */
type PlaceSearchItem = {
  kakaoPlaceId: string;
  placeName: string;
  categoryName: string;
  categoryGroupCode: string;
  addressName: string;
  roadAddressName: string;
  lat: number;
  lng: number;
  phone: string;
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
 * Kakao documents[]를 PlaceSearchItem[]로 정규화한다(x→lng, y→lat 문자열→number).
 * @param documents Kakao keyword.json documents
 * @returns 정규화된 결과 배열
 */
export const normalizeKakaoDocuments = ({
  documents,
}: {
  documents: KakaoDocument[];
}): PlaceSearchItem[] =>
  documents.map((doc) => ({
    kakaoPlaceId: doc.id ?? '',
    placeName: doc.place_name ?? '',
    categoryName: doc.category_name ?? '',
    categoryGroupCode: doc.category_group_code ?? '',
    addressName: doc.address_name ?? '',
    roadAddressName: doc.road_address_name ?? '',
    lat: Number.parseFloat(doc.y ?? ''),
    lng: Number.parseFloat(doc.x ?? ''),
    phone: doc.phone ?? '',
  }));

/**
 * 요청을 처리한다(OPTIONS preflight, query 검증, 키 확인, Kakao 호출, 정규화 반환).
 * 핸들러를 분리 export해 Deno 테스트에서 fetch/env 모킹으로 단위 검증 가능(plan §5-1).
 * @param req 들어온 Request
 * @returns Response
 */
export const handlePlaceSearch = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // 요청 본문 파싱(비정상 JSON은 빈 객체로 흡수 → QUERY_REQUIRED로 귀결).
  const body = (await req.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (query.length === 0) return jsonResponse({ body: { error: 'QUERY_REQUIRED' }, status: 400 });

  // deno-lint-ignore no-explicit-any
  const restKey = (globalThis as any).Deno?.env?.get('KAKAO_REST_API_KEY') as string | undefined;
  if (!restKey) return jsonResponse({ body: { error: 'KAKAO_KEY_MISSING' }, status: 500 });

  const url = `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(query)}&size=${KAKAO_RESULT_SIZE}`;
  let kakaoResponse: Response;
  try {
    kakaoResponse = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` } });
  } catch {
    return jsonResponse({ body: { error: 'KAKAO_REQUEST_FAILED' }, status: 502 }); // 네트워크/타임아웃.
  }
  if (!kakaoResponse.ok) {
    return jsonResponse({ body: { error: 'KAKAO_REQUEST_FAILED' }, status: 502 });
  }

  const data = (await kakaoResponse.json().catch(() => null)) as {
    documents?: KakaoDocument[];
  } | null;
  if (!data || !Array.isArray(data.documents)) {
    return jsonResponse({ body: { error: 'KAKAO_REQUEST_FAILED' }, status: 502 });
  }

  // 0건이면 results:[] (정상 200). 키는 응답에 포함되지 않는다(plan T1).
  return jsonResponse({
    body: { results: normalizeKakaoDocuments({ documents: data.documents }) },
    status: 200,
  });
};

// Supabase Edge(Deno) 진입점. 핸들러를 그대로 서빙.
// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve?.(handlePlaceSearch);
