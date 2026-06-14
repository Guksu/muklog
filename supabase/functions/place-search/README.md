# place-search Edge Function

muklog-place 슬라이스. **Kakao Local 키워드 검색 프록시** — 이 프로젝트의 첫 Edge Function.
Kakao REST 키를 서버 환경변수로만 보관해 클라이언트 번들 노출을 막는다(architecture §2 핵심 원칙).

## 계약 (plan §3.2)

**요청** — `supabase.functions.invoke('place-search', { body: { query } })`

```ts
{ query: string }   // 검색 키워드. trim 후 비면 400.
```

**성공(200)**

```ts
{ results: PlaceSearchItem[] }   // 0건이면 results: []
// PlaceSearchItem(camelCase): kakaoPlaceId, placeName, categoryName, categoryGroupCode,
//                             addressName, roadAddressName, lat(number), lng(number), phone
```

**에러**

| 상태 | body `{ error }` | 상황 |
|------|------------------|------|
| 400 | `QUERY_REQUIRED` | query 누락/공백 |
| 500 | `KAKAO_KEY_MISSING` | 서버 `KAKAO_REST_API_KEY` 미설정 |
| 502 | `KAKAO_REQUEST_FAILED` | Kakao API 비정상 응답/네트워크 실패 |

클라이언트(`src/features/muklog/searchPlaces.ts`)가 위 토큰을 `errors.ts` 한국어 메시지로 매핑한다.
모든 실패는 **수동입력 폴백을 막지 않는다**(좌표 NULL 저장 가능).

## 환경변수

```bash
supabase secrets set KAKAO_REST_API_KEY=<Kakao Developers REST 키>
```

> ⚠️ **키 미발급 시 이월**(social-auth 선례): REST 키가 없으면 라이브 검증은 키 발급 후로 이월.
> 코드/모킹 테스트는 완성돼 있으며, 키 미설정 시 함수는 안전하게 `KAKAO_KEY_MISSING`을 반환(앱은 수동입력 폴백).
>
> ⚠️ **카카오맵(로컬) 서비스 활성 필수** (2026-06-14 라이브 검증에서 확인): REST 키가 유효해도 Kakao 앱에서
> **카카오맵(OPEN_MAP_AND_LOCAL) 서비스가 비활성**이면 Local API가 `403 {"errorType":"NotAuthorizedError",
> "message":"App(...) disabled OPEN_MAP_AND_LOCAL service."}`을 반환 → 함수는 `KAKAO_REQUEST_FAILED`(502)로 매핑.
> 해결: **카카오 개발자 콘솔 → 내 애플리케이션 → 앱 → 제품 설정 → 카카오맵 → 활성화 ON**. (시크릿/재배포 불필요, 즉시 반영.)
> 진단 팁: `curl -G -H "Authorization: KakaoAK <REST키>" --data-urlencode "query=스타벅스" https://dapi.kakao.com/v2/local/search/keyword.json`
> → 200=정상 / 401=키 오류 / 403=카카오맵 미활성.

## 인증

`verify_jwt`는 Supabase 기본값(`true`) 유지 → 인증 사용자만 호출(쿼터 보호, plan §8).
별도 끄지 않는다. 끌 경우에만 `supabase/config.toml`에 `[functions.place-search] verify_jwt = false` 명시 필요.

## 로컬 실행 / 배포

```bash
# 로컬 서빙(실 Kakao 호출 스모크)
supabase functions serve place-search --env-file ./supabase/.env.local

# 핸들러 단위 스모크(Deno, fetch/env 모킹)
deno test supabase/functions/place-search/index.test.ts --allow-env

# 배포
supabase functions deploy place-search
```
