# QA Report — Visual (주변 음식점 카테고리 아이콘 정합 / nearby-category-icons)

> 검증자: qa-visual · 날짜: 2026-06-20
> 단일 출처: 킷 `templates/muklog`(mk-ui `FoodCover` mk-ui.jsx:49-62, mk-home 선택 스팟 카드 셸 mk-home.jsx:302-315) + `ui-spec.md`
> 범위: 비주얼 충실도(레이아웃·토큰·카피)만. 로직·매핑 정확성(`nearbyCategoryEmoji`·`lastCategorySegment`·MapTabScreen 배선)은 qa-logic 담당(범위 밖).
> 방법: 킷 JSX ↔ RN 파일:라인을 동시에 열어 3축 교차검증.

## 결론: **PASS**

이번 변경은 킷 비주얼 골격을 한 줄도 깨지 않는다. `FoodCover`의 `emoji` 오버라이드는 **중앙 글리프 출처만** 분기하고 셸·그라데이션·radius·emojiSize·그림자는 불변. `NearbySpotCard` 셸은 `SelectedSpotCard`와 토큰 단위로 동일하다. raw hex 0건. 기존 FoodCover 사용처 7곳은 `emoji` 미지정이라 비주얼 회귀 0.

---

## 1. 통과 (킷 ↔ RN 일치 확인)

### 1.1 FoodCover 킷 정합 불변 (셸·그라데이션·그림자) — 교차검증 1
| 축 | 킷 (mk-ui.jsx:50-61) | RN (FoodCover.tsx) | 판정 |
|---|---|---|---|
| 배경 그라데이션 | `background: c.grad`, `c = CAT[cat]||CAT.cafe` | `colors = categoryColors({key:category})`, LinearGradient start{0.08,0}→end{0.92,1} (FoodCover.tsx:57,41-42,63-65) | ✅ `colors`는 **항상** `category` 기준 — `emojiOverride`와 무관(:57). 오버라이드가 배경에 영향 없음 확인 |
| 중앙 이모지 | `c.emoji` 1글자, `filter: drop-shadow(0 2px 6px rgba(0,0,0,.12))` (mk-ui:58) | `<Text fontSize={emojiSize}>{emoji}</Text>` + textShadow(0,2,6, rgba(0,0,0,0.12)) (FoodCover.tsx:68,81-86) | ✅ drop-shadow 근사 불변(프레젠테이션 그림자, 시맨틱 색 아님) |
| 글리프 출처 분기 | (킷엔 오버라이드 개념 없음 — 항상 `c.emoji`) | `emoji = emojiOverride \|\| categoryEmoji({key:category}) \|\| cafe.emoji` (FoodCover.tsx:56) | ✅ 오버라이드 미지정 시 `categoryEmoji\|\|cafe` 폴백 = 기존 동작 100% 일치. **셸 영향 0, 글리프만 변경** |
| 모서리 | `borderRadius: radius`(기본 20) | `borderRadius: radius`(기본 20) (FoodCover.tsx:48,66) | ✅ 일치 |
| overflow | `hidden` | `overflow:'hidden'` (FoodCover.tsx:76) | ✅ 일치 |

→ `emoji` prop 추가는 킷 FoodCover의 "grad 배경 + 중앙 대표 이모지 + drop-shadow" 골격을 깨지 않는다. **비주얼 충실도 영향 0.**

### 1.2 FoodCover 기존 사용처 회귀 0 — 교차검증 1
ui-spec §4.1 6개 파일 7개 호출부(MuklogCard:117 · SelectedSpotCard:62 · PlaceResultRow:63 · PlaceSelectedSummary:64 · WishlistView:110 · MuklogDetailScreen:283) 전부 `emoji` prop 없음 → `emojiOverride` falsy → 기존 `categoryEmoji({key:category}) || cafe.emoji` 경로 그대로(FoodCover.tsx:56). 코드상 분기는 `||` 단락 평가라 미지정 시 신규 경로 미진입. **비주얼 회귀 0 확인.** (SelectedSpotCard.tsx:62 직접 확인 — `emoji` 미전달, `category` 그대로.)

### 1.3 NearbySpotCard 셸 충실도 — 교차검증 2
킷 선택 스팟 카드 셸(mk-home.jsx:304-306)과 RN NearbySpotCard / SelectedSpotCard를 동시 대조:

| 셸 요소 | 킷 (mk-home.jsx) | RN NearbySpotCard | RN SelectedSpotCard | 판정 |
|---|---|---|---|---|
| 카드 배경 | `background: var(--mk-card)` (:304) | `theme.color.surface` (:74) | `theme.color.surface` (:51) | ✅ 일관 |
| 상단 radius | (킷 화면폭 도킹 → RN floating radius.card 부여, ui-spec 기록) | `radius.card` 상단 L/R (:75-76) | `radius.card` 상단 L/R (:52-53) | ✅ 두 카드 일관 |
| 그림자 | `box-shadow: 0 -8px 24px rgba(0,0,0,.06)` (:304) | `theme.shadow.md` (:81) | `theme.shadow.md` (:59) | ✅ 상향 도킹 그림자 근사(ui-spec 기록), 두 카드 동일 |
| padding | `14px 20px 16px` (:304) | top spacing[14]/bottom spacing[16]/h spacing[20] (:77-79) | 동일 (:54-56) | ✅ 정확 일치 |
| row gap | `gap: 13` (:305) | `spacing[12]` (:84) | `spacing[12]` (:61) | ✅ 근사 허용(아래 §3) |
| FoodCover | `radius={14} emojiSize={26} 54×54` (:306) | 54/14/26 (:41-43,88-90) | 54/14/26 (:31-33) | ✅ 치수 정확 일치 |
| 가게명 | `font 700 16px/1.3, var(--mk-ink)` (:308) | `variant="cardTitle" color="fg"` numberOfLines 1 (:93) | 동일 (:69) | ✅ 일관 |
| 메타줄 | `font 500 12.5px/1, var(--text-alternative)`, marginTop 4 (:309-311) | `variant="meta" color="fgMuted"`, marginTop spacing[4] (:97-101) | 동일 (:72-75) | ✅ 일관 |

→ 커버 이모지가 종목별로 바뀌어도(🍖/🍜 등) 셸·정렬·메타줄 레이아웃이 SelectedSpotCard와 **토큰 단위로 동일**하다. 정렬 `alignItems:'center'`(:114) 일치.

### 1.4 그라데이션 정책 — 교차검증 3
NearbySpotCard는 `<FoodCover category={null} emoji={coverEmoji} .../>`(NearbySpotCard.tsx:86-90). `category={null}` → `categoryColors({key:null})` → cafe 중립 그라데이션 폴백. **종목별 배경 다채화 없음(이모지만 정확)** — ui-spec §2.2·plan §2 Out-of-scope 정책과 일치. ✅

### 1.5 메타 텍스트 — 교차검증 4
- NearbySpotCard 메타줄 `buildMeta`(:46-57): `[categoryName, distanceText]` 빈값 제거 후 `' · '` join → "칼국수 · 320m". numberOfLines=1(:100), `flexShrink:1`(:116), `body: { flex:1, minWidth:0 }`(:115) → **브레드크럼 길어도 1줄 ellipsize, 레이아웃 깨짐 없음**. ✅
- 킷 메타 패턴은 선두 `· `(mk-home:311 `· {label} · {area}`)인데 nearby는 선두 `·` 없이 "칼국수 · 320m". 이는 nearby에 선행 별점(Stars)이 없어 선두 구분점이 불필요한 의도된 차이(SelectedSpotCard는 Stars 뒤라 `· ` 선두 유지). 톤 정합 — 지적 아님. ✅
- 메타 텍스트가 **마지막 세그먼트만**(부모 `lastCategorySegment` 가공) → 카카오 raw 브레드크럼 통짜 노출(긴 텍스트 깨짐) 제거. 킷 "· 조각" 톤과 정합. ✅ (값 산출 정확성은 qa-logic 범위)

### 1.6 글리프 톤 — 교차검증 5
신규 21종 글리프(🍗🍕🍔🍖🍣🍜🍢🍱🥟🍝🍛🍺🥐🦪🥗🍰🍽️🍲☕)는 모두 단색 음식/음료 이모지로, muklog 킷이 이미 쓰는 8종 저장 카테고리 이모지(`MUKLOG_CATEGORIES`)와 동일 톤·동일 렌더(Text 글리프 + drop-shadow). CLAUDE.md 플레이풀 예외(음식 이모지 허용)에 부합. **톤 깨지는 글리프 없음.** ✅

### 1.7 토큰 경유 (raw hex 0건)
`grep -rn "#[0-9a-fA-F]\{3,6\}" FoodCover.tsx NearbySpotCard.tsx` → **0건**. 색/spacing/radius/shadow 전부 `theme/` 토큰 경유. FoodCover의 `rgba(0,0,0,0.12)` textShadow는 시맨틱 색이 아닌 프레젠테이션 그림자(킷 drop-shadow와 동일 값) — 토큰 위반 아님. ✅

---

## 2. 불일치 (ui-publisher 라우팅)
**없음.** 비주얼/토큰/프리미티브 이슈 0건.

---

## 3. 근사 허용 (RN 한계 / ui-spec 기록)
| 항목 | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| row gap | 킷 `gap: 13`(mk-home:305) | `spacing[12]`(=12) | 4px 그리드 토큰에 13 없음. SelectedSpotCard도 동일하게 spacing[12] 사용 → **두 카드 간 일관성 우선**, 1px 차 무시 가능. 이번 스프린트 신규 도입 아님(기존 셸 패턴). |
| 카드 상단 그림자 | `box-shadow 0 -8px 24px rgba(0,0,0,.06)` | `shadow.md`(0/4/12, opacity .08) | RN shadowRadius가 CSS blur·음수 offset과 1:1 아님. 상향 도킹 카드 그림자 근사 — ui-spec §2.2·SelectedSpotCard 주석 기록. |
| 카드 상단 radius | 킷 화면폭 도킹(radius 없음) | `radius.card` 상단 L/R | RN floating 오버레이 정합 — ui-spec 기록. SelectedSpotCard와 동일. |
| 이모지 drop-shadow | `drop-shadow(0 2px 6px rgba(0,0,0,.12))` | textShadow(0,2,6, rgba(0,0,0,0.12)) | RN textShadow 근사 — 기존 FoodCover 현행 유지, 이번 변경 없음. |

모두 ui-spec §6 또는 컴포넌트 주석에 사유 기록 있음 → **근사 허용으로 통과.**

---

## 4. 미검증 (사유)
| 항목 | 사유 |
|---|---|
| 실 디바이스 렌더 픽셀 | MapTabScreen이 아직 `coverEmoji` 미배선(ui-spec §3.3, developer T5 핸드오프 경계) → NearbySpotCard 실 화면 표출 불가. 코드·토큰 정합은 확인됨. 배선 후 디바이스 스모크 권장(MEMORY: 레이아웃 무거운 컴포넌트 디바이스 스모크). |
| `coverEmoji`/`lastCategorySegment` **값**의 정확성 | qa-logic 범위(매핑 로직). 본 리포트는 글리프가 렌더되는 **방식·톤·셸**만 검증. |

---

## 5. 3축 요약
- **① 레이아웃·구조 / safe-area**: NearbySpotCard 셸·정렬·메타줄 구조가 킷 선택 카드 셸 및 SelectedSpotCard와 일관. 메타 1줄 ellipsize 안전. ✅
- **② 비주얼·토큰**: radius 14·54×54·emojiSize 26·padding 14/20/16·surface·shadow.md 전부 토큰 경유, raw hex 0. FoodCover 셸/그라데이션/그림자 불변. ✅
- **③ 텍스트·카피**: "칼국수 · 320m" 메타 패턴이 킷 톤 정합. 신규 음식 이모지 21종 킷 플레이풀 톤 부합. ✅

**비주얼 완료 가능** — 단, MapTabScreen 배선(developer T5) 완료 후 디바이스 스모크 1회 권장(미검증 §4).
