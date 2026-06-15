// supabase/functions/nearby-search/index.ts
// map-tab-nearby 슬라이스 2: Kakao Local 카테고리(FD6) bbox 조회 프록시 (신규 Edge Function, plan §3.2·§9.1).
//   요청 { sw, ne } → Kakao category.json?category_group_code=FD6&rect=... → camelCase 정규화 { results: NearbyPlaceItem[] }.
//   place-search 패턴 미러(CORS·jsonResponse·핸들러 분리 export·에러 토큰 체계). place-search는 무변경.
//   ⚠️ REST 키(KAKAO_REST_API_KEY)는 서버 환경변수로만 — 응답/클라이언트 번들에 절대 미노출(architecture §2). place-search와 시크릿 재사용.
//   ⚠️ Deno 런타임(Supabase Edge). 앱 jest/tsc 대상 아님(tsconfig exclude). 실 검증: `supabase functions serve` + 디바이스 스모크.
//
// 환경변수: KAKAO_REST_API_KEY  (place-search와 동일 시크릿 재사용 — 신규 시크릿 0)
// 인증: place-search와 동일 정책(verify_jwt) — config.toml 부재 시 배포 기본값. dev-notes에 정책 기록.
//
// 비용 가드레일(plan §8): rect(bbox) 조회만 · size=15(1페이지) · page 파라미터 미사용(페이지네이션 금지).
//
// 에러 계약(plan §3.2): 400 BOUNDS_REQUIRED / 500 KAKAO_KEY_MISSING / 502 KAKAO_REQUEST_FAILED.
//   클라(searchNearby)가 토큰을 식별 → 실패 시 핀만 비우고 지도는 유지(차단 아님).

// CORS(웹/Expo 호출 대비 preflight 허용). 응답에 키를 싣지 않으므로 origin 와일드카드 안전.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KAKAO_CATEGORY_URL = 'https://dapi.kakao.com/v2/local/search/category.json';
const KAKAO_CATEGORY_GROUP = 'FD6'; // 음식점. 카테고리 필터 칩은 후속(전체 FD6만).
const KAKAO_RESULT_SIZE = 15; // 1페이지 15건 — page 미사용(페이지네이션 금지, 비용 가드레일 §8).

/** Kakao category.json documents[] 원소(우리가 쓰는 필드만). x=경도(lng), y=위도(lat). distance=문자열 m. */
type KakaoDocument = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_code?: string;
  x?: string; // 경도(lng) — 문자열
  y?: string; // 위도(lat) — 문자열
  distance?: string; // center 있을 때만 채워짐(rect 검색은 보통 '')
};

/** 클라(NearbyPlaceItem)와 1:1 정합되는 정규화 항목(camelCase). 경계면 단일 출처(plan §3.2·§7). */
type NearbyPlaceItem = {
  kakaoPlaceId: string;
  placeName: string;
  categoryName: string;
  categoryGroupCode: string;
  lat: number;
  lng: number;
  distance: number | null;
};

/** 좌표 입력(요청 본문). */
type Coords = { lat: number; lng: number };

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
 * 임의 값이 { lat:number, lng:number } 유한 좌표인지 검사한다.
 * @param value 요청 본문의 sw/ne 후보
 * @returns 유효 좌표 또는 null
 */
const asCoords = ({ value }: { value: unknown }): Coords | null => {
  if (typeof value !== 'object' || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.lat !== 'number' || !Number.isFinite(c.lat)) return null;
  if (typeof c.lng !== 'number' || !Number.isFinite(c.lng)) return null;
  return { lat: c.lat, lng: c.lng };
};

/**
 * Kakao distance(문자열 m)를 number|null로 정규화한다(빈/비수치 → null — rect 검색 center 결측).
 * @param raw documents[].distance
 * @returns 거리(m) 또는 null
 */
const parseDistance = ({ raw }: { raw: string | undefined }): number | null => {
  if (raw === undefined || raw.trim().length === 0) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Kakao documents[]를 NearbyPlaceItem[]로 정규화한다(x→lng, y→lat, distance 문자열→number|null).
 * 핸들러와 분리 export해 Deno 테스트에서 단위 검증 가능(plan §5-1, 단위 미구동 환경이라 클라 측 계약 모킹으로 보강).
 * @param documents Kakao category.json documents
 * @returns 정규화된 결과 배열
 */
export const normalizeNearbyDocuments = ({
  documents,
}: {
  documents: KakaoDocument[];
}): NearbyPlaceItem[] =>
  documents.map((doc) => ({
    kakaoPlaceId: doc.id ?? '',
    placeName: doc.place_name ?? '',
    categoryName: doc.category_name ?? '',
    categoryGroupCode: doc.category_group_code ?? KAKAO_CATEGORY_GROUP,
    lat: Number.parseFloat(doc.y ?? ''),
    lng: Number.parseFloat(doc.x ?? ''),
    distance: parseDistance({ raw: doc.distance }),
  }));

/**
 * 요청을 처리한다(OPTIONS preflight, bbox 검증, 키 확인, Kakao rect 호출, 정규화 반환).
 * 핸들러를 분리 export해 Deno 테스트에서 fetch/env 모킹으로 단위 검증 가능(plan §5-1).
 * @param req 들어온 Request
 * @returns Response
 */
export const handleNearbySearch = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // 요청 본문 파싱(비정상 JSON은 빈 객체로 흡수 → BOUNDS_REQUIRED로 귀결).
  const body = (await req.json().catch(() => ({}))) as { sw?: unknown; ne?: unknown };
  const sw = asCoords({ value: body.sw });
  const ne = asCoords({ value: body.ne });
  // 누락/NaN, 또는 역전 bbox(min>max) → 400. rect 순서·쿼터를 2차로 보호.
  if (!sw || !ne || sw.lat > ne.lat || sw.lng > ne.lng) {
    return jsonResponse({ body: { error: 'BOUNDS_REQUIRED' }, status: 400 });
  }

  // deno-lint-ignore no-explicit-any
  const restKey = (globalThis as any).Deno?.env?.get('KAKAO_REST_API_KEY') as string | undefined;
  if (!restKey) return jsonResponse({ body: { error: 'KAKAO_KEY_MISSING' }, status: 500 });

  // rect = lng_min,lat_min,lng_max,lat_max (Kakao: x=lng, y=lat). page 미사용(페이지네이션 금지).
  const rect = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  const url =
    `${KAKAO_CATEGORY_URL}?category_group_code=${KAKAO_CATEGORY_GROUP}` +
    `&rect=${encodeURIComponent(rect)}&size=${KAKAO_RESULT_SIZE}`;

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

  // 0건이면 results:[] (정상 200). 키는 응답에 포함되지 않는다(plan §8).
  return jsonResponse({
    body: { results: normalizeNearbyDocuments({ documents: data.documents }) },
    status: 200,
  });
};

// Supabase Edge(Deno) 진입점. 핸들러를 그대로 서빙.
// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve?.(handleNearbySearch);
