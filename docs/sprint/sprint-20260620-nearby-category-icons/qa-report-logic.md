# QA Report — Logic / Integration (nearby-category-icons)

**스프린트:** sprint-20260620-nearby-category-icons
**검증자:** qa-logic
**판정: PASS** — 7 인수조건(T1–T7) 전부 통과, 회귀 0, 경계면 정합.
**비주얼(셸·토큰·킷 글리프 톤)은 범위 밖 → qa-visual 담당.**

---

## 종료 기준 — 직접 실행 확인
- `npx tsc --noEmit` → **exit 0**.
- `npm test` → **138 suites / 1221 tests 전부 green** (dev-notes 기록과 일치).
- 핵심 매핑·우선순위·배선 테스트 **mutation으로 load-bearing 확인**(아래).

---

## 1. 통과 (PASS)

### 매핑 정확성 (plan §3.2 표 전수)
- `nearbyCategoryEmoji.ts:16–36` 규칙 배열이 plan §3.2 주2 재배치 순서와 **정확히 일치**: 치킨🍗→피자🍕→버거🍔→고기🍖→초밥/회🍣→**쌀국수/아시안🍜(면 위)**→면🍜→분식🍢→일식🍱→중식🥟→양식🍝→카레🍛→술집🍺→베이커리🥐→해물🦪→샐러드🥗→디저트🍰→뷔페🍽️→**한식국물/백반🍲(면·고기 아래)**.
- 대표 종목 19종 전수 spec(`nearbyCategoryEmoji.spec.ts:11–36`) 기대 이모지 일치.

### 우선순위 (구체 우선) — load-bearing 확인
- "한식>갈비"→🍖, "한식>갈비찜"→🍖(고기>한식국물), "양식>피자"→🍕(피자>양식), "한식>치킨"→🍗, "한식>국밥"→🍲. 
- **Mutation 검증:** 고기 규칙에서 `'갈비'` 제거 시 `한식>갈비`·`갈비찜` 테스트가 즉시 red → 우선순위 테스트 load-bearing 확정.
- "한식" 단일 키워드는 표에 없음 → "음식점 > 한식"(종목 없음)은 폴백 🍽️(`spec:85`). **"모든 한식→🍜" 버그 제거 핵심**이 테스트로 고정됨.

### developer 보정 검증 (베이커리 vs 카레) — **둘 다 성립 확인**
- 카레 규칙(`nearbyCategoryEmoji.ts:28`)에서 `'커리'` 제외. 독립 재현 probe로 **"베이커리"→🥐 AND "카레/음식점>인도음식>카레"→🍛 동시 성립** 확인. 베이커리가 🍛로 떨어지는 `"베이커리"⊃"커리"` 충돌 차단됨.
- 부분일치 함정 추가 점검(probe): 스테이크→🍖, 갈비탕→🍖(고기>국물), 마라탕→🥟(마라>탕), 게장→🦪, 생선구이→🦪, 백반→🍲 — 전부 결정론적·의도대로.
- 트레이드오프(수용): 영문 `curry`/"커리"는 이제 폴백 🍽️로 흡수 — plan §3.2(영문 중립 폴백, out-of-scope)와 일치, 결함 아님.

### 폴백·계약 (빈 문자열 절대 반환 안 함)
- `nearbyCategoryEmoji`는 CE7→☕ 단락, 미지/빈/null/undefined→🍽️, 그 외 첫 매칭. **모든 경로가 비어있지 않은 글리프 반환**(`spec:115–121` 반환계약 단언).
- 따라서 `nearbyToMapMarkers`의 `=== '' ? PIN_FALLBACK_EMOJI` 분기 제거가 **안전**(폴백 단일 출처가 유틸 내부). `nearbyToMapMarkers.ts:20–23` 분기 없이 직접 사용 — 정합.
- CE7 mutation(☕ return 제거) 시 CE7 spec 3건 red → load-bearing.

### 배선 (생산자↔소비자 양쪽)
- `MapTabScreen.tsx:230–239`: `selectedNearby`(`categoryName`+`categoryGroupCode`+`distance`)에서 `coverEmoji=nearbyCategoryEmoji(...)`, 메타 `categoryName=lastCategorySegment(...)`, `distanceText=formatDistance(...)` 주입 — plan §3.5와 일치.
- `NearbySpotCard.tsx:85–91`: `<FoodCover category={null} emoji={coverEmoji} size54 radius14 emojiSize26 />` — 더 이상 raw 브레드크럼을 FoodCover에 넘기지 않음(☕ 일괄 폴백 버그 제거). **Mutation:** `emoji={coverEmoji}` 제거 시 "☕ 부재" 테스트 red → load-bearing.
- `FoodCover.tsx:56`: `emojiOverride || categoryEmoji(...) || cafe` — 순수 가산 변경. `emoji` 미지정 시 기존 경로 100% 불변. 그라데이션은 여전히 `categoryColors({key:category})`(주변 카드는 category=null→cafe 중립) — plan §3.3 정합.
- Edge `nearby-search/index.ts:103` `categoryGroupCode = doc.category_group_code ?? 'FD6'`, `categoryName`=브레드크럼 → 유틸 입력 계약(NearbyPlaceItem `types.ts:54–62`)과 일치.
- `lastCategorySegment.ts` ↔ NearbySpotCard 메타("칼국수 · 320m") — `buildMeta`가 빈 세그먼트/거리 결측 시 조각 생략(`NearbySpotCard.tsx:46–57`). 정합.

### 회귀 0 (§7 불변 대상 — git diff 전수 확인)
- 변경 파일은 in-scope 8개뿐: FoodCover(.tsx/.spec)·NearbySpotCard(.tsx/.spec)·nearbyToMapMarkers(.ts/.spec)·MapTabScreen(.tsx/.spec) + 신규 유틸 2종(+spec).
- **`mapKakaoCategory`·`MUKLOG_CATEGORIES`/`categories.ts`·`categoryEmoji`·`categoryColors`·`pinsToMapMarkers`(saved:true)·`placeFieldsFromItem`·PlaceSearchView·MuklogEditor**: 변경 목록에 **없음** → 한 줄도 안 바뀜 확정.
- FoodCover 기존 8 사용처(SelectedSpotCard·PlaceSelectedSummary·PlaceResultRow·MuklogCard·WishlistView·MuklogDetailScreen 등): `emoji=` 미전달(`grep`로 NearbySpotCard만 전달 확인) → 기존 경로 그대로, 회귀 0.

### 엣지케이스
- 브레드크럼 1단계("음식점")/2단계("음식점>한식")/빈/null/undefined → 🍽️ (spec:78–104). 영문 "Restaurant" → 🍽️. distance 결측 → 메타 거리 조각 생략. CE7+음식키워드 → group 우선 ☕. 전부 spec 커버.
- `lastCategorySegment`: 다단계/단일/빈/trim/연속구분자 6 케이스 spec.

### 코드 컨벤션 (`docs/code-convention.md`)
- 신규/변경 파일: `useCallback`/`useMemo` 0건, `export function` 0건(전부 화살표 const), named-object 인자, raw hex 0건, 파일명=심볼명. 통과.

---

## 2. 실패 (FAIL)
- 없음.

---

## 3. 미검증 (UNVERIFIED — 사유)
- **라이브 스모크(실기기 지도 핀·카드 이모지 육안)** — 출시 전 배치로 이월(plan §9, `_pre-launch-smoke-checklist.md`). 본 기능은 순수 변환이라 단위/통합 테스트로 결정론 검증 충분. 디바이스 렌더 픽셀은 qa-visual + 스모크 영역.

---

## 제품 판단 참고 (결함 아님 — 사용자 승인 영역)
- "케이크"→🥐(베이커리), "케익"→🍰(디저트): plan §3.2 표가 의도적으로 두 표기를 다른 행에 배치(14행 vs 17행) — 코드가 표와 일치. 명백한 오매핑 아님.
- 영문/"커리" 폴백 흡수는 plan out-of-scope 명시 사항.

---

## 보완 검증 — 실데이터 카테고리 매핑 보정 (2026-06-20)

**판정: PASS** — 실데이터 4건 보정이 spec/실데이터와 정합, 핵심 보정 mutation으로 load-bearing 확인, 부분일치 부작용 0, 회귀 0.

### 종료 기준 — 직접 실행 확인 (재실행)
- `npx tsc --noEmit` → **exit 0**.
- `npm test` → **138 suites / 1237 tests 전부 green** (예상치와 일치, 이전 1221→1237로 +16건 = 실데이터 12 + 회귀 가드 5 - 의미변경 이관 등).
- 맵 spec 단독 실행: `nearbyCategoryEmoji.spec.ts` + `nearbyToMapMarkers.spec.ts` = 59 tests green.

### 보정 4건 — 코드↔plan/실데이터 정합 (PASS)
`nearbyCategoryEmoji.ts` 규칙 배열 4건 조정 확인:
1. 치킨🍗(`:17`)에 `'닭','삼계탕','백숙','오리'` 추가(고기🍖보다 위) — 닭요리/삼계탕/닭한마리/찜닭 → 🍗.
2. 분식🍢(`:24`)에서 `'순대'` 제거.
3. 국물🍲(`:35`)에 `'순대'` 추가 — `한식 > 순대`(순대국) → 🍲.
4. 배열 맨 끝(`:36`)에 `{['한식'], '🍚'}` 폴백 — leaf 없는 `음식점 > 한식` → 🍚.

### ① 실데이터 12케이스 정확성 (PASS)
- `nearbyCategoryEmoji.spec.ts:78–98` 12케이스 박제 — 닭요리/삼계탕→🍗, 한식>순대→🍲, 한식(leaf無)→🍚, 국밥/해장국/설렁탕→🍲, 국수→🍜, 중식/중국요리→🥟, 분식→🍢, 스테이크,립→🍖. **spec 단언이 plan 의도·실데이터와 일치**, 12건 전수 green.

### ② 우선순위 load-bearing (mutation, PASS)
- **`'닭'` 제거** → `한식>육류,고기>닭요리`(🍗 기대)·`한식>닭갈비`(🍗 기대) **2건 red**. (삼계탕 케이스는 `'삼계탕'` 키워드가 독립으로 잡아 green 유지 — 의도된 중복 안전망.) 복구 후 green.
- **`'순대'`를 국물→분식으로 되돌림** → `한식>순대`(🍲 기대) **1건 red**. 복구 후 green.
- **`{['한식'],'🍚'}` 폴백 제거** → `음식점>한식`(🍚 기대) **1건 red**(🍽️로 떨어짐). 복구 후 green.
- → 3개 핵심 보정 전부 껍데기 아님(가드가 실제로 잡음).

### ③ 부분일치 함정 재감사 (전수 probe, PASS)
- **`'닭'`**: 닭요리/닭한마리/찜닭/닭갈비/오리고기/백숙/삼계탕 → 🍗(의도). **소갈비 `한식>육류,고기>갈비` → 🍖 유지**(닭 미포함 → 고기 규칙). 순수 소고기가 🍗로 새지 않음 — 회귀 가드 `:104`가 고정.
- **`'순대'`**: `한식>순대`만 🍲, **`분식>순대` → 🍢**(분식 규칙이 국물보다 위라 먼저 매칭) — 분식집이 🍲로 새지 않음.
- **`'한식'` 폴백**: 맨 끝 배치라 국밥/국수/순대/해장국/곱창/칼국수/중식/양식 등 모든 구체 종목이 앞에서 먼저 매칭 — **한식 폴백으로 잘못 새는 케이스 0**. **`'한정식'`은 `'한식'` 부분문자열 아님**(한-정-식) → 국물🍲 유지 확인.
- **`'오리'·'백숙'·'삼계탕'` 오매칭**: `grep`으로 전 규칙 키워드 스캔 — 이 3개 + `'닭'`은 **치킨 규칙에만 존재**, 타 카테고리 키워드에 우연한 substring 충돌 없음.

### ④ 회귀 0 (PASS)
- 보완은 `nearbyCategoryEmoji.ts`(규칙 4건) + 그 spec(실데이터 12 + 가드 5)만 변경. `nearbyToMapMarkers.ts` 본체 불변(로깅 포함 그대로).
- `git status` 전수: `mapKakaoCategory`/`categories.ts`/`MUKLOG_CATEGORIES`/`FoodCover`/`NearbySpotCard`/`MapTabScreen`/`nearbyToMapMarkers`(로깅 외) — **보완으로 추가 변경 없음**. 이전 스프린트 본체 테스트 계속 green(1237 total).

### ⑤ NEARBYCAT-TEMP 보존 (PASS)
- `nearbyToMapMarkers.ts:24–28` `[NEARBYCAT-TEMP]` 임시 로깅 **그대로 존재**(jest 실행 시 `[nearbyCat] {...}` 출력 확인) — 다음 기기 확인용으로 보존됨. 제거 안 됨.

### 보완 미검증 / 참고
- **plan.md §3.2 표(`plan.md:48·54·66`) doc-staleness(결함 아님):** 표는 *원본* 매핑(치킨 row에 닭/삼계탕/백숙/오리 없음, 분식 row에 순대 있음, 국물 row에 순대 없음, 🍚 폴백 행 없음)으로 남아 보완을 반영 안 함. 단일 출처 권위는 `dev-notes.md:49–68`(보완 섹션)이며 코드·spec과 일치 — 표만 미동기화. planner에 동기화 권고(로직 결함 아님).
- **이모지 종목 선택**은 사용자 승인 영역 — 본 검증은 plan/실데이터 불일치·명백한 오매핑만 결함 기준으로 적용. 해당 없음.
