# QA Report — muklog-place (장소검색)

> 검증자: qa-inspector. 우선순위: ①통합 정합성 ②기능 스펙 ③비주얼 충실도 ④보안·비용 ⑤코드 품질.
> 분류: ✅통과 / ❌실패(파일:라인+수정안) / ⏳미검증(사유).
>
> ## 최종 판정: ✅ PASS — 모든 인수조건 통과
> 비주얼 충실도(§1) + 통합 정합성·보안·비용·DB/RLS·TDD(§2) 전부 통과. ❌실패 0건. 비차단 nit 2건(수정 불필요). 라이브 Kakao 호출만 키 발급 후로 이월(social-auth 선례, 합당). **스프린트 완료 가능.**

---

## 1. 점진 검증 — ui-publisher 프리미티브 3종 (incremental, 시트 통합 전) ✅

ui-publisher 요청으로 컴포넌트 단위 비주얼 충실도 + 코드 품질을 선검증. **모두 통과.**

### 1.1 비주얼 충실도 (킷 `templates/muklog/mk-log.jsx` ↔ RN) ✅
| 컴포넌트 | 킷 라인 | 대조 결과 |
|---|---|---|
| `PlaceSearchField` 검색 pill | mk-log:390-394 + lk(없음, 인라인) | radius.full·hairline·surface·search18/fgMuted·input(Medium/15)·placeholder "장소, 음식점 검색" — **일치** ✅ |
| `PlaceResultRow` | mk-log:402-409 + lk.resultRow:507 | FoodCover 44/r12/e22 + name(Bold,15 override) + `label · road‖addr`(Medium,12.5,ellipsis,numberOfLines=1) + plus20/primary, gap12·pad11×12·radius.control — **일치** ✅ |
| `PlaceSelectedSummary` | mk-log:302-310 + lk.placeChosen:499 | primaryWeak bg + 1.5px accentLine + radius.xl(16) + FoodCover 48/r12/e24 + name(Bold/16) + `📍 road‖area`(Medium,12.5) + "선택 해제"(accentStrong,13) — **일치** ✅ |

- 상태 5종(plan §4.2): idle(미표시)/loading(스피너+검색 중…)/ready≥1(결과행)/ready 0건(안내문구 정확)/error(errorMessage, fgMuted 톤) — **전부 구현·테스트** ✅
- 의도적 divergence(ui-spec §4) 5건 모두 사유 타당: ①전체화면→시트 인라인(plan §4.1 근거) ②스켈레톤→ActivityIndicator ③error 색 fgMuted(폴백 톤, 저장실패 error색과 의미 구분) ④"변경"→"선택 해제"(plan D2) ⑤radius16=radius.xl. **승인.**

### 1.2 토큰 경유 (raw hex/숫자 색 0) ✅
- 3개 컴포넌트 전부 `theme.color.*`/`theme.radius.*`/`theme.spacing[*]` 경유. raw hex·rgba 직접 사용 0건.
- 의존 토큰 실재 확인: `radius.full/control/xl`(tokens.ts:110), `color.surface/hairline/fgMuted/fg/primary/primaryWeak/accentLine/accentStrong`(tokens.ts:62-69), `typography.cardTitle/navTitle/meta/caption/bodySm`(tokens.ts:129-149), `IconName.Search`+`search.svg`(Icon.tsx:22, icons.ts:12), `FoodCover{category,size,radius,emojiSize}`, `categoryLabel({key})`. **전부 존재.**

### 1.3 코드 컨벤션(docs/code-convention.md) ✅
- `useCallback`/`useMemo`: Place*.tsx 내 **0건**.
- 컴포넌트 전부 `export const X = () => {}` 화살표. `export function` 0건.
- named-object 인자: `onSelectResult({item})`·`resolveCategory({item})`·`categoryLabel({key})` 준수. (onPress/onChangeQuery/onClear/onChangeText는 콜백 예외로 정당.)
- 파일명 = 대표 export 심볼명 일치. barrel(index.ts) 등록 확인.

### 1.4 테스트 (TDD) ✅
- `PlaceSearchField`(8) + `PlaceResultRow`(7) + `PlaceSelectedSummary`(5) + `Icon`(6) = **26/26 통과** (`npx jest` 확인).
- `npx tsc --noEmit` **0 errors**.
- 테스트 의미성: 상태 5종 분기, 콜백 인자 shape(`{item}`), road→address·road→area 폴백, 미매핑(null) 카테고리 라벨 생략(enum 드리프트 안전), FoodCover 그라데이션 colors 단언 — 경계·실패경로 커버. load-bearing.

### 1.5 비차단 관찰(nit, 수정 불필요)
- fontSize를 `style`로 오버라이드한 곳(resultRow name 15 on cardTitle, summary sub 12.5 on meta, action 13 on caption)에서 variant의 `lineHeight`가 잔존(예: 22 vs 킷 ~19.5). **단일 행·세로 중앙정렬이라 시각 차 무시 가능.** 차후 정밀 정합 시 참고만.

---

## 2. 통합 정합성 검증 — 작업 #3 (developer 완료 후, 전체) ✅

작업 #3 완료 후 전 경계면 양쪽 동시 읽기로 교차검증. **모두 통과.**

### 2.1 보안(최우선): Kakao REST 키 비노출 ✅
- `grep -rni "KAKAO_REST_API_KEY|KakaoAK|rest_api_key|EXPO_PUBLIC.*kakao"` over `src`/`app.json`/`eas.json`/`.env`/`.env.example` → **키 값 노출 0건.** 매칭된 것은 전부 **에러 토큰 문자열**(`KAKAO_KEY_MISSING` 등, 키 값 아님)과 카테고리 매핑 로직뿐.
- REST 키는 Edge Function 서버 전용: `index.ts`에서 `Deno.env.get('KAKAO_REST_API_KEY')` → `Authorization: KakaoAK ...` 헤더로만 사용. 응답에 미포함. Deno 테스트 `정상 → 응답에 REST 키 미포함`이 `text.includes('TEST_SECRET_KEY')===false` 단언으로 보강.
- `.env.example`은 주석만(키 없음). `verify_jwt` 기본 true(인증 사용자만 호출 → 쿼터 보호).

### 2.2 경계면: Edge 응답 shape ↔ 클라 타입 ↔ 화면 ✅
- **생산자** `index.ts` `PlaceSearchItem`(kakaoPlaceId/placeName/categoryName/categoryGroupCode/addressName/roadAddressName/lat/lng/phone, x→lng·y→lat `parseFloat`) **↔ 소비자** `types.ts` `PlaceSearchItem`(동일 9필드) — **1:1 정확 일치.**
- unwrap: `searchPlaces`가 `body.results ?? []`로 언랩, `{ error: TOKEN }`는 토큰 throw. `usePlaceSearch.results` → `MuklogEntrySheet.placeSearch.results` → `PlaceSearchField`/`PlaceResultRow`. 일관.

### 2.3 에러 토큰 단일 출처 ✅
- Edge `{error:TOKEN}`(QUERY_REQUIRED 400 / KAKAO_KEY_MISSING 500 / KAKAO_REQUEST_FAILED 502) + 클라 PLACE_SEARCH_FAILED → `errors.ts MuklogErrorToken`(enum-style) ↔ `MUKLOG_ERROR_MESSAGES` 한국어 매핑 4종 모두 존재. `searchPlaces`가 invoke error/`context.json()`/data.error 3경로에서 토큰 추출 → `mapMuklogError`. 모든 실패가 수동입력 폴백 안내(저장실패 빨강과 의미 구분).

### 2.4 비용 가드레일: 디바운스·캐싱 실재 ✅
- `usePlaceSearch`: 350ms 디바운스(`setTimeout`+`clearTimeout`), 인메모리 캐시(`cacheRef: Map`, 동일 정규화 쿼리 재호출 0), min 2글자(`PLACE_SEARCH_MIN_LENGTH`) 광역검색 차단, `requestSeqRef` stale 응답 폐기. Edge `size=15`(페이지네이션 없음). **실재 확인.**

### 2.5 자동채움 매핑(D1/D2) + DB 정합 ✅
- `placeFieldsFromItem`(PlaceSearchItem→PlaceSelection): `mapKakaoCategory`(**항상 8종 key|null**, CE7→cafe 우선, 미매칭 null), `deriveArea`(동/읍/면/가/로), 좌표 **쌍 무결성**(둘 다 유한일 때만, NaN→null).
- **D1**(`MuklogEntrySheet.tsx:207`): `if (selectedPlace.category != null) setCategory(...)` → 매핑 성공 시 칩 자동선택, **null이면 기존 칩 보존.** ✅
- **D2**(`handleClearPlace:234`): `onClearPlace()` + `setPlaceData({...EMPTY_PLACE_DATA, area: prev.area})` → 좌표/주소/kakaoPlaceId NULL, **placeName 유지**. ✅
- payload 합류: 시트 `placeData` → `useCreateMuklog`/`useUpdateMuklog` → `validate.toMuklogRow`/update payload → muklogs snake 컬럼(kakao_place_id/address/road_address/lat/lng). `validate.ts`가 좌표 쌍 2차 방어(반쪽 좌표 차단 — map-tab 핀 보호).

### 2.6 편집 좌표 보존(§7-6/D3) ✅
- `useMuklog` select에 `lat, lng, address, road_address, kakao_place_id` 포함(L23) → camelCase 매핑(L146-156) → `MuklogDetailRoute editInitial`(kakaoPlaceId/address/roadAddress/lat/lng) → 시트 `placeData` 초기값 → **재검색 없이 저장해도 update payload에 보존.** 통합 테스트 `MuklogEntrySheet.spec [C]:379 "편집 진입 시 initial place 필드를 보존…좌표 손실 0"`이 단언.

### 2.7 RLS ✅
- `muklogs_update_own`(muklog_edit 마이그레이션): `using` + `with check` 모두 `created_by = auth.uid() AND room_id in (내 방)`. 신규 place 컬럼은 행 단위 정책 하에서 갱신(컬럼 별도 게이트 아님). update payload는 created_by/room_id 미포함(불변, 위변조 1차 차단).
- `muklogs_insert_member`(muklog_list)가 create + place 필드 insert 커버. **신규 마이그레이션 불필요**(place 컬럼은 muklog_list에서 nullable 선반영 — 정상).

### 2.8 회귀 안전 ✅
- `placeSearch` prop 게이트: 미주입 시 검색 영역 비표시·수동 입력만(`MuklogEntrySheet.tsx:376`). 기존 시트 테스트 무변경 통과.
- 컨테이너 배선: `MuklogList`/`MuklogDetailRoute` 모두 `usePlaceSearch`+`usePlaceSelection`, `clearPlace` on close(다음 작성 클린).

### 2.9 TDD / 빌드 ✅
- `npm test` **617/617 통과**(78 suites), `tsc --noEmit` **0 errors** (직접 실행 확인).
- Edge 핸들러는 Deno 테스트(`index.test.ts`, jest 제외 — 정규화/에러 분기/키 비노출 단언). 라이브 Kakao 호출은 키 발급 후 이월(social-auth 선례, 합당).
- 코드 컨벤션: 신규 파일 useCallback/useMemo 0(MuklogList:49는 **pre-existing** `useFocusEffect` 참조안정성 문서화 예외), 화살표 const, named-object 인자, useEffect 명명함수(`debounceSearch`/`syncFromSelectedPlace`), enum-style 토큰.

### 2.11 시트 통합 비주얼 충실도 (ui-spec §5.1·§7-8 토글) ✅
- **검색/수동 모드**(selectedPlace=null): `MuklogEntrySheet.tsx:374-397` — `PlaceSearchField`(검색 pill, placeSearch 주입 시) + 수동 `장소 이름` TextInput 공존(킷 searchBtn 대응).
- **선택 모드**(selectedPlace≠null): `:364-371` `PlaceSelectedSummary` 요약카드가 검색·수동입력 **대체** — 킷 `place ? placeChosen : searchBtn` 토글 정합.
- 자동채움 시 카테고리 칩 자동선택(D1)·결과행 커버는 `resolveCategory`(기본 `defaultResolveCategory=mapKakaoCategory`)로 카테고리별 그라데이션. 프리미티브 3종은 §1 승인본 그대로 사용(additive optional prop 확장, 요약카드 비주얼 영향 0).

### 2.10 비차단 관찰(nit, 수정 불필요)
- **편집 진입 시 요약카드 미표시**: 기존 Kakao 선택 먹로그를 편집해도 `selectedPlace=null`로 시작 → 검색 pill+수동입력(장소명 프리필) 표시, 요약카드 아님. **의도된 설계**(컨테이너 controlled, 좌표는 placeData로 보존·테스트됨). 킷 placeChosen 토글은 재검색 시 동작. 기능적 손실 없음.
- ~~**D1 null-보존 경로 시트레벨 테스트**~~ → **해소(developer 보강)**: `MuklogEntrySheet.spec.tsx:325 "자동채움 카테고리 매핑 실패(null) → 기존 칩 선택 보존(D1)"` 추가 — category=null 주입 후 cafe 칩 선택 → payload `category:'cafe'`(null로 안 덮임) 단언. 시트 레벨에서 D1 잠김. ✅ (전체 **618/618** + tsc 0 errors 재확인.)

---

## 3. planner/qa 확인 요청 응답 (ui-spec §6)
- **"선택 해제" 라벨**: plan D2(좌표 NULL 리셋·장소명 유지) 의미에 정확히 부합. 해제 후 검색 pill 복귀로 킷 "변경"(재검색) 기능도 포함 → **qa 동의.** 최종 채택은 planner 확인에 따름.
- **D1/D2 비주얼**: 동의(칩 보존/덮어쓰기, 요약카드↔검색pill 토글).
