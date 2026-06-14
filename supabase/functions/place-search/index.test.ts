// supabase/functions/place-search/index.test.ts
// place-search 핸들러 Deno 단위 스모크 (plan §5-1 / T1·T2). fetch·Deno.env 모킹으로 정규화/에러 분기 검증.
//   ⚠️ Deno 런타임 전용 — jest 대상 아님(package.json testPathIgnorePatterns: /supabase/). 실행: `deno test --allow-env`.
//   실 Kakao 호출/verify_jwt 실인증은 키 발급 후 `supabase functions serve` + 디바이스 스모크로 검증.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handlePlaceSearch, normalizeKakaoDocuments } from './index.ts';

const postRequest = (body: unknown): Request =>
  new Request('http://localhost/place-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const KAKAO_SAMPLE = {
  documents: [
    {
      id: '26338954',
      place_name: '트라토리아 보나',
      category_name: '음식점 > 양식 > 이탈리안',
      category_group_code: 'FD6',
      address_name: '서울 마포구 연남동 227-15',
      road_address_name: '서울 마포구 동교로 123',
      x: '126.925',
      y: '37.561',
      phone: '02-123-4567',
    },
  ],
};

Deno.test('normalizeKakaoDocuments: x→lng, y→lat(string→number) + camelCase 매핑', () => {
  const [item] = normalizeKakaoDocuments({ documents: KAKAO_SAMPLE.documents });
  assertEquals(item.kakaoPlaceId, '26338954');
  assertEquals(item.lat, 37.561);
  assertEquals(item.lng, 126.925);
  assertEquals(item.categoryGroupCode, 'FD6');
});

Deno.test('query 공백 → 400 QUERY_REQUIRED', async () => {
  const res = await handlePlaceSearch(postRequest({ query: '   ' }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, 'QUERY_REQUIRED');
});

Deno.test('키 미설정 → 500 KAKAO_KEY_MISSING', async () => {
  Deno.env.delete('KAKAO_REST_API_KEY');
  const res = await handlePlaceSearch(postRequest({ query: '스시' }));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, 'KAKAO_KEY_MISSING');
});

Deno.test('정상 → 200 { results } + 응답에 REST 키 미포함', async () => {
  Deno.env.set('KAKAO_REST_API_KEY', 'TEST_SECRET_KEY');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(KAKAO_SAMPLE), { status: 200 }),
    )) as typeof globalThis.fetch;
  try {
    const res = await handlePlaceSearch(postRequest({ query: '보나' }));
    assertEquals(res.status, 200);
    const text = await res.clone().text();
    assertEquals(text.includes('TEST_SECRET_KEY'), false); // 키 비노출(T1).
    const json = await res.json();
    assertEquals(json.results.length, 1);
    assertEquals(json.results[0].kakaoPlaceId, '26338954');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('Kakao 비정상 응답 → 502 KAKAO_REQUEST_FAILED', async () => {
  Deno.env.set('KAKAO_REST_API_KEY', 'TEST_SECRET_KEY');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response('err', { status: 401 }))) as typeof globalThis.fetch;
  try {
    const res = await handlePlaceSearch(postRequest({ query: '보나' }));
    assertEquals(res.status, 502);
    assertEquals((await res.json()).error, 'KAKAO_REQUEST_FAILED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
