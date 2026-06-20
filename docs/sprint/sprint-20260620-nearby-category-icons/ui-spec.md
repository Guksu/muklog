# UI Spec: 주변 음식점 카테고리 아이콘 정합 (nearby-category-icons)

> 단일 출처: `plan.md` + 디자인 킷 `templates/muklog`(mk-ui `FoodCover`, mk-home 선택 스팟 카드 셸).
> 본 스펙은 ui-publisher 담당분(프리미티브 prop 추가 + 화면 골격 prop 계약)만 다룬다.
> 데이터·매핑 로직(`nearbyCategoryEmoji`·`lastCategorySegment`·`nearbyToMapMarkers`·MapTabScreen 배선)은 developer 몫(plan T1–T5).

---

## 1. 변경 범위 한줄
주변 카드(`NearbySpotCard`)가 카카오 raw 브레드크럼을 `FoodCover` `category`로 넘겨 **전부 ☕로 폴백**되던 버그 제거.
`FoodCover`에 선택적 `emoji` 오버라이드 prop을 추가하고, 주변 카드는 종목 이모지를 `emoji`로 주입한다.
**셸/그림자/radius/emojiSize/그라데이션 정책은 킷 그대로 불변 — 중앙 이모지 글리프만 정확해진다.**

---

## 2. 킷 ↔ RN 매핑

### 2.1 FoodCover (킷 mk-ui `FoodCover`, mk-ui.jsx:49-62)
| 킷 요소 | 킷 동작 | RN 매핑(현행) | 본 스프린트 변경 |
|---|---|---|---|
| 배경 | `background = CAT[cat]||CAT.cafe` 의 `linear-gradient(140deg)` | `expo-linear-gradient`, `colors = categoryColors({key:category})`, start{0.08,0}→end{0.92,1} | **불변** — 그라데이션은 계속 `category` 기준 |
| 중앙 이모지 | `CAT[cat]||CAT.cafe` 의 대표 이모지 1글자, drop-shadow(0 2px 6px rgba(0,0,0,.12)) | `<Text fontSize={emojiSize}>`, textShadow 근사 | **글리프 출처만 분기:** `emoji` prop 주면 그 값, 미지정이면 기존 `categoryEmoji||cafe` |
| 모서리 | radius(소비처 지정) | `borderRadius: radius`(기본 20) | 불변 |
| overflow | hidden | `overflow:'hidden'` | 불변 |

> 킷엔 `emoji` 오버라이드 개념이 없다(킷 FoodCover는 항상 `CAT[cat]` 글리프). muklog 주변 카드는 카카오 종목이 8종 enum 밖이라, **킷 FoodCover의 "grad 배경 + 중앙 대표 이모지" 골격을 깨지 않으면서** 글리프만 외부 주입하도록 1 prop을 확장한 것 — 셸은 킷 1종 유지(권장안 a). 킷 비주얼 충실도 영향 0.

### 2.2 NearbySpotCard (킷 mk-home 선택 스팟 카드 셸, mk-home.jsx:287-301)
| 셸 요소 | 킷/현행 값 | 본 스프린트 변경 |
|---|---|---|
| 카드 배경 | `theme.color.surface` | 불변 |
| 상단 radius | `theme.radius.card`(상단 좌/우) | 불변 |
| 그림자 | `theme.shadow.md`(상향 도킹 카드) | 불변 |
| padding | top `spacing[14]` / bottom `spacing[16]` / horizontal `spacing[20]` | 불변 |
| row gap | `spacing[12]` | 불변 |
| FoodCover | 54×54 / radius 14 / emojiSize 26 | **셸 치수 불변.** category=null + emoji 주입으로 전환 |
| 가게명 | `Text variant="cardTitle" color="fg"` numberOfLines 1 | 불변 |
| 메타줄 | `Text variant="meta" color="fgMuted"`, marginTop `spacing[4]`, "카테고리 · 거리" | **불변(레이아웃).** 카테고리 텍스트가 raw 브레드크럼 → 마지막 세그먼트로 바뀜(값만, 부모 가공) |

> **주변 카드 커버 = cafe 중립 그라데이션 배경 + 종목 이모지.** 종목별 배경 다채화는 Out-of-scope(plan §2). `category={null}`이라 배경은 cafe 폴백(현행과 동일), 이모지만 정확해진다.

### 2.3 이모지 글리프 킷 톤 검수 (plan T8)
plan §3.2 표 21종 글리프(🍗🍕🍔🍖🍣🍜🍢🍱🥟🍝🍛🍺🥐🦪🥗🍰🍽️🍲☕)는 모두 **단색 음식/음료 이모지**로, muklog 킷이 이미 사용하는 8종 저장 카테고리 이모지(🍚🍖🍜🍣🍕🍗🍝☕ 등 `MUKLOG_CATEGORIES`)와 **동일 톤·동일 렌더 방식(Text 글리프 + drop-shadow)**. muklog 킷은 음식 이모지를 허용(CLAUDE.md 플레이풀 예외)하므로 톤 충돌 없음. 신규 색/에셋 없음. **비주얼 충돌 0 — 승인.**

---

## 3. Prop 계약 (developer가 채울 값)

### 3.1 FoodCover — 신규 `emoji?: string` (ui-publisher 제공)
```ts
/**
 * 이모지 직접 지정(주변 음식점 카드 등 8종 key 밖 종목). 주면 category→이모지 폴백을 건너뛴다.
 * 그라데이션 배경은 영향받지 않고 여전히 category 기준(주변 카드는 category=null → cafe 중립 배경 유지).
 */
emoji?: string;
```
- `emoji` truthy → 그 이모지를 중앙 글리프로 렌더(category→`categoryEmoji||cafe` 폴백 경로 미사용).
- `emoji` 미지정/빈 문자열 → **기존 동작 100% 불변**(`categoryEmoji({key:category}) || cafe.emoji`).
- 그라데이션 `colors`는 **항상** `categoryColors({key:category})` — `emoji`와 무관.
- 구현: `const emoji = emojiOverride || categoryEmoji({key:category}) || MUKLOG_CATEGORIES.cafe.emoji;`

### 3.2 NearbySpotCard — prop 교체/추가 (ui-publisher 골격 + developer 주입)
```ts
export type NearbySpotCardProps = {
  placeName: string;       // 가게명(Kakao placeName) — 그대로
  categoryName: string;    // [의미 변경] 메타 텍스트용 "마지막 세그먼트"(예 "칼국수"). 부모가 lastCategorySegment로 가공해 주입
  coverEmoji: string;      // [신규] 종목 이모지. 부모가 nearbyCategoryEmoji로 산출해 주입 → FoodCover emoji로 전달
  distanceText?: string;   // 거리 표기(예 "320m"). 결측이면 미전달 → 거리 조각 생략 — 그대로
};
```
- 내부 렌더: `<FoodCover category={null} emoji={coverEmoji} size={54} radius={14} emojiSize={26} />`.
- **더 이상 raw `categoryName`을 FoodCover에 넘기지 않는다**(☕ 일괄 폴백 버그 제거).
- `categoryName` prop은 **메타줄 텍스트 전용**으로만 사용(FoodCover로 전달 안 함).

### 3.3 developer 배선 가이드 (plan §3.5, MapTabScreen — developer T5)
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
- `coverEmoji`는 **required** — `nearbyCategoryEmoji`가 항상 비어있지 않은 이모지를 반환하므로(plan §3.1) 카드는 빈 문자열 분기를 둘 필요 없음.
- **현재 MapTabScreen은 아직 미배선** → `tsc --noEmit`에 `MapTabScreen.tsx(229): Property 'coverEmoji' is missing` 1건 에러가 남아 있음. **developer T5 배선 후 해소**(예상된 핸드오프 경계, ui-publisher 책임 아님).

---

## 4. 회귀 불변 (qa-visual / qa-logic 확인 대상)

### 4.1 FoodCover 기존 사용처 8곳 — `emoji` 미지정 → 동작 100% 불변
| 사용처 | 파일 | category 전달 | 회귀 |
|---|---|---|---|
| 먹로그 카드 | `src/features/muklog/MuklogCard.tsx:117` | `muklog.category` | 불변(emoji 미지정) |
| 선택 스팟 카드 | `src/features/map/components/SelectedSpotCard.tsx:62` | `category` | 불변 |
| 검색결과 행 | `src/features/muklog/PlaceResultRow.tsx:63` | `category` | 불변 |
| 선택 요약 | `src/features/muklog/PlaceSelectedSummary.tsx:64` | `category` | 불변 |
| 위시리스트 | `src/features/wishlist/WishlistView.tsx:110` | `category` | 불변 |
| 상세 화면 | `src/navigation/screens/MuklogDetailScreen.tsx:283` | `category` | 불변 |

→ 6개 파일 7개 호출부 전부 `emoji` prop 없음 → `emojiOverride` falsy → 기존 `categoryEmoji||cafe` 경로 그대로. **회귀 0.** (NearbySpotCard만 신규 경로.)

### 4.2 로직/토큰 불변 (한 줄도 안 바뀜)
- `MUKLOG_CATEGORIES`(8종 enum) · `categoryEmoji` · `categoryColors` · `mapKakaoCategory` — **변경 금지, 미변경.**
- `src/theme/tokens.ts` — 신규 토큰 없음(surface·radius.card·shadow.md·spacing 기존 토큰 재사용).

---

## 5. 산출물

### 변경 파일 (ui-publisher)
- `src/components/FoodCover.tsx` — `emoji?: string` prop 추가 + 글리프 분기(셸/그라데이션 불변).
- `src/features/map/components/NearbySpotCard.tsx` — `coverEmoji` prop 추가, `categoryName` 의미를 메타-세그먼트로 명시, FoodCover에 `category={null} emoji={coverEmoji}` 전달. 셸 치수 불변.

### 테스트 (TDD, Red→Green)
- `src/components/FoodCover.spec.tsx` — +3 케이스(emoji 오버라이드 렌더 / 오버라이드여도 그라데이션 cafe 유지 / emoji 미지정 회귀). 기존 4 케이스 green 유지.
- `src/features/map/components/NearbySpotCard.spec.tsx` — coverEmoji 기반으로 갱신: 종목 이모지(🍖) 렌더 + ☕ 부재 단언, 메타 마지막 세그먼트("칼국수 · 320m") 표시.

### 검증 결과
- `npx jest FoodCover NearbySpotCard` → **12 passed**.
- `npx tsc --noEmit` → 1건 에러(`MapTabScreen` `coverEmoji` 미배선) — **developer T5 핸드오프 경계**(ui-publisher 산출물은 타입 정합).

---

## 6. RN 제약/근사 메모
- 본 스프린트는 신규 RN 제약 근사 없음(이모지 글리프 = Text 렌더, 킷과 동일 방식). 기존 FoodCover의 linear-gradient 140deg 근사·이모지 drop-shadow 근사는 현행 유지(변경 없음).
