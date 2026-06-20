# Dev Notes: 주변 음식점 카테고리 아이콘 정합 (nearby-category-icons)

> developer 산출(데이터·로직·배선). 비주얼/프리미티브(FoodCover.emoji prop·NearbySpotCard 골격)는 ui-publisher 선행 완료. 본 노트는 developer T1–T5만 다룬다.

## 변경/신규 파일

### 신규 (developer)
- `src/features/map/nearbyCategoryEmoji.ts` — 주변 종목→이모지 순수 유틸 + `NEARBY_FALLBACK_EMOJI='🍽️'`.
- `src/features/map/nearbyCategoryEmoji.spec.ts` — 표 전수 + CE7 + 우선순위 + 경계 + 반환계약(빈 문자열 절대 아님) 43 케이스.
- `src/features/map/lastCategorySegment.ts` — 브레드크럼→마지막 세그먼트 순수 유틸.
- `src/features/map/lastCategorySegment.spec.ts` — 다단계/단일/빈/trim/연속구분자 6 케이스.

### 변경 (developer)
- `src/features/map/nearbyToMapMarkers.ts` — 핀 이모지 산출을 `mapKakaoCategory→categoryEmoji`에서 **`nearbyCategoryEmoji`**로 교체. 유틸이 폴백 🍽️를 보장하므로 `=== '' ? PIN_FALLBACK_EMOJI` 분기 제거(폴백 단일 출처가 유틸 내부). MapMarker shape·`saved:false`·`id=kakaoPlaceId`·좌표 비유한 제외 불변.
- `src/features/map/nearbyToMapMarkers.spec.ts` — 기대 이모지를 `nearbyCategoryEmoji` 결과로 갱신(한식>칼국수→🍜, 한식>고기→🍖 신규, 미지→🍽️). shape 회귀 유지.
- `src/navigation/screens/MapTabScreen.tsx` — `selectedNearby`로 `coverEmoji = nearbyCategoryEmoji(...)`, 메타 `categoryName = lastCategorySegment(...)` 산출해 `NearbySpotCard`에 주입. ui-spec이 예고한 `coverEmoji` 미배선 tsc 에러 1건 해소.
- `src/navigation/screens/MapTabScreen.spec.tsx` — MARKER_TAP(saved:false) 케이스에 종목 이모지(🍜/🍖)·마지막 세그먼트 메타("칼국수 · 320m")·☕ 부재 단언 추가, 고기→🍖 케이스 신규.

### ui-publisher 선행분(developer 미변경, 배선만)
- `src/components/FoodCover.tsx`(+spec) — `emoji?: string` 오버라이드.
- `src/features/map/components/NearbySpotCard.tsx`(+spec) — `coverEmoji` prop, `category={null} emoji={coverEmoji}`.

## 핵심 구현
- **`nearbyCategoryEmoji` 우선순위(코드 배열 = 단일 출처, plan §3.2 주2 재배치):** 치킨🍗 → 피자🍕 → 버거🍔 → 고기🍖 → 초밥/회🍣 → **쌀국수/아시안🍜(면 위)** → 면🍜 → 분식🍢 → 일식일반🍱 → 중식🥟 → 양식🍝 → 카레🍛 → 술집🍺 → 베이커리🥐 → 해물🦪 → 샐러드🥗 → 디저트🍰 → 뷔페🍽️ → **한식국물/백반🍲(면·고기 아래)**. CE7(대소문자 무시) → ☕ 단락. "한식" 단일 키워드 미포함(종목 없으면 폴백). 미지/빈/null → 🍽️, **빈 문자열 절대 반환 안 함**.
- **plan 표 보정 1건(의도 보존):** 카레 키워드에서 `'커리'` 제외 — `"베이커리"⊃"커리"` 오매칭으로 베이커리가 🍛로 떨어지던 충돌 차단(plan §3.2 베이커리→🥐 의도 보존, 카레/인도로 대표값 커버). 코드 주석에 사유 명시.
- **`lastCategorySegment`:** `'>'` split → trim → 빈 토큰 제거 → 마지막. 빈/공백 → `''`.

## 생산자 ↔ 소비자 매핑 (qa-logic 교차검증 경계면)
| 생산자 | 소비자 | 계약 |
|---|---|---|
| `nearbyCategoryEmoji({categoryName, categoryGroupCode})` | `nearbyToMapMarkers`(핀 emoji), `MapTabScreen`(카드 coverEmoji) | 비어있지 않은 이모지 문자열(CE7→☕, 미지→🍽️). 소비측 `=== ''` 분기 불필요 |
| Edge `categoryName`/`categoryGroupCode`(NearbyPlaceItem) | `nearbyCategoryEmoji` | 브레드크럼·group_code 그대로 입력(빈/2단계/null 방어) |
| `nearbyCategoryEmoji` 규칙 배열 순서 | plan §3.2 표(주2 재배치) | 구체 우선(고기>한식국물, 피자>양식, 쌀국수>국수) |
| `lastCategorySegment({categoryName})` | `NearbySpotCard.categoryName`(메타) | 마지막 세그먼트(예 "칼국수"), 빈이면 메타에서 생략 |
| `FoodCover.emoji`(ui-publisher) | `NearbySpotCard`(developer 배선) | truthy면 그 글리프, 미지정이면 기존 category 폴백 불변 |

## 회귀 0 (§7 불변 — diff 0 확인)
`mapKakaoCategory`·`MUKLOG_CATEGORIES`·`categoryEmoji`·`categoryColors`·`pinsToMapMarkers`(saved:true, `PIN_FALLBACK_EMOJI` 소유)·`placeFieldsFromItem`·PlaceSearchView/MuklogEditor 카테고리 선택 — **한 줄도 안 바뀜**(`git diff` 미포함 확인). FoodCover 기존 8 사용처는 `emoji` 미지정이라 기존 경로 그대로.

## 검증 결과
- `npx tsc --noEmit` → **exit 0** (ui-spec 예고 `coverEmoji` 미배선 에러 해소).
- `npm test` → **138 suites / 1221 tests 전부 green** (신규 util spec 2종 + 갱신 spec 3종 포함, 회귀 0).

## 미완/이월
- 라이브 스모크(실기기 지도 핀·카드 이모지 육안 확인)는 출시 전 배치로 이월 — `_pre-launch-smoke-checklist.md` / architecture.md 출시 전 항목.

---

## 보완: 실데이터 매핑 보정 (2026-06-20)

라이브 카카오 `category_name` 수집 결과로 확인된 오분류 3종을 `nearbyCategoryEmoji.ts` 규칙으로 교정. TDD(Red→Green→Refactor): 실데이터 12케이스 + 회귀 가드 5케이스를 먼저 작성해 5건 Red 확인 후 규칙 변경으로 Green.

### 변경 파일
- `src/features/map/nearbyCategoryEmoji.ts` — `NEARBY_CATEGORY_RULES` 규칙 4건 조정 + 헤더/순서 주석 갱신.
- `src/features/map/nearbyCategoryEmoji.spec.ts` — 실데이터 12케이스 박제 블록 + 회귀 가드 블록 추가, 의미 바뀐 기존 케이스(`"음식점 > 한식"` 🍽️→🍚) 신규 블록으로 이관.

### 규칙 변경 요약(생산자=규칙 배열 ↔ 소비자=nearbyToMapMarkers/핀·카드)
1. 치킨 규칙(🍗, 고기 위)에 `'닭','삼계탕','백숙','오리'` 추가 → 닭요리·삼계탕·찜닭·닭갈비가 🍖보다 먼저 🍗.
2. 분식 규칙에서 `'순대'` 제거.
3. 국물 규칙(🍲)에 `'순대'` 추가 → `"한식 > 순대"`(순대국집) → 🍲.
4. 배열 맨 끝(국물 뒤·폴백 직전)에 `{ keywords: ['한식'], emoji: '🍚' }` 신설 → leaf 없는 `"음식점 > 한식"` → 🍚.

### 테스트 결과
- `npm test` → **138 suites / 1237 tests 전부 green**(회귀 0). `npx tsc --noEmit` → **exit 0**.
- 우선순위 load-bearing 확인(mutation): `'닭'` 제거 시 2건 Red, `'순대'`를 분식으로 되돌리면 1건 Red — 모두 가드가 잡음(복구 후 green).

### 잠재 부작용(부분일치)
- `'닭'`: `"닭요리"·"닭갈비"·"찜닭"·"닭한마리"`가 🍗(의도 OK). 소갈비/소고기/갈비(소)는 `'닭'` 미포함 → 🍖 유지(회귀 가드로 확인).
- `'순대'`: `"한식 > 순대"`만 🍲로 이동. 분식집은 `"음식점 > 분식"`이라 🍢 유지(회귀 확인).
- `'한식'`: 폴백을 맨 끝에 둬 구체 종목(국밥·국수·순대·해장국 등)은 앞 규칙에서 먼저 매칭 → 영향 없음. `'한정식'`은 `'한식'` 부분문자열 아님(별도 국물 규칙으로 🍲).
- 제약 준수: `nearbyCategoryEmoji.ts`(+spec)만 변경. 8종 enum·`mapKakaoCategory`·`categories.ts`·FoodCover·카드·MapTabScreen 불변. `nearbyToMapMarkers.ts`의 `[NEARBYCAT-TEMP]` 임시 로깅 보존(미제거).
