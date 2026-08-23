# QA 리포트 — 비주얼 충실도: map-pin-loading (`MapResearchButton`)

- **작성일**: 2026-08-20
- **검증**: qa-visual
- **검증 대상**: `src/features/map/components/MapResearchButton/`(ui-publisher, task #2) + `ui-spec.md`
  + **V7 실적용 배치** `src/navigation/screens/MapTabScreen/MapTabScreen.tsx`(developer, task #3 — 동결 md5 `b2d2c55dbc1e5b1f866b2e6237aa3fc5`, spec `efbc4ac6df735331a87f5f1fb9e6eea6`, 검증 시점 재측정 일치)
- **판정 기준 특례**(리더·planner 합의): 킷 `templates/muklog`에 재검색 계열 원본이 **0건**이므로 "킷 시안 좌표 대비"가 아니라
  **"킷 패턴 대비"**로 판정한다. 킷에 요소가 없다는 사실 자체는 FAIL 근거가 아니다.
- **핵심 작업**: ui-spec §6 V1~V8 대조표가 **킷 실라인을 정확히 인용했는지 킷 파일을 직접 열어 재검증**.

## 종합 판정

**통과** — 컴포넌트(V1~V6)와 **실적용 배치(V7)** 가 모두 킷 패턴·ui-spec 산술과 일치한다. **코드 불일치 0건.**
잔여는 **V8(디바이스 스모크) 1건뿐**이고 실기기가 필요해 qa-visual이 종결할 수 없다
→ 스프린트 "비주얼 완료"는 **사용자 실기기 확인(S7) 후**에 표시한다.
발견된 이슈 4건은 전부 **ui-spec 문서의 킷 좌표 오기**였고 **전건 해소**됐다(RN 픽셀 영향 0).

| 분류 | 건수 | 항목 |
|---|---|---|
| 통과 | **7** | V1 V2 V3 V4 V5 V6 **V7** |
| 불일치 | 0 | — |
| 근사 허용 | 2 | 터치 타깃 hitSlop · 떠 있는 레이어 그림자 |
| 미검증 | **1** | V8 디바이스 스모크(실기기 필요 — 사용자 확인 항목) |
| 문서 이슈(비 픽셀) | 4 | D1~D4 — ui-spec 킷 라인 오기, **전건 해소**(2회차) |

게이트(3회차, qa-visual 독립 실행):
`npx jest src/navigation/screens/MapTabScreen src/features/map/components/MapResearchButton --silent` → **2 suites / 76 tests passed**.
`MapTabScreen.tsx` raw hex **0건** · 하드코딩 `96` **0건** · 신규 spacing 토큰 **0건**(`tokens.ts` diff는 ui-publisher 주석 3행뿐).

---

## 1. 킷 ↔ RN 대조 (V1~V6)

킷 실파일을 직접 열어 대조했다. 킷 경로는 **프로젝트 로컬** `/Users/kimjongmin/dev/muklog/.claude/skills/ui-design/templates/muklog/`
(사용자 홈 `~/.claude/skills/`에는 없다 — 검증자 참고).

| # | 확인 항목 | 킷 실라인(재확인) | RN | 판정 |
|---|---|---|---|---|
| **V1** | 흰 pill + shadow.fab + radius full | `mk-home.jsx:364` `borderRadius: 999` / `:365` `background:"var(--mk-card)"`, `boxShadow:"0 4px 14px rgba(0,0,0,.18)"` | `MapResearchButton.tsx:43-45` `color.surface` / `radius.full` / `shadow.fab` | **PASS** |
| **V2** | 아이콘·라벨 동색 accentStrong, gap 8, 아이콘 17 | `mk-ui.jsx:88` `gap: 8` / `:96` soft → `color:"var(--mk-accent-strong)"` / `:104` `size={fs + 3}` | `:59-60`(둘 다 `color="accentStrong"`) · `:74` `gap: 8` · `:27` `iconSize: 17` | **PASS** |
| **V3** | 라벨 14pt Bold, lh 17 | `mk-ui.jsx:86` `fs = size==="sm" ? 14` / `:90` `fontWeight: 700` / `:91` `lineHeight: 1.2` | `:27,48`(fontSize 14 / lineHeight 17) · `:60` `variant="button"`(=SUIT-Bold) | **PASS** |
| **V4** | pad 9×14 | `mk-ui.jsx:85` `size==="sm" ? "9px 14px"` | `:27,75-76` `paddingVertical: 9, paddingHorizontal: 14` | **PASS** |
| **V5** | press scale 0.92 | `mk-home.jsx:368` `onMouseDown → scale(.92)` | `:80` `transform:[{scale:0.92}]` | **PASS** |
| **V6** | 카피 "이 지역에서 검색" | 킷 비종속(리더 Q3 확정) | `:23` `RESEARCH_LABEL` 단일 출처, `:53` 접근성 라벨 동일 | **PASS** |

**V1~V5의 킷 인용은 전부 정확했다.** ui-spec §6 대조표는 신뢰할 수 있는 baseline이다.

### 1.1 토큰 실값 대조 (킷 `--mk-*` ↔ `tokens.ts`)

| 사용처 | RN 토큰 | 실값(`tokens.ts`) | 킷 실값 | 판정 |
|---|---|---|---|---|
| pill 배경 | `color.surface` | `#FFFFFF`(`:106`) | `--mk-card` | 일치 |
| radius | `radius.full` | `9999`(`:179`) | `999` | 일치(RN 관용 full) |
| 그림자 | `shadow.fab` | `#000 / .18 / r14 / (0,4)`(`:192`) | `0 4px 14px rgba(0,0,0,.18)` | **정확 일치** |
| 콘텐츠 색 | `color.accentStrong` | `#1F4FE0`(`:16,98`) | `--mk-accent-strong` | 일치 |
| 타이포 | `typography.button` + override | SUIT-Bold, 14/17 | `700 / 14 / lh 1.2`(=16.8→17) | 일치 |

- **raw hex/rgb 0건** — `grep -rn "#[0-9a-fA-F]\{3,6\}" src/features/map/components/MapResearchButton/` → 0.
- **"맞는 토큰을 썼는가"** 도 확인: 타이포 스케일에 14pt Bold 역할 토큰이 **없다**(`bodySm`=14/Medium, `navTitle`=16/Bold).
  따라서 `typography.button`(16/Bold) + 킷 실수치 오버라이드가 유일한 경로이며, 이는 `Button.tsx`의 기존 규율과 동일하다.
- **`RESEARCH_PILL`(`:27`)이 `Button.tsx:32`의 `BUTTON_SIZE.sm`과 값이 완전히 동일**함을 확인:
  `{ paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, lineHeight: 17, iconSize: 17 }`.
  ui-spec §2.2의 "선례 실값 동일" 주장은 **사실이다**. 4px 그리드 밖 컨트롤 내부 수치를 토큰화하지 않는 규율도 선례 준수.

### 1.2 킷 두 선례가 갈리는 지점 — 채택 근거 재확인

ui-spec §2.3의 4개 판단(radius full / 배경 surface / 색 accentStrong / press .92)을 킷·선례 양쪽에서 확인했고 **전부 타당**하다.

- `press 0.92`: 킷 MkButton은 `.97`(`mk-ui.jsx:100`), 킷 locate FAB은 `.92`(`mk-home.jsx:368`). **같은 오버레이 층 통일**(리더 확정)로 `.92` 채택 — `MapLocateButton.tsx:53`과 동일. 타당.
  (참고: `Button.tsx`의 press는 `opacity: 0.85`라 또 다른 어휘지만, 지도 오버레이 층이 아니므로 무관.)
- `배경 surface`(킷 soft의 `--mk-accent-weak` 대신): "지도 타일 색이 매 프레임 달라져 약톤 틴트가 탁하게 읽힌다"는 사유가
  `MapLegend`(`:31` surface)·`CategoryFilterBar`(`:9` "각 Chip이 surface 불투명 배경") 두 기존 오버레이 선례와 일관. 타당.
- `shadow.fab`(헤어라인 아님): 브랜드 규칙의 **예외가 아니라 킷 선례 준수**. `mk-home.jsx:365`가 실제로 box-shadow를 쓴다.
  **오탐으로 잡지 않고 통과 처리**한다.

---

## 2. 배치 검증 — ui-spec §3 산술 재계산

ui-spec §3의 수치를 **직접 재계산**했다. 결론과 근거 모두 성립한다.

### 2.1 세로 스택 (재계산)

| 레이어 | top | 높이(실측 근거) | bottom |
|---|---|---|---|
| `CategoryFilterBar` | `insets.top + 12` | **34** = `Chip.tsx:58` pad 8 + `typography.spotCount` lh **18**(`tokens.ts:233`) + 8 | +46 |
| `MapLegend` | `insets.top + 56` | **27** = `MapLegend.tsx:59` pad 5 + `typography.caption` lh **17**(`tokens.ts:223`) + 5 | +83 |
| **`MapResearchButton`** | **`insets.top + 96`** | **35** = 9 + 17 + 9 | +131 |

ui-spec §3.2의 34 / 27 / 35 **전부 실코드와 일치**한다(추정치가 아니라 토큰 실값에서 재도출됨).
`96 = spacing[56] + spacing[40]`도 확인 — `spacing`에 `56`·`40` 키가 모두 존재(`tokens.ts:174`), 신규 토큰 0.
범례 bottom(+83) → pill top(+96) **gap 13**.

### 2.2 "같은 줄 불가능" 논증 재계산

`MapLegend.tsx:18-22`는 실제로 **칩 3개**(우리 맛집 / 가고 싶은 곳 / 주변 음식점)다 — ui-spec 전제 확인.
칩 폭 = `paddingHorizontal 10` + `dot 9` + `gap spacing[6]=6` + 라벨 + `10` (`MapLegend.tsx:33,59,61` 실코드와 일치).

| 칩 | 라벨(12pt 한글) | 칩 폭 |
|---|---|---|
| 우리 맛집 | ≈51 | ≈86 |
| 가고 싶은 곳 | ≈66 | ≈101 |
| 주변 음식점 | ≈63 | ≈98 |
| 행 합계(gap 8 × 2) | | **≈301** |

범례는 `left: 16`(`MapTabScreen.tsx:350`)이므로 가로 **16 ~ ≈317**.
pill 폭 = 14 + 17 + 8 + ≈102 + 14 ≈ **155**.

- 375pt: 중앙 pill = **110~265** ⊂ 범례 16~317 → 겹침
- 430pt: 중앙 pill = **137~292** ⊂ 범례 16~317 → 겹침

**결론 성립**: 모든 지원 기기에서 가로로 겹치므로 같은 줄은 불가능하고, 세로로 한 단 내리는 것이 유일한 해다.
여유폭이 100pt 이상이라 라벨 폭 추정 오차(±20pt)에도 결론이 뒤집히지 않는다 — **논증이 견고하다**.

### 2.3 plan §5.1 배치 제약 3건

| 제약 | 검증 | 판정 |
|---|---|---|
| ① `MapLegend`와 가로 겹침 금지 | 같은 줄 불가 확인 → 세로 분리(+83 vs +96)로 **겹침 영역 0**. plan §5.1이 명시한 escape hatch("좁은 기기에서 덮으면 기준선을 한 단 내린다") 정상 발동 | **충족** |
| ② `CategoryFilterBar` 탭 영역 가림 금지 | 필터바 bottom +46, pill top +96(hitSlop 5 적용 시 유효 +91) → **45pt 여유**. 필터바 래퍼는 `left:0/right:0`이나 높이가 콘텐츠(34)라 +46에서 끝남 | **충족** |
| ③ inset 하단 누수 금지 (plan A4-6) | `insets.top`은 **top에만** 가산. 하단 `MapLocateButton`은 `bottom: spacing[16]`(`MapTabScreen.tsx:372`) 무변경 | **충족** |

**추가 무간섭 확인(ui-spec 주장 검증)**: `MapStatusOverlay` 래퍼는 `styles.overlay = {...absoluteFillObject, alignItems:'center', justifyContent:'center'}`(`MapTabScreen.tsx:432`) — **화면 정중앙**이라 top 96의 pill과 겹치지 않음. ui-spec §3.2 주장 **사실 확인**.

---

## 3. 카피 검증 (③축)

**"이 지역에서 검색"** — 킷 버튼 카피 관행과 대조했다.

- 킷 muklog의 버튼 카피는 상황에 따라 해요체(`"저장할게요"` 류)와 **명사형 액션 라벨**이 공존한다. 특히
  **지도 컨트롤류는 명사·동사원형 라벨**을 쓴다(킷 `mk-home.jsx:363` locate 버튼 `aria-label="내 위치로 이동"` — 해요체 아님).
- 따라서 "이 지역에서 검색"이 해요체가 아닌 것은 **관행 위반이 아니다**. 같은 층 컨트롤(`MapLocateButton` "내 위치로 이동")과 어휘가 일관된다.
- 카피 단일 출처(`RESEARCH_LABEL`, `:23`)에서 라벨·접근성 라벨을 함께 공급 → 두 문자열이 갈릴 수 없다. **좋은 구조**.
- 상태 카피: loading/error 문구가 **없는 것이 맞다**(plan §5.1 "노출/미노출 이분법", ui-spec §4). 미노출이 곧 상태 표현.

**판정: PASS.**

---

## 4. 근사 허용 (RN 한계)

| 항목 | 사유(ui-spec 기록) | 판정 |
|---|---|---|
| 최소 터치 타깃 | pill 실높이 35 < 45. 킷 pad(9×14)를 키우면 킷 실값이 깨지므로 `hitSlop {top:5,bottom:5,left:8,right:8}`(`:30,54`)로 유효 45×(폭+16) 확보. **비주얼 영향 0** | **근사 허용** |
| 그림자 | 킷 FAB 그림자가 이미 검정 `rgba(0,0,0,.18)`이라 RN 컬러 그림자 한계에 걸리지 않음. `elevation: 5`는 Android 근사 | **근사 허용**(사유 기록 있음) |

두 항목 모두 ui-spec §2.4에 **사유가 기록되어 있어** 보강 요청 불필요.

---

## 5. V7 — 실적용 배치 검증 (3회차, developer task #3 완료 후)

**PASS.** `MapTabScreen.tsx`(동결 md5 `b2d2c55d…` — 검증 시점 재측정 일치)에 ui-spec §3.3 지시서가 **그대로** 적용됐다.
`MapResearchButton.tsx`는 핵심 라인 재대조 결과 **무수정**(§1 대조 결과 그대로 유효), `ui-spec.md`도 developer 변경 0.

| # | 확인 항목 | 실제 | 판정 |
|---|---|---|---|
| ① | 래퍼 `pointerEvents="box-none"` | `:427` 존재 | **PASS** |
| ② | top이 토큰 합성인지(하드코딩 96 금지) | `:430` `insets.top + theme.spacing[56] + theme.spacing[40]`. 하드코딩 `96` 0건 · 신규 spacing 토큰 0건 | **PASS** |
| ③ | 선로딩이 상단 3번째 절대배치 요소를 추가했는지 | **추가 0.** 절대배치 전수 = `filterBar`·`legend`·`research`·`overlay`(fill/center)·`locate`(하단). **상단 앵커는 정확히 3개**(`:404` +12 / `:416` +56 / `:430` +96) | **PASS** |
| ④ | 상태 오버레이와 겹침 | `styles.overlay`(`:516`) = `absoluteFillObject` + `justifyContent:'center'` → 화면 정중앙. pill은 +96~+131 → **기하학적으로 분리** | **PASS** |
| ⑤ | 가로 중앙 래퍼 | `:515` `{ position:'absolute', left:0, right:0, alignItems:'center' }` — §3.3과 동일 | **PASS** |
| ⑥ | inset 하단 누수(plan A4-6) | `insets.top`은 상단 3곳에만. 하단 `locate`는 `bottom: theme.spacing[16]`(`:454`) 무변경 | **PASS** |
| ⑦ | testID | 래퍼 `map-overlay-research`(`:426`) · 버튼 `map-research-button`(`:433`) | **PASS** |
| ⑧ | 조건 렌더 소유 | `:424` 부모가 `nearby.researchAvailable`로 판정. 컴포넌트에 `visible` prop 추가 0(plan B10) | **PASS** |
| ⑨ | 삽입 위치(z-순서) | 범례 블록 **바로 아래**(`:421`), 상태 오버레이 블록 **위**(`:437`) — §3.3 지시 그대로 | **PASS** |

### 5.1 ③에 대한 부연 — 예고했던 위험은 실현되지 않았다

task #6에 신규 위험으로 적어둔 "선로딩이 상단 앵커 로딩 인디케이터를 추가할 가능성"은 **발생하지 않았다.**
선로딩은 전부 로직(`preloadFiredRef` `:126`, `preloadNearbyOnce` `:164`, `nearby.preload` `:180`)이고 **신규 비주얼 오버레이가 0개**다.
로딩 피드백은 기존 `MapStatusOverlay` 경로(`:387-388` → `MAP_COPY.loading` "지도를 불러오는 중이에요", 화면 **정중앙**)를 재사용한다.
상단 오버레이 밀도를 늘리지 않고 기존 중앙 배너를 재사용한 것은 **배치 계약을 지키는 선택**이다.

### 5.2 ④의 숨은 의존 — `box-none`이 두 곳 다 필요하다

`overlay`(`:439`)는 research 블록보다 **뒤에** 렌더되는 `absoluteFillObject`다.
따라서 상태 배너가 떠 있는 동안 그 래퍼에 `pointerEvents="box-none"`이 없으면 **전체 화면을 덮어 pill 탭이 죽는다.**
확인 결과 `:439`에 `box-none`이 **있다** → pill은 상태 배너 표시 중에도 탭 가능하다.
pill 래퍼 자신의 `box-none`(①)은 **반대 방향**(pill이 지도 제스처를 삼키지 않게)이라, **둘이 서로 다른 문제를 막는다.**

### 5.3 회귀 잠금 확인

배치가 주석·눈대중이 아니라 **spec으로 잠겨 있다** — 다음 사람이 조용히 깨뜨릴 수 없다.

| spec 케이스 | 잠그는 것 |
|---|---|
| `A4-6`(`:1315`) | `map-overlay-research`의 `top` = **96**, inset 59일 때 **96+59**(=inset 흡수) · 하단 불변 |
| `B10`(`:1335`) | 래퍼 `pointerEvents` === `'box-none'` |
| `A4-3`(`:1272`) | `researchAvailable` **true일 때만** 렌더(false면 `queryByTestId` null) |
| `A4-4`(`:1285`) | 탭 → `nearby.research` 1회 |

---

## 5-A. 미검증 (통과로 처리하지 않음)

| # | 항목 | 사유 |
|---|---|---|
| **V8** | 디바이스 스모크 S7(버튼+범례+필터칩+FAB+스팟 카드 동시 노출) | **실기기 필요.** RN 렌더 픽셀은 유닛 테스트로 확인 불가 — qa-visual이 종결할 수 없는 유일한 잔여 항목 |

> **V8이 왜 여전히 필요한가**: §2.2의 폭 계산은 한글 글자폭 추정(글자당 ≈fontSize)에 기댄다.
> 세로 스택(34/27/35·96)은 토큰 실값에서 재도출해 확실하지만, **가로 폭은 실제 폰트 메트릭(SUIT)에 따라 달라질 수 있다.**
> 다만 현 설계는 세로로 분리해 가로 겹침 가능성 자체를 제거했으므로 S7은 **확인**이지 **위험**이 아니다.
> 함께 볼 것: SE(375)·Pro Max(430) 양극단에서 범례↔pill **gap 13**이 실기기에서 답답하지 않은지.

---

## 6. 발견 이슈 — ui-spec 킷 좌표 오기 (D1~D4)

**전부 문서 이슈다. RN 코드는 정확하며 수정 대상 0건.**
그러나 ui-spec은 **다음 스프린트의 QA baseline**이므로, 틀린 킷 좌표는 후속 검증자를 오도한다.
이는 ui-spec §2.1이 스스로 경고한 문제(`MapLocateButton` 헤더의 마이그레이션 이전 번호 `:289-298`)와 **같은 부류**다.

| # | 위치 | 기재된 킷 좌표 | 실제 | 영향 | 상태 |
|---|---|---|---|---|---|
| **D1** | ui-spec §5 토큰표(아이콘·라벨 색) | `mk-ui:97` | **`:96`** (`:97`은 ghost variant) | §2.2는 `:96`으로 **맞게** 적어 문서 내부 불일치 | **해소**(§5:178) |
| **D2** | ui-spec §5 토큰표(라벨 타이포) | `mk-ui:86,89-90` | **`:86,90-91`** (`:89`는 width/padding/border 줄) | §2.2는 `:90`·`:91`로 **맞게** 적음 | **해소**(§5:179) |
| **D3** | ui-spec §2.3 radius 근거 | "범례 칩 `:314`도 999" | **`mk-home.jsx:396`** (`:314`는 `SubBar`의 `{right}`) | 근거 자체는 사실(범례 칩 `borderRadius: 999`)이나 좌표가 딴 함수 | **해소**(§2.3:65) |
| **D4** | ui-spec §2.1 표 비고 | "범례 칩(`:395`)" | **`:396`** (`:395`는 `return (`) | off-by-one | **해소**(§2.1:37) |

**D1~D4 전건 해소 확인(2026-08-20, 2회차).** ui-spec §7에 **R1** 개정 이력이 남았고, 정정된 4개 좌표를 킷 파일에서 **다시 열어 재확인**했다(`mk-ui.jsx:96`=soft/accent-strong · `:86,90-91` · `mk-home.jsx:396`=범례 칩 span/`borderRadius:999`).

**ui-publisher가 정정 과정에서 새로 도입한 좌표도 검증했다**(고친 자리에 새 오류가 드는 것을 막기 위해):

| 새 좌표 | 대상 | 킷 실제 | 판정 |
|---|---|---|---|
| `mk-home.jsx:358-361` | 범례 오버레이 배치 div | `:358` `position:absolute, top:14, left:16, gap:8` / `:359-360` Legend ×2 / `:361` 닫기 | **정확** |
| `mk-home.jsx:394-399` | `Legend` 함수 | `:394` 함수 선언 ~ `:399` `);` (닫는 `}`만 `:400`) | **정확**(실질 전 범위 포함) |
| `mk-home.jsx:359-360` | 킷 범례 2종 | 우리 맛집 / 주변 음식점 | **정확** |
| `mk-extra.jsx:195` | 위시 보이스 "가보고 싶은 곳" | `:195` `"가보고 싶은 곳 추가"` span | **정확**(ui-publisher 판단대로 원래 옳았음) |

**추가로 좋은 변경**: `MapLegend.tsx` 헤더에 "칩 3개 행 ≈301pt(left:16 기준 ~317pt) → 같은 줄 중앙 정렬 오버레이와 모든 기기에서 겹침" 경고가 들어갔다.
ui-spec §3.1의 배치 근거가 이 파일의 `LEGEND_ITEMS` 개수에 **의존**하는데, 범례 칩이 늘거나 줄면 `+96` 기준선이 조용히 어긋난다.
그 의존을 코드 쪽에 남긴 것은 **본 검증에서 확인한 취약점을 정확히 겨냥한 조치**다(§2.2의 ≈301pt는 qa-visual이 독립 재계산한 값과 일치).

**추가 관찰(이번 스프린트 범위 밖, 참고)**
- ~~`src/theme/tokens/tokens.ts` 주석이 `shadow.fab` 근거를 "킷 mk-home:292"로 적었다 — 마이그레이션 **이전** 번호~~
  → **ui-publisher 수정 완료**(`tokens.ts:188-190`): `:292`→`:365` 정정 + 구 인용 사유 주석 + 재검색 pill의 토큰 공유 명시.
  **토큰 실값은 diff 0**(`#000 / .18 / r14 / (0,4) / elevation 5`)이라 §1.1의 대조 결과는 그대로 유효하다(재확인 완료).
- `src/features/map/components/MapLegend/MapLegend.tsx:3` 헤더 주석이 "칩 2개"라고 하나 `LEGEND_ITEMS`는 **3개**(위시 칩 추가 후 주석 미갱신). §2.2의 3칩 전제는 **코드가 맞다**. 미수정(선택 사항).

> ⚠ **본 리포트의 `tokens.ts` 라인 번호는 위 수정(+2행) 반영 후 값**이다(`shadow.fab` `:192` · `caption` `:223` · `spotCount` `:233`).
> D1~D4와 같은 부류의 오기를 리포트 자신이 내지 않도록 재측정했다.

---

## 7. ui-publisher 왕복 기록

| 회차 | 일시 | 내용 |
|---|---|---|
| 1 | 2026-08-20 | **D1~D4 수정 요청 발신** — ui-spec 킷 좌표 4건 오기(픽셀 영향 0, baseline 정확도 목적). 코드 수정 요청 0건 |
| 2 | 2026-08-20 | **ui-publisher 반영 확인 — D1~D4 전건 해소.** ui-spec §5·§2.1·§2.3 좌표 정정 + §7 R1 이력. 정정 좌표를 킷 파일에서 재확인했고, **정정 과정에서 새로 도입된 좌표 4개(`mk-home:358-361`·`:394-399`·`:359-360`, `mk-extra:195`)도 전부 검증 — 전건 정확**. 동반 stale 2건(`tokens.ts` `shadow.fab` `:292`→`:365`, `MapLegend.tsx` 헤더 "칩 2개"→3개)도 반영, **코드 실값 diff 0** |
| 3 | 2026-08-20 | **V7 실적용 배치 검증(developer 산출물)** — ui-spec §3.3 지시서가 그대로 적용됨을 확인, **9개 항목 전건 PASS**. ui-publisher가 요청한 2건(`box-none` 유무 · top 토큰 합성 여부)도 함께 확인해 회신. **비주얼 수정 요청 0건** |
| 4 | 2026-08-20 | **§5.2의 `box-none` 이중 의존이 ui-spec §3.4로 고정됨**(ui-publisher, §7 R2). qa-visual이 §3.4 서술을 코드와 재대조 — 4개 사실 주장(pill 래퍼 전폭 35pt 띠 / `overlay`가 `absoluteFillObject`이며 research보다 **뒤** 렌더 / 상단 앵커 3개 / 선로딩 신규 오버레이 0) **전건 정확**. 일반화 규칙("새 래퍼의 `box-none`뿐 아니라 그보다 뒤에 렌더되는 기존 전면 래퍼가 새 요소를 덮는지도 확인")도 메커니즘을 정확히 옮겼다 |
| — | — | **왕복 종료(4회).** 미해소 비주얼 이슈 0. 잔여는 V8(실기기)뿐 — qa-visual 종결 불가 |

> **§3.4가 왜 리포트보다 오래 가는가**: 이 의존은 `MapTabScreen`의 **렌더 순서**에 걸려 있어 삽입 위치만 바꿔도 뒤집히는데,
> 타입체크·유닛 테스트 어느 쪽도 잡지 못한다(`B10`은 pill 래퍼의 `box-none`만 단언하고, 배너 래퍼가 그것을 덮는 경우는 잠그지 않는다).
> 검증 산출물(리포트)이 아니라 **설계 산출물(ui-spec)** 에 남겨야 다음 오버레이 추가 때 읽힌다 — ui-publisher의 판단이 옳다.

**게이트 재측정**(qa-visual 독립 실행, 검증 범위 한정):

| 회차 | 명령 | 결과 |
|---|---|---|
| 2 | `npx jest .../MapResearchButton .../MapLegend src/theme --silent` | 3 suites / **85 passed** |
| 3 | `npx jest src/navigation/screens/MapTabScreen .../MapResearchButton --silent` | 2 suites / **76 passed** |

raw hex 0건(주석 제외) · 하드코딩 `96` 0건 · 신규 spacing 토큰 0건. 회귀 0.
(전량 `npm test`는 qa-logic 담당 — 본 리포트는 비주얼 범위로 한정 실행했다.)

---

## 8. 결론

- **컴포넌트 비주얼 충실도(V1~V6): 통과.** 킷 원본이 없는 신규 컴포넌트임에도 파생 근거 2겹(FAB 스킨 + MkButton sm 내용)이
  킷 실라인과 정확히 대응하고, 토큰 경유·raw hex 0·선례 실값 동일(`BUTTON_SIZE.sm`)까지 확인됐다.
- **배치 논증: 통과.** ui-spec §3의 산술을 토큰 실값에서 재도출해 34/27/35·96·gap 13이 모두 성립함을 확인했고,
  plan §5.1 배치 제약 3건 충족을 확인했다.
- **실적용 배치(V7): 통과.** 지시서가 그대로 적용됐고(9항목 전건 PASS), 토큰 합성(하드코딩 0)·`box-none`·inset 하단 무누수·
  상단 앵커 3개 유지가 확인됐다. 예고했던 "선로딩이 상단 4번째 요소를 추가할 위험"은 **실현되지 않았다**(로딩 피드백은 기존 중앙 배너 재사용).
  더구나 배치가 spec(`A4-6`·`B10`·`A4-3`·`A4-4`)으로 **잠겨 있어** 다음 사람이 조용히 깨뜨릴 수 없다.
- **문서 이슈 D1~D4: 전건 해소.** 정정 좌표와 **정정 과정에서 새로 도입된 좌표 4개**까지 킷 파일에서 재확인했다.
- **잔여: V8(디바이스 스모크 S7) 1건.** 실기기가 필요해 qa-visual이 종결할 수 없다.
  → **코드 기준 비주얼 검증은 전건 통과**이며, 스프린트 "비주얼 완료" 표시는 **사용자 실기기 확인 후**에 한다.
