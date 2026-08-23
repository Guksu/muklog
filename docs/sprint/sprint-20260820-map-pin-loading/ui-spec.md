# UI 스펙: map-pin-loading (지도 "이 지역에서 검색" 재검색 pill)

- **작성일**: 2026-08-20
- **퍼블리싱**: ui-publisher
- **기획 단일 출처**: `docs/sprint/sprint-20260820-map-pin-loading/plan.md` §4.4(훅 계약)·§5.1(컴포넌트 계약)·§6 W4
- **디자인 단일 출처**: 킷 `templates/muklog` = `.claude/skills/ui-design/templates/muklog/`
- **범위**: 신규 컴포넌트 1종(`MapResearchButton`). **토큰 신규 추가 0 · 기존 프리미티브 수정 0 · 화면 파일 수정 0**(배치는 §3의 지시서로 developer가 적용)

---

## §1. 산출물

| 파일 | 상태 | 소유 |
|---|---|---|
| `src/features/map/components/MapResearchButton/MapResearchButton.tsx` | **신설** | ui-publisher |
| `src/features/map/components/MapResearchButton/MapResearchButton.spec.tsx` | **신설**(6 케이스, green) | ui-publisher |
| `src/features/map/components/MapResearchButton/index.ts` | 신설 | ui-publisher |
| `src/features/map/components/index.ts` | 배럴 1행 추가 | ui-publisher |
| `src/theme/tokens/tokens.ts` | **diff 0** | — |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | **미수정** — §3 배치 지시서대로 developer가 적용 | developer |

게이트: `npx jest src/features/map/components/MapResearchButton --silent` → **6 passed** · `npx tsc --noEmit` → **오류 0**.

---

## §2. 킷 원본 없음 · 패턴 근거 (qa-visual 판정 기준)

> **이 컴포넌트는 킷 시안 재현이 아니다.** 킷 `mk-home.jsx` MapScreen(`:320-392`)의 지도 오버레이는
> **FauxMap(`:337`) · me 마커(`:338-344`) · 핀(`:345-357`) · 범례(`:358-361`) · locate FAB(`:363-372`) · 하단 스팟 카드(`:374-392`)** 뿐이고
> 재검색/지역검색 계열 요소가 **0건**이다(planner grep 확인, plan §3.3). 따라서 qa-visual은 "킷 시안 대비"가 아니라
> **"킷 패턴 대비"** 로 판정하고, FAIL 근거를 킷 좌표로 삼지 않는다. 대조할 근거 라인은 아래 2겹이다.

### 2.1 스킨(지도 위에 떠 있는 레이어) ← 킷 locate FAB `mk-home.jsx:363-372`

| 킷 선언(라인) | 킷 실값 | RN 매핑 | 근거 |
|---|---|---|---|
| `background: "var(--mk-card)"` (`:365`) | 카드면(흰) | `theme.color.surface` | 지도 타일 위 가독 확보. 범례 칩(`:396`)·필터 칩과 동일 어휘 |
| `borderRadius: 999` (`:364`) | 999 | `theme.radius.full` | plan §5.2가 확정한 pill 형태 |
| `boxShadow: "0 4px 14px rgba(0,0,0,.18)"` (`:365`) | 검정 .18 | `theme.shadow.fab` | **헤어라인이 아니라 그림자를 쓰는 이유 = 떠 있는 레이어**(원티드 "그림자 대신 헤어라인"의 예외가 아니라 킷 선례 준수). `MapLocateButton.tsx:28`와 동일 토큰 |
| `onMouseDown → scale(.92)` (`:368`) | 0.92 | `Pressable` pressed → `transform:[{scale:0.92}]` | 아래 §2.3 판단 기록 참조 |

> ⚠ **킷 라인 번호 주의**: `MapLocateButton.tsx` 헤더 주석이 인용한 `mk-home.jsx:289-298`은 킷 경로 마이그레이션
> (`ui_kits/muklog`→`templates/muklog`, CLAUDE.md 2026-06-12) **이전 판**의 번호다. 현행 킷 실번호는 `:363-372`이며
> 선언 내용은 동일하다. 본 스펙의 모든 킷 좌표는 **현행 킷 파일 기준**으로 재확인한 값이다.

RN 대응 선례 파일: `src/features/map/components/MapLocateButton/MapLocateButton.tsx:24-29,53`.

### 2.2 내용(라벨+아이콘을 가진 컨트롤) ← 킷 `MkButton size="sm" variant="soft"` `mk-ui.jsx:85-104`

| 킷 선언(라인) | 킷 실값 | RN 매핑 |
|---|---|---|
| `pad = size==="sm" ? "9px 14px"` (`:85`) | 9 × 14 | `paddingVertical: 9, paddingHorizontal: 14` |
| `fs = size==="sm" ? 14` (`:86`) | 14 | `typography.button`(700/SUIT-Bold)에 `fontSize:14` 오버라이드 |
| `fontWeight: 700` (`:90`) · `lineHeight: 1.2` (`:91`) | 700 / 1.2 | family=SUIT-Bold, `lineHeight: round(14×1.2)=17` |
| `gap: 8` (`:88`) | 8 | `gap: 8`(아이콘↔라벨) |
| `leftIcon → Icon size={fs+3}` (`:104`) | 17 | `<Icon size={17}>` |
| `variant "soft" → color: "var(--mk-accent-strong)"` (`:96`) | `#1F4FE0` | `color="accentStrong"` — **아이콘·라벨 동색**(킷은 `color="currentColor"`로 상속) |

RN 대응 선례 파일: `src/components/Button/Button.tsx:32`(BUTTON_SIZE.sm 실값 동일)·`:76`(soft→accentStrong)·`:136`(gap 8).

### 2.3 킷 두 선례가 갈리는 지점 — 판단과 근거

| 항목 | locate FAB | MkButton sm | 채택 | 사유 |
|---|---|---|---|---|
| radius | `999` | `--mk-radius-btn`(14) | **`radius.full`** | plan §5.2 확정. 떠 있는 레이어의 형태는 원형/pill(범례 칩 `mk-home.jsx:396`도 999) |
| 배경 | `--mk-card`(흰) | soft=`--mk-accent-weak` | **`color.surface`** | plan §5.2 확정. 지도 타일은 색이 매 프레임 달라져 약톤 틴트가 탁하게 읽힌다. 흰 면+그림자가 킷의 "지도 위" 어휘 |
| 콘텐츠 색 | 아이콘 `#3B82F6`(=`mapLocate`) | `--mk-accent-strong` | **`accentStrong`** | `mapLocate`는 킷이 locate 컨트롤에만 verbatim으로 쓴 전용색(tokens.ts:74-77 기록). 재검색은 locate가 아니므로 브랜드 액센트 텍스트색(`accentStrong`)을 쓴다 — 흰 면 위 액센트 **텍스트**의 킷 규칙 |
| press 피드백 | `scale(.92)` | `scale(.97)` | **0.92** | 리더 확정. 같은 오버레이 층의 컨트롤 2종(FAB·pill)이 서로 다른 피드백을 내면 어긋나 보인다 |

### 2.4 RN 미재현 · 근사 항목

| 항목 | 사유 | 근사 |
|---|---|---|
| 최소 터치 타깃 | pill 실높이 = 9+17+9 = **35pt** < 45. 킷 pad를 키우면 킷 실값(9×14)이 깨진다 | pad 불변 + `hitSlop {top:5,bottom:5,left:8,right:8}` → 유효 45×(폭+16). 비주얼 영향 0 |
| 컬러 그림자 | 해당 없음 — 킷 FAB 그림자가 이미 검정(`rgba(0,0,0,.18)`) | `shadow.fab` 그대로(근사 아님) |

---

## §3. 배치 — 최종 결정과 근거 (developer가 적용할 지시서)

plan §5.1의 기준선은 `top = insets.top + spacing[56]`(범례와 같은 줄)이었고, 겹침 해소는 ui-publisher 최종 결정이었다.
**결론: 같은 줄은 불가능하다. 범례 아래 한 단(= `insets.top + 96`)으로 내린다.**

### 3.1 왜 같은 줄이 불가능한가 (실측 기반)

현 `MapLegend`는 칩 **3개** 행이다(`MapLegend.tsx:18-22` — 우리 맛집 / 가고 싶은 곳 / 주변 음식점).
칩 1개 폭 = `padding 10` + `dot 9` + `gap 6` + 라벨 + `padding 10`. 라벨은 `caption`(12pt) 한글이라 글자당 ≈12pt.

| 칩 | 라벨 추정폭 | 칩 폭 |
|---|---|---|
| 우리 맛집 | ≈51 | ≈86 |
| 가고 싶은 곳 | ≈66 | ≈101 |
| 주변 음식점 | ≈63 | ≈98 |
| **행 합계**(gap 8 × 2) | | **≈301** |

범례는 `left:16`이므로 가로 **16 ~ ≈317** 을 차지한다. 한편 pill 폭 = `14 + 17 + 8 + 라벨("이 지역에서 검색" 14pt Bold ≈102) + 14` ≈ **155**.

- 375pt(SE·13 mini): 중앙 pill = 110~265 → **범례와 완전히 겹침**
- 430pt(Pro Max): 중앙 pill = 137~292 → **여전히 겹침**

즉 **모든 지원 기기에서 겹친다.** 좌우로 피할 여지가 없으므로 세로로 내리는 것이 유일한 해다(plan §5.1 배치 제약 ① "좁은 기기에서 중앙 pill이 범례를 덮으면 기준선을 한 단 내린다"의 발동).

### 3.2 확정 세로 스택 (inset 흡수 후)

| 레이어 | top | 높이 | bottom | 근거 |
|---|---|---|---|---|
| `CategoryFilterBar` | `insets.top + 12` | 34 (칩 8+18+8) | `+46` | 현행 무변경. **탭 영역 미침범**(pill이 +96에서 시작하므로 50pt 여유) |
| `MapLegend` | `insets.top + 56` | 27 (칩 5+17+5) | `+83` | 현행 무변경 |
| **`MapResearchButton`** | **`insets.top + 96`** | 35 | `+131` | 범례 아래 **gap 13** |

- **`96 = theme.spacing[56] + theme.spacing[40]`** — 신규 spacing 토큰을 만들지 않고 기존 토큰 합성으로 4px 그리드를 지킨다(`filterBar`·`legend`가 이미 `insets.top + theme.spacing[n]` 합성 idiom).
- **inset 흡수**: `insets.top`을 더하는 쪽은 **top 뿐**이다. 하단(스팟 카드·`MapLocateButton`)에는 아무것도 더하지 않는다 — `map-headerless` 규율(plan A4-6, "inset이 하단으로 새지 않는다").
- **하단 무간섭**: pill bottom(`+131`)과 하단 도킹 카드·FAB(`bottom:16`)는 세로로 화면 절반 이상 떨어져 있다. `MapStatusOverlay`는 화면 정중앙(`justifyContent:'center'`)이라 겹치지 않는다.

### 3.3 developer가 `MapTabScreen`에 넣을 배치 코드 (그대로 사용)

`map-overlay-legend` 블록 **바로 아래**, 상태 오버레이 블록 **위**에 넣는다.

```tsx
{/* 재검색 pill — 범례 아래 한 단(top 96 = 56 + 40), 가로 중앙(ui-spec §3.2).
    범례(left:16, 3칩 ≈301pt)와 중앙 pill(≈155pt)이 모든 기기에서 가로로 겹쳐 같은 줄을 쓸 수 없다.
    ⚠ pointerEvents="box-none" — 전폭 래퍼가 지도 팬/탭 제스처를 삼키지 않게. */}
{nearby.researchAvailable ? (
  <View
    testID="map-overlay-research"
    pointerEvents="box-none"
    style={[styles.research, { top: insets.top + theme.spacing[56] + theme.spacing[40] }]}
  >
    <MapResearchButton testID="map-research-button" onPress={nearby.research} />
  </View>
) : null}
```

```ts
// styles에 추가 — 전폭 절대배치 + 가로 중앙(pill 자신은 alignSelf:'center'라 폭을 채우지 않는다).
research: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
```

**주의 3가지**
1. `pointerEvents="box-none"` **필수**. 래퍼가 `left:0/right:0` 전폭이라 빠지면 지도 상단 35pt 띠에서 팬·탭이 죽는다(`map-overlay` 상태 배너 래퍼의 기존 선례와 동일).
2. 조건 렌더는 **부모가** `nearby.researchAvailable`로 한다. 컴포넌트에 `visible` prop을 추가하지 않는다(plan B10 — 노출 규칙이 훅·컴포넌트 두 곳으로 갈라지는 것을 막는다).
3. `testID`는 **`map-research-button`**(plan A4-3이 이 문자열을 단언한다). 래퍼 `testID`는 `map-overlay-research`(기존 `map-overlay-*` 네이밍 규칙).

### 3.4 ⚠ `box-none`은 이 층에서 **두 곳** 다 필요하다 (qa-visual V7 검증 중 발견)

`pointerEvents="box-none"`이 두 래퍼에 있고, **막는 문제가 서로 정반대**다. 하나만 있으면 다른 쪽이 조용히 깨진다.

| 래퍼 | 없으면 죽는 것 | 이유 |
|---|---|---|
| research pill 래퍼 | **지도 팬·탭** | `left:0/right:0` 전폭 띠(높이 35pt)가 상단에서 제스처를 삼킨다 |
| `overlay`(상태 배너) 래퍼 | **pill 탭** | `absoluteFillObject`이고 research 블록보다 **뒤에** 렌더돼, 배너가 떠 있는 동안 화면 전체를 덮는다 |

즉 pill 쪽은 "내가 남의 제스처를 삼키지 않기", 배너 쪽은 "남이 내 탭을 덮지 않기"다. **이 오버레이 층에 절대배치 요소를 추가할 때는 새 래퍼의 `box-none`뿐 아니라, 그보다 뒤에 렌더되는 기존 전면(全面) 래퍼가 새 요소를 덮지 않는지도 함께 확인한다.** 렌더 순서가 판정에 들어가므로 삽입 위치를 바꾸는 것만으로도 성립/불성립이 뒤집힌다.

> 상단 절대배치 앵커는 현재 **정확히 3개**다(`+12` 필터바 · `+56` 범례 · `+96` pill). 선로딩은 전부 로직이라
> 신규 오버레이를 만들지 않고 로딩 피드백은 기존 `MapStatusOverlay`(화면 정중앙)를 재사용한다 — V7 확인.

---

## §4. props 계약 (developer 인계)

```ts
// import { MapResearchButton } from '@/features/map/components';  ← 배럴 export 완료
export type MapResearchButtonProps = {
  /** 탭 콜백. 현재 뷰포트 1회 재조회 = nearby.research(plan §4.4). */
  onPress: () => void;
  /** 테스트 식별자. A4-3/A4-4가 쓰는 값은 'map-research-button'. */
  testID?: string;
};
```

| 항목 | 값 | 비고 |
|---|---|---|
| 카피 | **"이 지역에서 검색"** | 컴포넌트 내부 `RESEARCH_LABEL` **단일 출처**. 화면에서 문자열을 넘기지 않는다 |
| 접근성 | `accessibilityRole="button"` · `accessibilityLabel="이 지역에서 검색"`(라벨과 동일) | plan §5.1 |
| 상태 | **단일 상태만.** loading/disabled/spinner 없음 | `status==='loading'`이면 훅의 `researchAvailable`이 false → **미노출**로 처리(plan §5.1 "노출/미노출 이분법") |
| 연타 | 컴포넌트는 가드하지 않는다 | in-flight 가드는 `research()` 내부(plan A3-7) |

**컴포넌트가 하지 않는 것(경계)**: 노출 판정 · 조회 · 디바운스 · bbox 계산 · 에러 표시 · 배치. 전부 developer(훅·화면) 소유.

---

## §5. 토큰 정합

**신규 토큰 0 · 기존 토큰 변경 0.** 사용 토큰 전부 기존값이며 raw hex/숫자 색상 **0건**.

| 사용처 | 토큰 | 실값 | 킷 근거 |
|---|---|---|---|
| pill 배경 | `color.surface` | `#FFFFFF` | `--mk-card`(mk-home:365) |
| pill radius | `radius.full` | `9999` | `borderRadius:999`(mk-home:364) |
| pill 그림자 | `shadow.fab` | `0 4px 14 rgba(0,0,0,.18)` | mk-home:365 |
| 아이콘·라벨 색 | `color.accentStrong` | `#1F4FE0` | `--mk-accent-strong`(mk-ui:96) |
| 라벨 타이포 | `typography.button` + `fontSize:14/lineHeight:17` | SUIT-Bold 14/17 | MkButton sm `700/14, lh 1.2`(mk-ui:86,90-91) |
| 아이콘↔라벨 gap | `8` (컨트롤 내부 수치) | 8 | mk-ui:88 |
| 내부 pad | `9 × 14` (컨트롤 내부 수치) | 9×14 | mk-ui:85 |
| 배치 top | `spacing[56] + spacing[40]` | 96 | 본 스펙 §3.2(킷 비종속 — 신규 배치) |

> 컨트롤 내부 수치(pad 9×14 · gap 8 · fontSize 14 · iconSize 17)는 4px 그리드 밖의 킷 실값이라
> `Button.tsx`의 `BUTTON_SIZE` 규율대로 **토큰화하지 않고** 컴포넌트 내부 enum-style 상수(`RESEARCH_PILL`)로 고정했다.

---

## §6. 비주얼 충실도 self-check (qa-visual 인계)

- [x] 킷 대응 요소 누락 0 — 킷 원본이 없으므로 §2의 파생 근거 2겹(FAB 스킨 + MkButton sm 내용)이 대조 기준
- [x] 색은 전부 토큰 경유(raw hex 0). 킷 `--mk-*` 실값과 일치
- [x] radius(full) · 폰트(SUIT-Bold 14/17) · 간격(pad 9×14, gap 8)이 킷 실값과 일치
- [x] 그림자 vs 헤어라인 구분 — **떠 있는 레이어라 `shadow.fab`**(헤어라인 아님), 사유 §2.1 기록
- [x] 프리미티브 재사용 — `Icon`·`Text` 공용 프리미티브 사용, 화면 인라인 중복 0
- [x] RN 미재현/근사 항목 기록 — hitSlop 터치 타깃 보정(§2.4)
- [x] `npx jest src/features/map/components/MapResearchButton` 6 passed · `npx tsc --noEmit` 0

### qa-visual이 볼 것 (킷 라인 ↔ RN 파일:라인)

| # | 확인 | 킷 근거 | RN |
|---|---|---|---|
| V1 | 흰 pill + `shadow.fab` + radius full | `mk-home.jsx:364-365` | `MapResearchButton.tsx:43-45` |
| V2 | 아이콘·라벨이 **같은** `accentStrong`, gap 8, 아이콘 17 | `mk-ui.jsx:88,96,104` | `MapResearchButton.tsx:59-60,74` |
| V3 | 라벨 14pt Bold, lh 17 | `mk-ui.jsx:86,90-91` | `MapResearchButton.tsx:27,48,60` |
| V4 | pad 9×14 | `mk-ui.jsx:85` | `MapResearchButton.tsx:27,75-76` |
| V5 | press scale 0.92 | `mk-home.jsx:368` | `MapResearchButton.tsx:80` |
| V6 | 카피 "이 지역에서 검색" 정확 일치 | 킷 비종속(리더 Q3 확정) | `MapResearchButton.tsx:23` |
| V7 | **배치**: top = `insets.top+96`, 가로 중앙, 범례·필터바와 겹침 0, inset이 하단으로 새지 않음 | 킷 비종속(§3) | `MapTabScreen.tsx`(developer 적용분) |
| V8 | 디바이스 스모크 **S7**(버튼+범례+필터칩+FAB+스팟 카드 동시 노출) 겹침 0 | plan §9 S7 | 실기기 |

---

## §7. 개정 이력

| # | 날짜 | 내용 |
|---|---|---|
| R0 | 2026-08-20 | 최초 작성 — `MapResearchButton` 신설(킷 원본 없음·패턴 파생), 배치 결정(범례 아래 한 단 96), props 계약 |
| R2 | 2026-08-20 | qa-visual V7(실적용 배치) PASS 확인 후 **§3.4 신설** — `box-none`이 이 오버레이 층에서 두 곳(pill 래퍼·상태 배너 래퍼) 다 필요하고 막는 문제가 정반대라는 숨은 의존을 기록. 렌더 순서가 판정에 들어가므로 삽입 위치 변경만으로 뒤집힌다. 상단 앵커가 3개(+12·+56·+96)로 유지됨도 함께 확정. **코드 diff 0** |
| R1 | 2026-08-20 | qa-visual 지적(D1~D4) 반영 — 킷 좌표 4건 정정. §5 아이콘·라벨 색 `mk-ui:97`→**`:96`**(`:97`은 ghost), §5 라벨 타이포 `mk-ui:86,89-90`→**`:86,90-91`**(`:89`는 width/padding 줄), §2.3 범례 칩 `:314`→**`mk-home.jsx:396`**(`:314`는 SubBar `{right}`), §2.1 범례 칩 `:395`→**`:396`**(off-by-one). **코드 diff 0**(픽셀 영향 없음, 문서 좌표만). 같은 부류의 stale 좌표 2건도 동반 정정: `tokens.ts:188` `shadow.fab` 근거 `mk-home:292`→`:365`, `MapLegend.tsx:3` "칩 2개"→3개(위시 칩 추가 후 미갱신) |
