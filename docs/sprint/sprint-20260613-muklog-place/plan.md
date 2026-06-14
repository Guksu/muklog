# Sprint: 먹로그 장소검색·좌표 자동채움 (muklog-place)

> `muklog-editor`의 **두 번째 슬라이스** = Kakao 장소. 먹로그 입력 시트(`MuklogEntrySheet`)에 Kakao Local 키워드 검색을 붙여,
> 검색 → 결과 선택 시 **장소명·카테고리·주소·도로명주소·동네(area)·좌표(lat/lng)·kakao_place_id**를 자동 채운다.
> Kakao REST 키는 **Supabase Edge Function `place-search` 프록시**로만 호출(클라이언트 미노출) — 이 프로젝트 **첫 Edge Function**.
> 영상·드래그 재정렬·지도 탭(map-tab)은 **범위 밖**.

---

## 1. 기능 한줄 정의

사용자가 먹로그를 작성/편집할 때 가게 이름으로 **검색**하고 결과를 **선택**하면, 장소명·카테고리·주소·도로명주소·동네·좌표·`kakao_place_id`가 **자동으로 채워져** 저장된다. 검색이 0건이거나 네트워크/키 문제가 있으면 **기존 수동 입력 그대로 폴백**(좌표 NULL)으로 저장할 수 있다.

---

## 2. 범위

### In-scope
- **Edge Function `place-search`**(첫 Edge Function): Kakao Local 키워드 검색 REST API 프록시. REST 키는 서버 환경변수(`KAKAO_REST_API_KEY`), 응답을 camelCase로 정규화해 반환. `verify_jwt` 유지(인증 사용자만 호출 → 쿼터 보호).
- **클라이언트 검색 모듈**: `searchPlaces`(invoke 래퍼) + `usePlaceSearch` 훅(디바운스 + 인메모리 캐싱 + min 글자수 + loading/error/results 상태).
- **Kakao 카테고리 → 8종 enum 매핑** 순수 유틸(`mapKakaoCategory`) + **주소 → 동네(area) 추출** 유틸(`deriveArea`).
- `MuklogEntrySheet`에 **장소검색 UI**(검색 입력 + 결과 리스트 + 선택) 추가 — 선택 시 7개 필드 자동채움. 검색 없이 기존 수동 입력도 계속 가능(폴백).
- **place 필드 plumbing**(작성·편집 양 경로): `CreateMuklogInput`/`UpdateMuklogInput`/`NormalizedMuklogInput`/`MuklogInsertRow`/`MuklogEditInitial`에 `kakaoPlaceId·address·roadAddress·lat·lng` 추가(`category·area`는 기존 존재). `validate.toMuklogRow`·`useCreateMuklog`·`useUpdateMuklog` insert/update payload에 반영.
- 비용 가드레일: **클라이언트 디바운스 + 쿼리 캐싱**(동일 쿼리 재호출 차단).

### Out-of-scope (다음/다른 슬라이스)
- **지도 탭·미니맵 실렌더**(좌표 핀 표시) — `map-tab`. 이번엔 좌표를 **저장만** 한다.
- **2초 영상** — `muklog-video`.
- 사진 **드래그 재정렬** — 기존대로 선택 순서 고정.
- **카테고리 자동 그룹 필터링 UI**(FD6/CE7 토글), 페이지네이션(더 보기), 최근검색/즐겨찾기 — 이번엔 단일 페이지(상위 N건)만.
- **현재위치 기반 정렬**(x/y 좌표 파라미터) — 이번엔 키워드 only.
- `muklogs`에 좌표 범위 검증 트리거 추가 — 좌표는 신뢰 가능한 Kakao 출처라 생략(앱이 number만 전달).

---

## 3. 데이터 · API 계약

### 3.1 테이블/컬럼 — DDL 없음 ✅
`muklogs`에 `kakao_place_id text`·`category text`·`area text`·`address text`·`road_address text`·`lat double precision`·`lng double precision`가 **이미 선반영**(`20260611130000_muklog_list.sql`). **이번 스프린트 마이그레이션 없음.**
- `lat`/`lng`는 **nullable**(수동입력 폴백 시 NULL). 지도(map-tab)는 `lat is not null`만 핀.
- `category`는 자유 text, 앱이 8종 enum 강제(매핑 실패 시 NULL → 사용자 칩 수동 선택).
- 트리거 `enforce_muklog_fields`는 place_name/rating/visited_at만 검증 → place 필드는 통과(좌표 검증 없음).

### 3.2 Edge Function `place-search` (신규, `supabase/functions/place-search/index.ts`)

**호출**: `supabase.functions.invoke('place-search', { body: { query } })` (access token 자동 첨부).

**요청 body**
```ts
{ query: string }   // 검색 키워드. trim 후 비면 400.
```

**성공 응답(200)** — Kakao raw를 **camelCase로 정규화**(클라가 Kakao shape에 의존하지 않게 디커플)
```ts
{ results: PlaceSearchItem[] }   // 0건이면 results: []

PlaceSearchItem = {
  kakaoPlaceId: string       // Kakao documents[].id
  placeName: string          // place_name
  categoryName: string       // category_name (raw, 예 "음식점 > 한식 > 칼국수")
  categoryGroupCode: string  // category_group_code (FD6=음식점, CE7=카페, 그 외 '')
  addressName: string        // address_name (지번 주소)
  roadAddressName: string    // road_address_name ('' 가능)
  lat: number                // parseFloat(y)  (위도)
  lng: number                // parseFloat(x)  (경도)
  phone: string              // phone ('' 가능)
}
```

**에러 응답** — body `{ error: <TOKEN> }` + 상태코드
| 상태 | token | 상황 |
|------|-------|------|
| 400 | `QUERY_REQUIRED` | query 누락/공백 |
| 500 | `KAKAO_KEY_MISSING` | 서버 `KAKAO_REST_API_KEY` 미설정 |
| 502 | `KAKAO_REQUEST_FAILED` | Kakao API 비정상 응답/타임아웃 |

**Kakao 호출 규약**(서버 내부)
- `GET https://dapi.kakao.com/v2/local/search/keyword.json?query={query}&size=15`
- Header: `Authorization: KakaoAK ${KAKAO_REST_API_KEY}`
- `category_group_code` **미지정**(음식점·카페·베이커리 등 폭넓게) → 카테고리 분류는 앱 `mapKakaoCategory`가 담당.
- `size=15`(상위 15건, 1페이지). CORS preflight(OPTIONS) 처리.

**환경변수**: `KAKAO_REST_API_KEY` (= Kakao Developers REST 키). `supabase secrets set KAKAO_REST_API_KEY=...`로 설정. **클라이언트 번들에 절대 미포함**(architecture §2 핵심 원칙).

> ⚠️ **키 미발급 시 이월(social-auth 선례)**: Kakao REST 키 미발급이면 라이브 검증은 키 발급 후로 이월하고, 코드/모킹 테스트는 완성한다. plan은 키 존재를 가정한 계약을 못박는다.

### 3.3 카테고리 매핑 유틸 `mapKakaoCategory` (`src/features/muklog/kakaoCategory.ts`, 순수)
```ts
mapKakaoCategory({ categoryName, categoryGroupCode }: { categoryName: string; categoryGroupCode: string })
  : MuklogCategoryKey | null
```
- `category_name` 키워드 + `category_group_code`로 8종 중 하나에 매핑, 불명확하면 **null**(사용자가 칩 수동 선택).
- 매핑 규칙(우선순위 위→아래, `category_name` 부분일치):
  | 조건 | 결과 |
  |------|------|
  | groupCode `CE7` 또는 '카페' 포함 | `cafe` |
  | '베이커리'·'제과'·'빵' 포함 | `bakery` |
  | '일식'·'초밥'·'스시'·'오마카세'·'회' 포함 | `sushi` |
  | '이자카야'·'선술집'·'사케' 포함 | `izakaya` |
  | '중식'·'중국' 포함 | `chinese` |
  | '햄버거'·'버거'·'펍'·'바(Bar)' 포함 | `burger` |
  | '양식'·'파스타'·'이탈리'·'스파게티'·'피자' 포함 | `pasta` |
  | '국수'·'면'·'칼국수'·'한식'·'분식'·'식당' 포함 | `noodle` |
  | 그 외 | `null` |

### 3.4 동네 추출 유틸 `deriveArea` (`src/features/muklog/kakaoCategory.ts` 또는 인접, 순수)
```ts
deriveArea({ addressName }: { addressName: string }): string | null
```
- 지번 주소(`address_name`)에서 **법정동/행정동 토큰**(끝이 '동'/'읍'/'면'/'가'/'로'인 어절)을 추출. 예: `"서울 마포구 연남동 227-15"` → `"연남동"`.
- 토큰을 못 찾으면 `null`. 좌표/주소가 채워져도 area는 보조 표시값이므로 실패해도 무해.

### 3.5 검색 모듈 (`src/features/muklog/usePlaceSearch.ts` + `searchPlaces.ts`)
```ts
// searchPlaces.ts — invoke 래퍼. 에러를 토큰으로 정규화해 throw.
searchPlaces({ query }: { query: string }): Promise<PlaceSearchItem[]>

// usePlaceSearch.ts — 디바운스 + 캐싱 검색 훅
usePlaceSearch(): {
  query: string;
  setQuery: (q: string) => void;          // 입력 → 디바운스 트리거
  results: PlaceSearchItem[];             // 최신 검색 결과(빈 배열 = 0건/미검색)
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;           // mapPlaceSearchError 결과(한국어)
}
```
- **디바운스**: setQuery 후 `PLACE_SEARCH_DEBOUNCE_MS`(=350ms) 무입력 시 1회 호출(비용 가드레일).
- **min 글자수**: trim 길이 < 2 → 호출 안 함(`idle`, results=[]).
- **캐싱**: `Map<normalizedQuery, PlaceSearchItem[]>`(query trim+lower 키). 캐시 히트 시 invoke 미호출(비용 가드레일).
- **레이스 가드**: 직전 호출 응답이 늦게 와도 최신 query 결과만 반영(stale 응답 폐기).

### 3.6 place 에러 토큰 (`errors.ts` 확장)
`MuklogErrorToken`에 추가 + `MUKLOG_ERROR_MESSAGES` 한국어 매핑:
| token | 메시지(예) |
|-------|-----------|
| `QUERY_REQUIRED` | (검색 안내 — UI 비노출, 방어용) |
| `KAKAO_KEY_MISSING` | `장소 검색을 사용할 수 없어요. 직접 입력해 주세요.` |
| `KAKAO_REQUEST_FAILED` | `장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.` |
| `PLACE_SEARCH_FAILED` | (네트워크 등 기타 — 위와 동일 폴백 문구) |
> 모든 검색 실패는 **수동입력 폴백을 막지 않는다**(인라인 안내만, 시트 입력 유지).

### 3.7 plumbing 타입 변경 (`types.ts`)
다음 5필드를 **추가**(`category`·`area`는 이미 존재):
```ts
// 공통 place 필드 묶음(작성·편집·정규화·row·프리필이 공유)
PlaceFields = {
  kakaoPlaceId?: string | null;
  address?: string | null;
  roadAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
}
```
- `CreateMuklogInput` += PlaceFields
- `UpdateMuklogInput` += PlaceFields
- `NormalizedMuklogInput` += `{ kakaoPlaceId: string|null; address: string|null; roadAddress: string|null; lat: number|null; lng: number|null }`
- `MuklogInsertRow` += `{ kakao_place_id, address, road_address, lat, lng }`(snake)
- `MuklogEditInitial` += PlaceFields(편집 진입 시 기존 좌표 프리필 → 재검색 안 해도 보존, 데이터 손실 0)
- `MuklogEditSubmitInput`(`MuklogEntrySheet.tsx`) += PlaceFields

### 3.8 정규화/매핑 경계 (`validate.ts`)
- `normalizeMuklogInput`: place 필드를 **통과**(trim: address/roadAddress/kakaoPlaceId는 trimToNull; lat/lng는 number 그대로, 0/NaN 방어 — NaN→null). category는 기존 로직 유지.
- `toMuklogRow`: `kakao_place_id/address/road_address/lat/lng` snake 매핑 추가.
- `useUpdateMuklog` update payload에도 5필드 추가(미포함 시 편집 저장이 좌표를 날림 — 손실 방지).

---

## 4. 화면 · UX

> **역할 경계**: 이 §4는 *무엇을 보여주는가*(planner). *어떻게 보이는가*(레이아웃·토큰·프리미티브)는 **ui-publisher**가 킷 `templates/muklog`(mk-log.jsx MuklogEditor) 기준으로 확정한다.

### 4.1 컴포넌트
- **`MuklogEntrySheet`** (기존 확장): 장소명 필드 위/근처에 **장소검색 영역** 추가.
  - 검색 입력(돋보기) → 입력 시 디바운스 검색.
  - **결과 리스트**(상위 N): 각 항목 = `placeName` + `roadAddressName||addressName` + (있으면)카테고리. 탭 → 자동채움 + 결과 리스트 닫힘.
  - 선택 후: 장소명 input에 placeName 반영, 카테고리 칩 자동 선택(매핑 성공 시), 주소/동네/좌표는 내부 state로 보관(저장 시 전송). **"📍 {도로명주소}" 같은 선택 요약** 1줄 표시 + 선택 해제(수동 전환) 가능.
- **`PlaceSearchField`/`PlaceResultList`** (신규 프리미티브 후보, ui-publisher가 분리 여부 결정).

### 4.2 상태
| 상태 | 표시 |
|------|------|
| idle(미입력/2글자 미만) | 결과 리스트 미표시. 기존 수동 입력 그대로. |
| loading | 검색 인디케이터(스피너/스켈레톤). |
| ready(≥1건) | 결과 리스트. |
| ready(0건) | "검색 결과가 없어요. 직접 입력해도 돼요." + 수동 입력 유지. |
| error | 인라인 안내(§3.6 메시지) + 수동 입력 유지(폴백). |
| 선택됨 | 장소 요약 1줄 + 채워진 필드. |

### 4.3 원티드 토큰 사용 지점
- 검색 입력/결과 카드: `surface`·`hairline`(보더)·`radius.control`/`radius.card`·`spacing` 그리드.
- 선택 강조/카테고리 칩: `primary`(#3366FF). 결과 보조 텍스트: `fgMuted`/`fgWeak`. raw hex 0(킷 음식 이모지는 허용).

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. Edge Function `place-search` 스캐폴드 + Kakao 프록시** — 인수조건: `{ query:'스시' }` 호출 시 `{ results: PlaceSearchItem[] }`(camelCase)를 200으로 반환하고, 응답에 REST 키가 포함되지 않는다 — 테스트: 모킹된 Kakao fetch 응답을 정규화해 `results[0].kakaoPlaceId/lat/lng`로 매핑하는지(핸들러 단위, fetch 모킹).
- [ ] **T2. Edge Function 에러/엣지 처리** — 인수조건: query 공백→400 `QUERY_REQUIRED`, 키 미설정→500 `KAKAO_KEY_MISSING`, Kakao 비정상→502 `KAKAO_REQUEST_FAILED`, 0건→200 `{results:[]}` — 테스트: 분기별 상태코드·토큰(핸들러 단위, env·fetch 모킹).
- [ ] **T3. `mapKakaoCategory` 유틸** — 인수조건: `"음식점 > 한식 > 칼국수"`→`noodle`, group `CE7`→`cafe`, `"음식점 > 일식 > 초밥"`→`sushi`, 불명확→`null` — 테스트: 매핑표 케이스 + 미지 입력 null(순수 유틸 단위).
- [ ] **T4. `deriveArea` 유틸** — 인수조건: `"서울 마포구 연남동 227-15"`→`"연남동"`, 동 토큰 없음→`null`, 빈 문자열→`null` — 테스트: 정상/경계/실패(순수 유틸 단위).
- [ ] **T5. `searchPlaces` invoke 래퍼** — 인수조건: invoke 성공 시 `results` 배열 반환, `{error:'KAKAO_KEY_MISSING'}` 응답 시 해당 토큰 throw, 네트워크 throw 시 `PLACE_SEARCH_FAILED`로 정규화 — 테스트: supabase.functions.invoke 모킹(성공/에러 shape).
- [ ] **T6. `usePlaceSearch` 디바운스·캐싱·레이스 훅** — 인수조건: (a) 350ms 내 연속 입력은 1회만 호출, (b) min 2글자 미만은 미호출(idle), (c) 동일 쿼리 재검색은 캐시로 invoke 미호출, (d) stale 응답 폐기 — 테스트: fake timers + searchPlaces 모킹(`renderHook`).
- [ ] **T7. place 에러 토큰/메시지 추가** — 인수조건: `KAKAO_KEY_MISSING`/`KAKAO_REQUEST_FAILED`/`PLACE_SEARCH_FAILED`가 한국어 폴백 메시지로 매핑 — 테스트: `mapMuklogError`(또는 `mapPlaceSearchError`) 케이스(순수 유틸 단위).
- [ ] **T8. types plumbing(place 필드)** — 인수조건: `CreateMuklogInput`/`UpdateMuklogInput`/`NormalizedMuklogInput`/`MuklogInsertRow`/`MuklogEditInitial`에 5필드 존재, 타입 컴파일 통과 — 테스트: `toMuklogRow`가 snake 매핑을 포함(validate 단위).
- [ ] **T9. `validate`/`useCreateMuklog`/`useUpdateMuklog` place 반영** — 인수조건: 선택값이 있으면 insert/update payload에 `lat/lng/address/road_address/kakao_place_id` 포함, 없으면 NULL — 테스트: `toMuklogRow` 매핑 + 훅 insert/update payload(모킹) 단위.
- [ ] **T10. `MuklogEntrySheet` 장소검색 UI 배선 + 자동채움** — 인수조건: 결과 항목 탭 시 placeName 반영 + 카테고리 칩 자동선택(매핑 성공 시) + 선택 요약 표시, 검색 없이도 수동 저장 가능 — 테스트: `render` + 결과 탭 → 필드 반영/onSaved 입력 검증(화면 단위, 훅·invoke 모킹).
- [ ] **T11. 폴백/엣지 UX** — 인수조건: 0건→안내 + 수동입력 저장 시 좌표 NULL, 검색 에러→인라인 안내 + 입력 보존 — 테스트: 화면 단위(0건/에러 분기).

## 5-1. 테스트 케이스 (TDD)

**순수 유틸 (단위 필수)**
- `mapKakaoCategory`: noodle/cafe/sushi/izakaya/chinese/burger/pasta/bakery 각 1건 + groupCode 우선(CE7) + 미지→null + 빈 입력→null.
- `deriveArea`: 정상 동 추출 / 로/가 끝 토큰 / 토큰 없음→null / 빈 문자열→null.
- `mapMuklogError`(또는 place 매핑): `KAKAO_KEY_MISSING`/`KAKAO_REQUEST_FAILED`/`PLACE_SEARCH_FAILED`→한국어, 미지 토큰→기본 메시지.
- `toMuklogRow`: place 5필드 snake 매핑(있을 때/NULL일 때).
- `normalizeMuklogInput`: lat=NaN→null, address 공백→null, 좌표 number 통과.

**훅 (renderHook + 모킹)**
- `usePlaceSearch`: 디바운스 1회 호출(fake timers) / min 글자수 미호출 / 캐시 히트 미호출 / 레이스 stale 폐기 / 에러 status='error'+message.
- `useCreateMuklog`: 선택값 있는 입력 → insert payload에 place 5필드 / 좌표 NULL 입력 → NULL 전송.
- `useUpdateMuklog`: 편집 저장 시 update payload에 place 5필드 포함(미포함 회귀 방지 = 좌표 손실 방지 단언).

**화면 (render + 상호작용)**
- `MuklogEntrySheet`: 검색→결과 탭→placeName/카테고리 자동채움 / 0건 안내 + 수동 저장(좌표 NULL) / 검색 에러 인라인 + 입력 보존 / 편집 모드 진입 시 기존 place 프리필 표시.

**모킹/스모크 (단위 대상 아님)**
- Edge Function 핸들러: Deno fetch·env 모킹으로 정규화/에러 분기 단위 검증(러너 환경상 모킹 스모크). **실 Kakao 호출은 키 발급 후 디바이스/CLI 스모크**(`supabase functions serve` + 실제 invoke).
- `supabase.functions.invoke` 실제 네트워크, RLS/verify_jwt 실인증 동작 → 디바이스 스모크.

## 6. 엣지케이스

- **검색 0건**: `results:[]` → 안내 문구 + 수동 입력 유지, 저장 시 좌표 NULL.
- **네트워크 실패**(invoke reject): `PLACE_SEARCH_FAILED` 인라인 안내, 입력/시트 보존, 수동 저장 가능.
- **키 미설정**(`KAKAO_KEY_MISSING`): 검색 비활성 안내 + 수동 입력 폴백(앱 크래시 없음).
- **수동입력 폴백 + 좌표 NULL**: 검색 안 쓰고 장소명만 입력 → 기존 동작 그대로 저장(lat/lng/address/kakao_place_id = NULL).
- **선택 후 장소명 수동 수정**: placeName만 바꿔도 좌표/주소/kakao_place_id는 마지막 선택값 유지(혹은 "선택 해제" 시 모두 NULL로). → 결정 D2 참조.
- **카테고리 매핑 실패**(null): 칩 미선택 상태 → 사용자가 직접 선택. 자동채움이 기존 선택을 덮어쓰는지(D1) 참조.
- **입력 한계**: 장소명 60자 제한(`PLACE_NAME_MAX`)은 검색 자동채움에도 적용(초과 시 trim/제한).
- **디바운스 경계**: 빠른 타이핑 → 마지막 입력만 1회 호출. 글자 지워 2글자 미만 → idle 복귀, 직전 결과 제거.
- **레이스/캐시**: "스" → "스시" 빠른 변경 시 "스" 응답이 늦게 와도 "스시" 결과만 표시. 동일 쿼리 재입력은 캐시.
- **동시성(커플 2명)**: 두 명이 각자 시트에서 같은 가게 검색·저장 → 각각 독립 먹로그 row(kakao_place_id 중복 허용, unique 제약 없음). 중복 방지는 이번 범위 아님.
- **권한/RLS**: insert/update는 기존 `muklogs_insert_member`/`muklogs_update_own` 그대로(place 필드는 RLS와 무관). Edge Function `verify_jwt`로 비로그인 호출 차단.
- **편집 모드 좌표 보존**: 편집 진입 시 기존 lat/lng/address가 프리필되어, 재검색 없이 저장해도 좌표가 날아가지 않음(plumbing 누락 시 회귀 — T9 단언).
- **인증 만료**: invoke 시 토큰 만료 → autoRefresh 후 재시도/실패 시 `PLACE_SEARCH_FAILED` 폴백.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. **Edge Function 응답 shape ↔ `searchPlaces`/`PlaceSearchItem`**: camelCase 필드명·타입(`lat/lng` number, `kakaoPlaceId` string) 정합. Kakao raw(`x`/`y` string)→number 변환 위치.
2. **`searchPlaces` 에러 토큰 ↔ `errors.ts` 매핑**: `KAKAO_KEY_MISSING`/`KAKAO_REQUEST_FAILED`/`PLACE_SEARCH_FAILED` 단일 출처 동기화.
3. **자동채움 매핑 ↔ DB 컬럼**: `PlaceSearchItem` → `CreateMuklogInput`/`UpdateMuklogInput` → snake row(`kakao_place_id/address/road_address/lat/lng/category/area`) 1:1.
4. **`toMuklogRow`/update payload ↔ `muklogs` 컬럼**: 컬럼명·nullable 정합(좌표 NULL 허용).
5. **`mapKakaoCategory` 결과 ↔ `MUKLOG_CATEGORIES` key**: 8종 key만 반환 또는 null(enum 드리프트 차단).
6. **`MuklogEditInitial` place 필드 ↔ `useMuklog`/상세 조회**: 편집 프리필이 기존 좌표를 싣는지(상세 조회가 lat/lng/address를 노출하는지 — `Muklog`/`useMuklog` 확장 필요 여부 확인).
7. **`verify_jwt` ↔ `functions.invoke` 토큰**: 인증 세션에서만 호출 성공(비로그인 차단).
8. **ui-publisher 화면(킷 mk-log MuklogEditor) ↔ 본 §4 상태 목록**: 로딩/0건/에러/선택됨 상태가 킷 비주얼로 구현됐는지.

## 8. 비용 가드레일 체크

- ✅ **Kakao 호출 = Edge Function 프록시 경유**(REST 키 클라 미노출, 쿼터 남용 차단). architecture §2/§6.
- ✅ **클라이언트 디바운스**(350ms) — 타이핑 중 과호출 차단.
- ✅ **쿼리 캐싱**(인메모리 Map) — 동일 쿼리 재호출 0.
- ✅ **min 글자수(2)** — 1글자 광역 검색 차단.
- ✅ **size=15 단일 페이지** — 페이지네이션/대량 조회 안 함.
- ✅ **verify_jwt** — 인증 사용자만 호출(익명 남용 차단).
- ✅ **AWS 미사용** — Edge Function은 Supabase 무료 티어 포함.
- N/A: 이미지 압축(사진 슬라이스), viewport 조회(map-tab).

---

## 부록. 결정 필요 / divergence

- **D1 — 자동채움이 기존 카테고리 칩 선택을 덮어쓰는가?**: 제안 = **덮어쓴다**(검색 선택이 사용자의 최신 의도). 단 매핑 결과가 `null`이면 기존 선택 보존. (ui-publisher/developer 합의)
- **D2 — "선택 해제"(수동 전환) 시 좌표 처리**: 제안 = 명시적 "선택 해제" 시 `kakaoPlaceId/address/roadAddress/lat/lng` 모두 NULL로 리셋(장소명은 유지). 장소명만 수동 수정 시에는 좌표 유지.
- **D3 — 편집 모드 place 프리필 위해 `Muklog`/`useMuklog` 확장**: 상세 조회가 현재 lat/lng/address를 노출하지 않으면 `useMuklog` select에 컬럼 추가 + `MuklogEditInitial` 매핑 필요. developer가 §7-6 확인 후 처리(필요 시 최소 확장).
- **D4 — `category_group_code` 필터 미적용**: 키워드 검색 결과에 비음식 장소가 섞일 수 있으나, 음식 카테고리 폭(카페/베이커리 포함)을 위해 미적용. 노이즈가 크면 차기 `FD6,CE7` 필터 토글 도입.

> 위 D1~D4는 **이번 스프린트 내 합의**로 처리하되, 설계 문서(architecture.md)와 충돌하지 않음(좌표 nullable·수동 폴백 모두 §3 정합). 충돌 발견 시 team-lead 확인.
