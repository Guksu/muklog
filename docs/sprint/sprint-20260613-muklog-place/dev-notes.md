# Dev Notes — muklog-place (장소검색 + 좌표/주소/카테고리 자동채움)

> developer 구현 기록. 작업 #3. **TDD(Red→Green)** 로 구현, `npm test` 617 통과 + `tsc --noEmit` 통과.
> 역할 경계: ui-publisher의 presentational 3종(PlaceSearchField/PlaceResultRow/PlaceSelectedSummary) **비주얼 무변경**.
> developer는 데이터(Edge Function·훅·매핑·payload 합류·컨테이너 배선)만 담당.

---

## 1. 구현/생성 파일

### 백엔드 (Supabase Edge Function — 이 프로젝트 첫 Edge Function)
| 파일 | 내용 |
|------|------|
| `supabase/functions/place-search/index.ts` | Kakao Local **keyword.json 프록시**. `{ query }` → `{ results: PlaceSearchItem[] }`(camelCase 정규화). 에러 토큰 400/500/502. REST 키는 `Deno.env(KAKAO_REST_API_KEY)`, **응답/번들 미노출**. `handlePlaceSearch`·`normalizeKakaoDocuments` 분리 export(Deno 테스트용). |
| `supabase/functions/place-search/index.test.ts` | Deno 핸들러 스모크(fetch/env 모킹) — 정규화·400·500·502·키 비노출. **jest 대상 아님**(`testPathIgnorePatterns: /supabase/`), `deno test --allow-env`로 실행. |
| `supabase/functions/place-search/deno.json`, `README.md` | Deno 설정 + 키 설정/배포/이월 안내. |
| `tsconfig.json` | `exclude: ["node_modules","supabase/functions"]` 추가(Deno 코드 tsc 제외). |
| `package.json` | jest `testPathIgnorePatterns: ["/node_modules/","/supabase/"]` 추가. |

> **마이그레이션 없음**: `muklogs`의 `kakao_place_id/category/area/address/road_address/lat/lng`는 `20260611130000_muklog_list.sql`에 **이미 선반영**. plan §3.1 확인.

### 프론트엔드 (data 계층 — `src/features/muklog/`)
| 파일 | 내용 |
|------|------|
| `kakaoCategory.ts` (+spec) | `mapKakaoCategory({categoryName,categoryGroupCode})`→8종 enum\|null, `deriveArea({addressName})`→동토큰\|null, `placeFieldsFromItem({item})`→`PlaceSelection`(자동채움). 순수. |
| `searchPlaces.ts` (+spec) | `searchPlaces({query})` invoke 래퍼 → `PlaceSearchItem[]`. 에러를 errors 토큰으로 정규화(식별불가→`PLACE_SEARCH_FAILED`). |
| `usePlaceSearch.ts` (+spec) | 디바운스(350ms)+캐싱(Map)+min 2글자+레이스 가드. `{query,setQuery,results,status,errorMessage}`. |
| `usePlaceSelection.ts` (+spec) | 컨테이너 선택 상태 훅 — `selectPlace({item})`→`PlaceSelection` 보관, `clearPlace()`→null. |
| `errors.ts` | 토큰 4종 추가: `QUERY_REQUIRED/KAKAO_KEY_MISSING/KAKAO_REQUEST_FAILED/PLACE_SEARCH_FAILED` + 한국어 폴백 메시지. |
| `types.ts` | `PlaceSearchItem`/`PlaceFields`/`PlaceSelection` 신설. `CreateMuklogInput`·`UpdateMuklogInput`·`MuklogEditInitial` += `PlaceFields`. `NormalizedMuklogInput` += 5필드. |
| `validate.ts` | `normalizeMuklogInput` place 필드 통과(trim/NaN방어, 좌표 쌍 무결성). `toMuklogRow`/`MuklogInsertRow` += snake 5필드. |
| `useCreateMuklog.ts` | 변경 없음 — `toMuklogRow(normalized)` 경유라 place 필드 **자동 포함**. |
| `useUpdateMuklog.ts` | normalize 입력 + update payload에 place 5필드 추가(편집 좌표 보존). |
| `useMuklog.ts` | select에 `address, kakao_place_id` 추가. `MuklogDetail` += `lat/lng/address/kakaoPlaceId`(roadAddress·hasCoords 기존). 편집 프리필용. |
| `MuklogEntrySheet.tsx` | 장소 섹션 배선: selectedPlace(컨테이너 controlled) → `syncFromSelectedPlace` effect로 placeName/카테고리(D1)/placeData 흡수. `placeData`(편집 initial 프리필) → create/edit payload 합류. `handleClearPlace`(D2 좌표 리셋). `MuklogEditSubmitInput`/`MuklogSelectedPlace` += place 필드. |
| `MuklogList.tsx` (작성 컨테이너) | `usePlaceSearch`+`usePlaceSelection` 소유 → 시트에 `placeSearch/selectedPlace/onSelectPlace/onClearPlace` 주입. 저장 후 `clearPlace()`. |
| `MuklogDetailRoute.tsx` (편집 컨테이너) | 동일 주입. editInitial += place 필드(좌표 보존), handleSubmitEdit가 update에 place 전달. |
| `index.ts` | `usePlaceSearch/usePlaceSelection/searchPlaces/mapKakaoCategory/deriveArea/placeFieldsFromItem` + `PlaceSearchItem/PlaceFields/PlaceSelection` export. |

---

## 2. 생산자 ↔ 소비자 매핑 (경계면 — QA §7 교차검증용)

### 2.1 Edge Function 응답 ↔ searchPlaces ↔ usePlaceSearch (§7-1)
```
place-search Edge Function  →  { results: PlaceSearchItem[] }  (camelCase: kakaoPlaceId, placeName,
   (Kakao keyword.json 정규화)     categoryName, categoryGroupCode, addressName, roadAddressName, lat, lng, phone)
        ↓ searchPlaces({query})  (data.results ?? []; body.error/invoke error → 토큰 throw)
   PlaceSearchItem[]
        ↓ usePlaceSearch        (디바운스+캐시; results/status/errorMessage)
   MuklogEntrySheet.placeSearch.results → PlaceSearchField → PlaceResultRow
```
- **좌표 변환 위치**: Edge Function이 `parseFloat(x)→lng, parseFloat(y)→lat`로 number 변환(클라는 number 그대로 소비). Kakao x=lng/y=lat 규약 준수.

### 2.2 검색 실패 토큰 ↔ errors.ts (§7-2)
`KAKAO_KEY_MISSING/KAKAO_REQUEST_FAILED/QUERY_REQUIRED`(Edge `{error}`) + `PLACE_SEARCH_FAILED`(클라 폴백)
→ `searchPlaces`가 토큰 throw → `usePlaceSearch`가 `mapMuklogError`로 한국어화 → `PlaceSearchField` errorMessage(폴백 톤). **단일 출처 동기화 완료**.

### 2.3 자동채움 매핑 ↔ DB 컬럼 (§7-3·§7-4·§7-5)
```
PlaceSearchItem ─ placeFieldsFromItem ─→ PlaceSelection {placeName, category(8종|null), area,
                  (mapKakaoCategory +       address, roadAddress, kakaoPlaceId, lat, lng}
                   deriveArea, 좌표 쌍)
        ↓ usePlaceSelection.selectPlace → 컨테이너 selectedPlace
        ↓ MuklogEntrySheet syncFromSelectedPlace effect → placeData + placeName + category(D1)
        ↓ handleSave 합류
   createMuklog/updateMuklog input (camel)
        ↓ normalizeMuklogInput → toMuklogRow / update payload (snake)
   muklogs 컬럼: kakao_place_id, address, road_address, lat, lng, category, area  (좌표 nullable)
```
- `mapKakaoCategory`는 **항상 8종 key 또는 null**만 반환(enum 드리프트 차단, §7-5 단언 테스트 포함).

### 2.4 편집 프리필 좌표 보존 ↔ useMuklog (§7-6 / D3 처리)
```
useMuklog select(+address,+kakao_place_id) → MuklogDetail{lat,lng,address,roadAddress,kakaoPlaceId}
   → MuklogDetailRoute.editInitial(+place 필드) → MuklogEntrySheet placeData(초기 시드)
   → 재검색 없이 저장해도 update payload에 좌표 보존(회귀 방지 단언: 시트 [C] + useUpdateMuklog T9)
```
- **D3 결정**: `useMuklog`/`MuklogDetail` 최소 확장(lat/lng/address/kakaoPlaceId 노출)로 처리.

### 2.5 verify_jwt ↔ functions.invoke (§7-7)
`functions.invoke`가 세션 access token 자동 첨부 → `verify_jwt`(기본 true) 유지 = 인증 사용자만 호출(쿼터 보호). 별도 config 없음(기본값).

---

## 3. 결정/divergence 반영 (plan 부록 D1~D4)

- **D1**(자동채움이 카테고리 칩 덮어쓰기): `syncFromSelectedPlace`에서 `category != null`일 때만 setCategory(매핑 실패 null은 기존 선택 보존). ✅
- **D2**(선택 해제 좌표 NULL): `handleClearPlace`가 `kakaoPlaceId/address/roadAddress/lat/lng` NULL 리셋(area·placeName 유지). 컨테이너는 `clearPlace()`로 selectedPlace=null(요약카드 해제). ✅
- **D3**(편집 프리필 위해 useMuklog 확장): 최소 확장 적용(§2.4). ✅
- **D4**(category_group_code 필터 미적용): Edge Function이 keyword.json만 호출(필터 없음), 카테고리 분류는 `mapKakaoCategory`. ✅
- **선택 표시 소유권**: ui-publisher의 controlled props([B] 테스트 잠금) 유지 → **컨테이너가 선택 상태 소유**, 시트는 effect로 흡수 + payload 합류. (검색 필드 가시성은 `placeSearch` prop 게이트 — 회귀 안전.)

---

## 4. 비용 가드레일 (plan §8) — 코드 반영 확인
- ✅ REST 키 = Edge Function 프록시(클라 미노출) / ✅ 디바운스 350ms / ✅ 쿼리 캐싱(Map) / ✅ min 2글자 / ✅ size=15 단일 페이지 / ✅ verify_jwt / ✅ AWS 미사용.

---

## 5. 미완/이월 (QA·후속)

- **Kakao REST 키 라이브 검증 이월**(social-auth 선례): `KAKAO_REST_API_KEY` 미발급 → `supabase functions serve`+실 invoke 스모크는 키 발급 후. 키 미설정 시 함수는 `KAKAO_KEY_MISSING` 반환(앱 크래시 0, 수동입력 폴백).
- **디바이스 스모크**: `functions.invoke` 실 네트워크/verify_jwt 실인증, 시트 자동채움 실기기 흐름.
- **OUT(범위)**: map-tab 핀 렌더(좌표 저장만), 영상, 사진 재정렬, 현재위치 정렬, 좌표 검증 트리거.

---

## 6. 테스트 (TDD)
- 신규 단위: `kakaoCategory`(17) `searchPlaces`(8) `usePlaceSearch`(5) `usePlaceSelection`(3) + errors place 토큰(3).
- 데이터 계층: `validate`(place 통과/snake 매핑), `useCreateMuklog`(place insert/NULL), `useUpdateMuklog`(좌표 보존 T9), `useMuklog`(shape).
- 통합: `MuklogEntrySheet` [B] controlled 골격 + [C] 자동채움 payload 합류/0건/에러/편집 보존(T10·T11), `MuklogList` 컨테이너 주입.
- 전체 `npm test` **617 통과** + `tsc --noEmit` 통과.
