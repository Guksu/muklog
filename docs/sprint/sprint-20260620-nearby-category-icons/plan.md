# Sprint: 주변 음식점 카테고리 아이콘 정합 (nearby-category-icons)

## 1. 기능 한줄 정의
지도 탭에서 **주변(카카오 FD6) 음식점 핀의 이모지와 탭 카드 커버**가 실제 카카오 종목(고기·치킨·찌개·초밥·분식 등)을 반영해 표시된다 — 더 이상 모든 한식이 🍜로, 모든 카드가 ☕로 뭉개지지 않는다.

## 2. 범위
### In-scope
- **주변 핀·카드 표시 전용** 카테고리→이모지 매핑 순수 유틸 신설(`nearbyCategoryEmoji`).
- 지도 핀(`nearbyToMapMarkers`) 이모지 산출을 신규 유틸로 교체.
- 주변 카드(`NearbySpotCard`) 커버가 raw 브레드크럼을 `FoodCover`에 그대로 넘기지 않도록 배선 변경 — `FoodCover`에 선택적 `emoji` 오버라이드 prop 추가(권장안 a, §3.3) + 주변 카드는 유틸 이모지 주입.
- `MapTabScreen`이 `selectedNearby`로 이모지를 산출해 `NearbySpotCard`에 전달.
- (선택, In) 카드 메타 텍스트를 마지막 세그먼트만 표시(§4 결정: **In-scope, 별도 순수 유틸**).

### Out-of-scope (일부러 안 함 — 후속/다음 스프린트)
- **8종 enum(`MUKLOG_CATEGORIES`) 확장·변경 금지.** 저장 먹로그가 의존하는 사용자 선택 enum.
- **`mapKakaoCategory` 변경 금지.** 저장 플로우(PlaceSearchView/MuklogEditor 자동채움) 단일 출처.
- 저장 먹로그 핀(`pinsToMapMarkers`, saved:true) 이모지 로직 변경 — 불변.
- 카테고리 필터 칩, 핀 클러스터링, 주변 핀 그라데이션 색을 종목별로 다채화(주변은 중립 1색).
- 주변핀→먹로그 추가, 정확 dedup, 카드 별점/area/heart 추가.
- 이모지 표 후보의 i18n/현지화, 영문 카카오 카테고리 풀 대응(중립 폴백으로 흡수).

## 3. 데이터 · API 계약

### 3.1 신규 순수 유틸 (developer)
**위치:** `src/features/map/nearbyCategoryEmoji.ts` (주변 전용 — `src/features/muklog/`의 8종 enum 도메인과 격리).
**시그니처:**
```ts
export const nearbyCategoryEmoji = ({
  categoryName,        // Kakao 브레드크럼, 예 "음식점 > 한식 > 칼국수" (빈/2단계/null 허용)
  categoryGroupCode,   // Kakao category_group_code: 'FD6' | 'CE7' | ''
}: {
  categoryName: string;
  categoryGroupCode: string;
}): string => { /* 항상 이모지 문자열 반환(미지/빈 → NEARBY_FALLBACK_EMOJI) */ };

export const NEARBY_FALLBACK_EMOJI = '🍽️'; // 중립 폴백(PIN_FALLBACK_EMOJI와 같은 글리프지만 별도 상수 — 도메인 격리)
```
- **항상 비어있지 않은 이모지 문자열을 반환**한다(빈 문자열 절대 반환 안 함 — `categoryEmoji`와 다른 계약). 호출측이 `=== ''` 분기를 둘 필요 없음.
- `categoryGroupCode`가 `CE7`(대소문자 무시)이면 `categoryName` 무관하게 ☕.
- 그 외엔 `categoryName`을 lowercase 후 **규칙 표(§3.2)를 위→아래 순서로 부분일치**, 첫 매칭의 이모지. 매칭 없거나 빈 문자열이면 `NEARBY_FALLBACK_EMOJI`.
- 순수 함수(부수효과·네트워크 없음). 입력 외 의존 없음.

### 3.2 이모지 규칙 표 (키워드 → 이모지, **순서 = 우선순위, 위가 먼저 = 구체 우선**)
> 설계 핵심: **구체 종목이 일반 종목보다 위.** 예) "한식 > 고기"의 브레드크럼은 "고기"(🍖)가 "한식"(일반)보다 **먼저** 매칭돼야 한다. 따라서 한식 일반 키워드(없음 — 한식은 일반 폴백 처리 안 함, 구체 키워드로만 잡음)와 면 키워드를 **표 하단**에 둔다. CE7은 코드에서 표보다 먼저 단락 처리(§3.1).

| 순위 | 키워드(부분일치, lowercase) | 이모지 | 비고 |
|---|---|---|---|
| 1 | 치킨, 닭강정, 통닭 | 🍗 | 구체 — "한식>치킨"이 면/고기보다 먼저 |
| 2 | 피자 | 🍕 | "양식>피자"가 양식🍝보다 먼저 |
| 3 | 햄버거, 버거, 패스트푸드 | 🍔 | |
| 4 | 곱창, 막창, 갈비, 삼겹, 고기, 육류, 정육, 스테이크 | 🍖 | "한식>고기/갈비"가 한식 일반보다 먼저 |
| 5 | 초밥, 스시, 오마카세, 사시미, 회, 횟집 | 🍣 | 일식 일반(8)보다 먼저 |
| 6 | 라멘, 우동, 칼국수, 국수, 냉면 | 🍜 | 면 구체. (주의: "쌀국수"는 11에서 더 먼저 잡힘 — §3.2 주2) |
| 7 | 떡볶이, 분식, 김밥, 순대 | 🍢 | |
| 8 | 돈까스, 돈가스, 일식, 일본 | 🍱 | 일식 일반(초밥/회 제외 잔여) |
| 9 | 중식, 중국, 짜장, 짬뽕, 마라 | 🥟 | |
| 10 | 파스타, 스파게티, 이탈리, 양식, 리조또 | 🍝 | 피자(2)·버거(3)는 이미 위에서 분기 |
| 11 | 쌀국수, 베트남, 아시아, 태국, 쌀국 | 🍜 | 아시안면. **6보다 위에 둬 "쌀국수"가 "국수"(6)에 먹히지 않게** → 표 순서 재배치(주2) |
| 12 | 카레, 인도, 커리 | 🍛 | |
| 13 | 호프, 포차, 포장마차, 이자카야, 술집, 펍, 와인바, 칵테일바, 바(bar) | 🍺 | CE7 아님(음식점 술집 계열) |
| 14 | 베이커리, 제과, 빵, 도넛, 케이크 | 🥐 | CE7이 아닌 베이커리 표기 대비(브레드크럼이 FD6일 수 있음) |
| 15 | 해물, 해산물, 생선, 조개, 굴, 게, 새우, 장어 | 🦪 | |
| 16 | 샐러드 | 🥗 | |
| 17 | 디저트, 아이스크림, 빙수, 케익 | 🍰 | |
| 18 | 뷔페, 부페 | 🍽️ | 폴백과 같은 글리프(의도 — 뷔페는 종목 불특정) |
| 19 | 찌개, 전골, 탕, 국밥, 해장국, 곰탕, 설렁탕, 백반, 한정식 | 🍲 | 한식 국물/백반 — **반드시 면(6)·고기(4)보다 아래**(고기/면 구체 우선) |
| — | (매칭 없음 / 빈 / null) | 🍽️ | `NEARBY_FALLBACK_EMOJI` |

> **주1 — "한식" 단일 키워드는 표에 넣지 않는다.** "음식점 > 한식"만 있고 더 구체 종목이 없으면 폴백 🍽️로 떨어진다(8종 noodle 강제 매핑 버그의 원인 제거). 종목이 구체적이면(4·6·19·1 등) 해당 이모지로 잡힌다.
> **주2 — 쌀국수 vs 국수 충돌 해결:** 구현 표 실제 순서에서 **11(쌀국수/아시안, 🍜)을 6(면, 🍜) 위로 올린다.** 둘 다 🍜라 결과 이모지는 동일하므로 사용자 영향은 없으나, 우선순위 테스트(§5-1)를 위해 "쌀국수→아시안 규칙" 매칭을 명시적으로 검증한다. **developer는 위 표의 "순위" 숫자가 아니라 이 주석의 재배치를 코드 배열 순서의 단일 출처로 삼는다.** 최종 코드 배열 순서: 치킨 → 피자 → 버거 → 고기 → 초밥/회 → **쌀국수/아시안** → 면 → 분식 → 일식일반 → 중식 → 양식 → 카레 → 술집 → 베이커리 → 해물 → 샐러드 → 디저트 → 뷔페 → 한식국물/백반.

### 3.3 FoodCover 접근 — **권장안 (a): 선택적 `emoji` 오버라이드 prop** (ui-publisher 확정)
- `FoodCover`에 선택적 prop 추가:
  ```ts
  /** 이모지 직접 지정(주변 음식점 카드 등 8종 key 밖 종목). 주면 category→이모지 폴백을 건너뛴다. */
  emoji?: string;
  ```
  - `emoji`가 truthy면 그 값을 그대로 렌더(category→`categoryEmoji||cafe` 경로 미사용).
  - `emoji` 미지정이면 **기존 동작 완전 불변**(`categoryEmoji({key:category}) || cafe.emoji`).
- **그라데이션 정책:** 주변 카드는 `category`를 넘기지 않거나 의도된 중립값으로 넘겨 **cafe 그라데이션(중립 1색) 유지** — 주변 음식점은 종목별 그라데이션을 두지 않는다(Out-of-scope). 즉 주변 카드 커버 = **cafe 그라데이션 배경 + 종목별 이모지**. (배경색을 종목별로 다채화하는 건 후속.)
  - 구체 구현: `NearbySpotCard`가 `<FoodCover category={null} emoji={emoji} .../>` 호출 → 배경은 cafe 폴백(현행과 동일), 이모지만 정확.
- **권장 근거:** (b) 주변 전용 커버 컴포넌트 신설 대비 — 공용 프리미티브 1 prop 추가가 더 단순·저위험, 셸/그림자/사이즈 정합을 재구현할 필요 없음, 킷 FoodCover 1종 유지. 저장-먹로그 사용처 8곳은 `emoji` 미지정이라 **회귀 0**.

### 3.4 NearbySpotCard 계약 변경 (ui-publisher 골격 + developer 배선)
- 새 prop:
  ```ts
  /** 종목 이모지(주변 전용 매핑 결과). 부모(MapTabScreen)가 nearbyCategoryEmoji로 산출·주입. */
  coverEmoji: string;
  ```
- `categoryName` prop은 **메타 텍스트 용도로만 유지**(FoodCover로는 더 이상 전달 안 함).
- 내부: `<FoodCover category={null} emoji={coverEmoji} size=54 radius=14 emojiSize=26 />`.
- 메타 텍스트(§4 결정): `categoryName`을 그대로 쓰지 않고 마지막 세그먼트만 표시 → 부모가 가공해 넘기거나 카드 내부에서 가공. **결정: 순수 유틸 `lastCategorySegment`로 가공(§4).**

### 3.5 MapTabScreen 배선 (developer)
- `selectedNearby`(NearbyPlaceItem: `categoryName`+`categoryGroupCode`+`distance` 보유)에서:
  ```tsx
  <NearbySpotCard
    placeName={selectedNearby.placeName}
    categoryName={lastCategorySegment({ categoryName: selectedNearby.categoryName })}
    coverEmoji={nearbyCategoryEmoji({
      categoryName: selectedNearby.categoryName,
      categoryGroupCode: selectedNearby.categoryGroupCode,
    })}
    distanceText={formatDistance({ distance: selectedNearby.distance })}
  />
  ```
- `nearbyToMapMarkers`(지도 핀)도 동일 `nearbyCategoryEmoji`로 이모지 산출 — §3.6.

### 3.6 nearbyToMapMarkers 변경 (developer)
- import를 `mapKakaoCategory`+`categoryEmoji` → `nearbyCategoryEmoji`로 교체.
- ```ts
  const emoji = nearbyCategoryEmoji({ categoryName: it.categoryName, categoryGroupCode: it.categoryGroupCode });
  markers.push({ id: it.kakaoPlaceId, lat, lng, emoji, saved: false });
  ```
- `nearbyCategoryEmoji`는 빈 문자열을 반환하지 않으므로 `emoji === '' ? PIN_FALLBACK_EMOJI` 분기 제거 가능(유틸 내부 폴백이 단일 출처). **MapMarker 계약·좌표 비유한 제외·saved:false·id=kakaoPlaceId 불변.** saved 머지(`mergeMapMarkers`)·dedup 불변.

## 4. 화면 · UX
- **컴포넌트:** `FoodCover`(prop 1 추가), `NearbySpotCard`(prop 교체), `MapTabScreen`(배선), 신규 유틸 2종(`nearbyCategoryEmoji`, `lastCategorySegment`).
- **상태:** 로딩/빈/에러는 기존 MapTabScreen overlay 그대로(변경 없음). 본 스프린트는 표시 정합만.
- **메타 텍스트 결정(§확정 = In-scope):** 현재 "음식점 > 한식 > 칼국수 · 320m" → **"칼국수 · 320m"**(마지막 세그먼트만). 별도 순수 유틸 `lastCategorySegment({categoryName}) → string`:
  - `>` 기준 split, trim, 빈 토큰 제거, 마지막 토큰 반환.
  - 세그먼트 1개("음식점")면 그대로 "음식점". 빈/공백이면 빈 문자열(카드 buildMeta가 거리만 표시).
  - 위치: `src/features/map/lastCategorySegment.ts`.
- **원티드 토큰:** FoodCover/NearbySpotCard 기존 토큰(surface·radius.card·spacing·shadow.md) 불변. 신규 토큰 없음.
- **이모지 정합 검수:** muklog 킷은 음식 이모지 허용(CLAUDE.md). ui-publisher가 §3.2 표 글리프가 킷 톤과 충돌 없는지 ui-spec에서 마감.

## 5. 작업 목록 (각 인수조건 포함)

### developer
- [ ] **T1. `nearbyCategoryEmoji` 순수 유틸 신설** — 인수조건: §3.2 표 대표 종목이 기대 이모지로 매핑(고기→🍖·치킨→🍗·찌개→🍲·피자→🍕·초밥→🍣·분식→🍢·중식→🥟·양식→🍝·카레→🍛·술집→🍺·해물→🦪·샐러드→🥗·디저트→🍰), CE7→☕, 미지/빈/null→🍽️. — 테스트: `nearbyCategoryEmoji.spec.ts` 표 전수 + CE7 + 폴백.
- [ ] **T2. 우선순위(구체 우선) 검증** — 인수조건: "음식점 > 한식 > 갈비"→🍖(한식 폴백 아님), "음식점 > 한식 > 칼국수"→🍜, "음식점 > 한식 > 국밥"→🍲, "음식점 > 양식 > 피자"→🍕(🍝 아님), "음식점 > 한식 > 치킨"→🍗. — 테스트: 우선순위 케이스 그룹(여러 키워드 동시 포함 시 위 규칙 승리).
- [ ] **T3. `nearbyToMapMarkers` 배선 교체** — 인수조건: 핀 이모지가 `nearbyCategoryEmoji` 결과와 동일(고기 핀→🍖), MapMarker shape·saved:false·id=kakaoPlaceId·좌표 비유한 제외 불변. — 테스트: `nearbyToMapMarkers.spec.ts` 갱신(한식>고기→🍖, 미지→🍽️) + shape 회귀.
- [ ] **T4. `lastCategorySegment` 순수 유틸 + MapTabScreen 메타 배선** — 인수조건: "음식점 > 한식 > 칼국수"→"칼국수", "음식점"→"음식점", ""→"". — 테스트: `lastCategorySegment.spec.ts`.
- [ ] **T5. MapTabScreen → NearbySpotCard 배선** — 인수조건: `selectedNearby`의 `categoryName`+`categoryGroupCode`로 `coverEmoji` 산출·주입, `categoryName` prop엔 `lastCategorySegment` 결과 주입. — 테스트: `MapTabScreen.spec.tsx`에 nearby 선택 시 NearbySpotCard가 coverEmoji prop을 받는지(또는 카드 렌더 이모지 검증).

### ui-publisher
- [ ] **T6. `FoodCover`에 선택적 `emoji` 오버라이드 prop 추가** — 인수조건: `emoji` 주면 그 이모지 렌더(category 폴백 미사용), `emoji` 미지정이면 기존 동작 100% 불변(category→`categoryEmoji||cafe`), 그라데이션은 category 기준 그대로. — 테스트: `FoodCover.spec.tsx`에 케이스 2개 추가(오버라이드 렌더 / 미지정 회귀), 기존 4 케이스 green 유지.
- [ ] **T7. `NearbySpotCard` 골격 변경** — 인수조건: `coverEmoji` prop을 받아 `<FoodCover category={null} emoji={coverEmoji} .../>` 렌더, 셸(54×54/radius14/emojiSize26·surface·shadow.md·padding) 불변, 카드가 더 이상 raw 브레드크럼을 FoodCover에 넘기지 않음(☕ 폴백 버그 제거). — 테스트: `NearbySpotCard.spec.tsx` 갱신(coverEmoji='🍖' 주면 🍖 렌더, ☕ 아님).
- [ ] **T8. §3.2 이모지 글리프 킷 정합 검수(ui-spec)** — 인수조건: 표 21종 글리프가 muklog 킷 음식 이모지 톤과 충돌 없음, 비주얼 디테일(주변 카드 cafe 중립 배경 + 종목 이모지) ui-spec에 명문화. — 테스트: 비주얼(qa-visual 교차검증, 단위 테스트 아님).

## 5-1. 테스트 케이스 (TDD — Red 먼저)
> 전부 **순수 유틸·컴포넌트 단위 테스트**(jest-expo + @testing-library/react-native). 외부 SDK·네트워크 없음 → 모킹 불필요. `docs/testing-strategy.md` 경계: 유틸/화면 ✅.

**A. `nearbyCategoryEmoji` (정상/경계/실패)**
- 정상(표 전수): 각 종목 대표 브레드크럼 → 기대 이모지(13+ 케이스). 예: `{categoryName:'음식점 > 한식 > 곱창', groupCode:'FD6'} → '🍖'`.
- 정상 CE7: `{categoryName:'카페 > 커피전문점', groupCode:'CE7'} → '☕'` 및 `{categoryName:'음식점 > 한식', groupCode:'CE7'} → '☕'`(group 우선).
- 경계 우선순위: 한식>갈비→🍖, 한식>칼국수→🍜, 한식>국밥→🍲, 양식>피자→🍕, 한식>치킨→🍗(구체가 일반보다 먼저).
- 경계 쌀국수: `'아시아 > 베트남 > 쌀국수' → '🍜'`(아시안 규칙, "국수"에 먹혀도 글리프 동일하되 규칙 매칭 검증).
- 경계 입력: `categoryName:''`→🍽️, `'음식점'`(1단계)→🍽️(구체 종목 없음), `'음식점 > 한식'`(2단계, 종목 없음)→🍽️, null/undefined 방어→🍽️.
- 실패/미지: `'관광 > 명소'`→🍽️, 영문 `'Restaurant'`→🍽️(중립 폴백 흡수).
- **반환 계약:** 모든 케이스에서 빈 문자열 절대 아님(`expect(result).not.toBe('')`).

**B. `nearbyToMapMarkers` (회귀 갱신)**
- 한식>고기 item → `emoji:'🍖'`(기존 spec의 noodle 기대값 변경), 미지 → '🍽️'.
- shape 회귀: `{id:kakaoPlaceId, lat, lng, emoji, saved:false}`, 좌표 NaN/Infinity 제외, 빈 배열→빈 배열(기존 케이스 유지).

**C. `lastCategorySegment`**
- "음식점 > 한식 > 칼국수"→"칼국수", "음식점"→"음식점", ""→"", "  음식점 > 한식  "→"한식"(trim).

**D. `FoodCover` (prop 추가 + 회귀)**
- `emoji='🍖'` + `category=null` → 🍖 렌더(cafe ☕ 아님), 그라데이션은 cafe(category=null 폴백) 유지.
- `emoji` 미지정, `category='pasta'` → 🍝(기존 동작), `category='sushi'` 그라데이션 유지 — 기존 4 케이스 green.

**E. `NearbySpotCard` (회귀 갱신)**
- `coverEmoji='🍖'` → 카드에 🍖 렌더(☕ 아님 — 버그 회귀 방지 단언 `expect(queryByText('☕')).toBeNull()`).
- 메타: `categoryName='칼국수'`,`distanceText='320m'` → "칼국수 · 320m". 거리 결측 → "칼국수".

**F. `MapTabScreen` (통합)**
- nearby 핀 선택(MARKER_TAP saved:false) → NearbySpotCard 렌더, 종목 이모지 표시(예 한식>고기 item 선택 → 🍖, ☕ 아님), 메타 마지막 세그먼트.

## 6. 엣지케이스
- **브레드크럼 형태:** "음식점"만(1단계)→🍽️ / 2단계 "음식점 > 한식"(종목 없음)→🍽️ / 빈 문자열→🍽️ / null·undefined 방어→🍽️.
- **여러 키워드 동시 포함:** "한식 > 갈비찜"(고기+찌개 어휘)→표 순서상 고기(🍖)가 한식국물(🍲)보다 위 → 🍖. "양식 > 피자"(양식+피자)→피자(🍕)가 양식(🍝)보다 위. 우선순위가 결정론적으로 승리(§3.2 순서).
- **쌀국수 vs 국수:** 둘 다 🍜라 사용자 영향 0, 단 규칙 매칭은 아시안(11)을 면(6) 위로 배치해 명시적 검증(§3.2 주2).
- **CE7 + 음식 키워드 충돌:** group=CE7이고 categoryName="음식점 > 한식"이어도 ☕(group 우선 단락).
- **한글 외 카테고리:** 영문/혼합 브레드크럼은 키워드 미스 → 🍽️(중립, 깨지지 않음).
- **distance 결측(null):** `formatDistance`가 빈 문자열/미전달 → 메타 "칼국수"만(기존 buildMeta 동작 불변).
- **동시성(커플 2명):** 본 기능은 표시 순수 변환이라 상태 공유 없음 — 두 기기에서 같은 핀이 같은 이모지(결정론적). 영향 없음.
- **네트워크:** 유틸은 네트워크 없음. nearby-search 실패는 기존 useNearbyPlaces 상태 처리(변경 없음).
- **enum 드리프트:** 신규 유틸은 8종 enum과 무관 → enum 변경/미지 key가 들어와도 영향 없음(격리 성공).

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)
- `nearbyCategoryEmoji`(생산) ↔ `nearbyToMapMarkers`·`MapTabScreen`(소비) — 이모지 문자열 계약(빈 문자열 안 나옴).
- `nearbyCategoryEmoji` ↔ §3.2 표 — 규칙 순서가 코드 배열 순서와 일치(주2 재배치 반영).
- `FoodCover.emoji` prop(생산: ui-publisher) ↔ `NearbySpotCard`(소비: developer 배선) — prop 명·동작.
- `FoodCover` 기존 8 사용처(MuklogCard·SelectedSpotCard·PlaceSelectedSummary·PlaceResultRow·WishlistView·MuklogDetailScreen·index) — `emoji` 미지정 회귀 0(qa-logic 전수 확인).
- `lastCategorySegment`(생산) ↔ NearbySpotCard 메타(소비) — 마지막 세그먼트 표시.
- **불변 검증 대상(회귀 0):** `MUKLOG_CATEGORIES`·`mapKakaoCategory`·`categoryEmoji`·`pinsToMapMarkers`(saved:true)·`placeFieldsFromItem`(저장 자동채움)·PlaceSearchView/MuklogEditor 카테고리 선택 — **이번 스프린트에서 한 줄도 바뀌지 않아야 함.**
- **비주얼(qa-visual):** 주변 카드 = cafe 중립 배경 + 종목 이모지, 셸 정합(54/radius14/emojiSize26), 킷 음식 이모지 톤.

## 8. 비용 가드레일 체크
- **Kakao 호출:** 변경 없음 — 본 스프린트는 이미 받은 응답(`categoryName`/`groupCode`)의 클라이언트 표시 변환만. 추가 API 호출·디바운스 대상 없음.
- **이미지:** 해당 없음(이모지 텍스트 렌더).
- **viewport:** 기존 nearby-search 디바운스·캐시·dedup(slice2) 그대로, 본 스프린트가 건드리지 않음.
- **AWS:** 미사용. Supabase 무료 티어 영향 없음(서버 변경 0).
- **순수 유틸:** 부수효과·네트워크 없음 → 런타임/비용 무영향.

## 9. 완료 기준
- `npm test` 전부 green(신규 spec 5종 + 갱신 spec 3종 포함, 기존 회귀 0).
- 지도 핀·주변 카드가 종목별 이모지로 표시(카드 ☕ 일괄 폴백 버그 해소).
- §7 불변 대상 diff 0.
- (라이브 스모크는 출시 전 배치로 이월 — architecture.md §출시 전 필요 ①.)
