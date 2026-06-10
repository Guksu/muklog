# Sprint Plan — UI 리디자인 (ui-design 정합/리브랜딩)

- **슬러그:** `sprint-20260610-ui-redesign`
- **작성:** sprint-planner (단독)
- **단일 출처:** `.claude/skills/ui-design/`(UI 최우선) · `docs/design/architecture.md`(동작) · `docs/code-convention.md` · `docs/testing-strategy.md`

---

## 1. 기능 한줄 정의

현재 RN 화면/공용 컴포넌트의 **시각(토큰·레이아웃·보더·타이포·아이콘)** 을 ui-design 스킬(원티드 디자인 시스템 + ui_kits/muklog 레퍼런스)에 맞춰 리디자인한다. **동작·네비·훅 계약은 일절 바꾸지 않는다(UI-only).**

> ⚠️ 핵심 제약: ui-design은 웹(CSS/JSX)이다. 본 앱은 React Native라 CSS·웹 컴포넌트를 직접 못 쓴다. **토큰·패턴·레이아웃을 RN(StyleSheet + `src/theme` 토큰)으로 번역**하는 작업이다. `mk-*.jsx`는 **시각 레퍼런스**일 뿐 복붙 금지. 특히 mk-*.jsx의 **따뜻한 톤(warm/--mk-*)과 이모지(🍽️💑🥢…)는 브랜드 규칙과 충돌** → 따르지 않는다. 비협상 브랜드 규칙(파랑·헤어라인 보더·이모지 금지)이 mk-* 톤보다 우선한다.

---

## 2. 범위

### In-scope (이번 슬라이스 = 권장안 A, §7 참조)
- **토큰 정합:** `src/theme/tokens.ts` — 컬러(primary #3366FF 도입·hairline 보더 색·brand 색)·radius(control 10 / card 16)·spacing(4px 그리드 보강)·typography(weight·스케일 정렬). 신규 시맨틱 키 추가, 기존 키 호환 유지.
- **공용 컴포넌트:** `Button.tsx`, `Text.tsx`, `Screen.tsx`, `Avatar.tsx`.
- **신규 공용 컴포넌트:** `Icon`(react-native-svg 기반, currentColor), `Card`(헤어라인 보더 surface), `Badge`(멤버 배지 등).
- **핵심 화면:** `LogListScreen`(→ mk-home LogCard/EmptyLogs), `LogScreen`(stub, → mk-log 헤더 톤만), `ProfileScreen`(→ 입력/아바타 섹션 정돈).
- **헤더/탭 시각:** `HomeTabs`(탭바·헤더), `PlusHeaderButton`/`ProfileHeaderButton`(텍스트 글리프 → 아이콘).
- **상태/보조 화면:** `SplashView`, `AuthErrorView`, `MapTabScreen`(빈 상태 톤).

### Out-of-scope
- 동작·로직·데이터·네비 구조 변경(라우트 추가/삭제, 훅 계약, RPC, 쿼리). **금지.**
- 신규 기능(먹로그 작성/리스트, 지도 SDK 연동, 초대코드 입장 UI, 다크모드 토글 UI).
- mk-*.jsx의 미구현 화면(JoinScreen·CreatedScreen·MuklogCard·MuklogDetail·MiniMap·FauxMap) — 해당 기능 스프린트에서 디자인.
- 이모지·FoodCover 그라데이션·warm 팔레트 도입(브랜드 위배).
- Wanted Sans 폰트 신규 번들(§3에서 결론: 이번엔 미도입).

---

## 3. 토큰 정합 분석 (`src/theme/tokens.ts` ↔ ui-design tokens)

> 토큰 변경은 **모든 화면에 파급**된다(Text/Button/Screen/카드가 전부 토큰 참조). 컬러 raw hex 하드코딩은 0이어야 한다.

### 3-1. 컬러

| 영역 | 현재 tokens.ts | ui-design (aliases/figma) | 결정(채택값) |
|---|---|---|---|
| primary(인터랙티브) | `blue[50]=#0066FF` | `--primary=#3366FF` | **`#3366FF`로 변경** (palette.blue에 `50p:'#3366FF'` 추가, `primary=그 값`). 인터랙티브 블루는 3366FF. |
| brand(헤드라인/로고) | (없음) | `--brand-blue=#0066FF` | **신규 `brand=#0066FF`** 추가. 브랜드 워드마크/대형 헤드라인용. |
| primaryHover/Active | `blue[45]/[40]` | `--primary-hover/active` | 유지(누름 시 darken). primary 변경에 맞춰 hover=`#2B5CE6`급 1단계 darken 값으로 정렬(팔레트 추가). |
| primaryWeak(틴트) | `blue[95]=#EAF2FE` | `--primary-surface=#EAF2FE` | **유지**(일치). 선택/배지 배경. |
| 중립 텍스트 | `fg/fgWeak/fgMuted` = neutral 10/50/80 | `--text-normal/neutral/alternative/assistive/disable` (불투명도 램프) | **4단계로 확장**: `fg`(#171717)·`fgWeak`(neutral[50])·`fgMuted`(neutral[70])·`fgAssistive`(neutral[80] placeholder). 쿨그레이 유지. |
| 라인/보더 | `border=neutral[95] #DCDCDC`(솔리드) | `--line(.22)/.16/.08/.strong(.52)` 반투명 | **헤어라인 색 신규**: `hairline='rgba(112,115,124,0.22)'`, `hairlineAlt='rgba(112,115,124,0.08)'`, `borderStrong` 유지. 카드/입력은 hairline 사용. |
| surface | `surface=neutral[99] #F7F7F7` | `--surface=white`, `--surface-alt=#F7F7F8` | **재정의**: `surface=white`(카드면), `surfaceAlt=#F7F7F8`(앱 배경 보조). `bg`는 화면 배경(white) 유지. |
| status | success/warning/error | positive/negative/cautionary | 키 유지(값 일치). |

**결정 요약:** primary를 **#3366FF**로 바꾸고 #0066FF는 `brand`로 분리. 카드/입력 보더는 솔리드 `#DCDCDC` → **반투명 헤어라인 `rgba(112,115,124,0.22)`**. 카드 surface는 white로, 화면은 white/`#F7F7F8`.

> 호환 정책: 기존 키(`primary`,`fg`,`border`,`surface`,`primaryWeak`…)는 **이름 유지**(값만 갱신). 신규 키(`brand`,`hairline`,`hairlineAlt`,`surfaceAlt`,`fgAssistive`)는 **추가**. → 소비처 대량 리네임 회피, 회귀 최소화. `darkColor`도 동일 신규 키를 미러링(MVP는 light only지만 구조 일관성).

### 3-2. radius

| 용도 | 현재 | ui-design | 결정 |
|---|---|---|---|
| control(버튼·입력·칩) | `md=8` | `--radius-control=10` | **신규 `control=10`** 추가. 버튼/입력은 `control` 사용. |
| card | `lg=12` (현 카드가 사용) | `--radius-card=16` | **신규 `card=16`** 추가. 카드/큰 surface는 `card`. (`lg=12`는 유지하되 카드는 `card`로 교체) |
| sheet/modal | (없음) | `--radius-sheet=20` | **신규 `sheet=20`** 추가(차기용). |
| pill | `full=9999` | `--radius-full` | 유지. 배지·아바타·칩. |

> 현재 카드(`radius.lg=12`)·입력(`radius.lg=12`) → control=10 / card=16으로 분리 적용. **시각적으로 가장 눈에 띄는 변화.**

### 3-3. spacing — **이미 4px 그리드 충족** (`0/2/4/6/8/10/12/14/16/20/24/32…`). ui-design의 `--space-28/48/56/64` 누락분만 **보강 추가**(28 추가; 48/56/64 이미 존재). 신규 토큰 불필요, 호환 100%.

### 3-4. typography

| role | 현재 | ui-design 의도 | 결정 |
|---|---|---|---|
| body 기본 weight | `Pretendard-Regular` | **Medium(500)이 기본 본문** | **`body`/`bodyLg`/`bodySm` family를 `Pretendard-Medium`으로** (ui-design: "Medium is the default body weight, not Regular"). Regular 폰트 파일은 유지(소비처 없으면 dormant). |
| heading/title weight | h1/h2 Bold, h3 SemiBold | title=Bold, heading2/headline=SemiBold | 유지(정렬됨). |
| 스케일 | display40/h32/h24/h20/body16/14/12 | display→caption 램프 | 유지(근사 일치). letterSpacing은 RN에서 px 변환 필요 시만 보강(선택). |
| 브랜드 헤드라인 | Pretendard | Wanted Sans | §3-5 결론대로 **이번엔 미도입**(Pretendard-Bold로 대체). |

### 3-5. effects — **헤어라인 보더 vs 그림자**
- ui-design 비협상 규칙: **카드는 그림자 대신 헤어라인 보더.** 현재 `shadow` 토큰 존재하나 카드는 이미 borderWidth 사용 중(방향 OK). 단 보더 **색이 솔리드** → §3-1 hairline 색으로 교체.
- **그림자는 "떠 있는 레이어"에만**(시트·토스트·드롭다운). 이번 슬라이스엔 그 레이어가 없으므로 카드/입력/탭바 그림자 **0**. `shadow` 토큰은 차기(시트) 위해 보존.
- RN 헤어라인 구현: `borderWidth: StyleSheet.hairlineWidth` + `borderColor: theme.color.hairline`. (웹 `inset box-shadow`는 RN 미지원 → border로 번역.)

---

## 4. 아이콘 / 폰트 / 에셋

### 4-1. 아이콘 (이모지 금지 — 비협상)
- **현재 상태:** 아이콘 시스템 없음. 텍스트 글리프 사용 중 — `PlusHeaderButton`의 `+`, `LogListScreen` 카드의 `›`, `ProfileHeaderButton`의 "프로필" 텍스트. ui-design은 **currentColor SVG 아이콘셋**(`.claude/skills/ui-design/assets/icons/`) 사용을 요구.
- **결정:**
  1. **`react-native-svg` 의존성 추가**(Expo 호환, expo install). 미설치 상태이므로 작업 항목에 포함.
  2. `assets/icons/`(앱 루트, 현재 없음) 신규 생성 → ui-design `assets/icons/`에서 **이번에 쓰는 글리프만 복사**: `plus`, `chevron-right`, `chevron-left`, `person`/`person-fill`, `location`, `bubble`/`bubble-fill`(먹로그 탭), `camera`, `star`/`star-fill`, `close`, `setting`. (SVG 원본은 currentColor 단색.)
  3. **`Icon` 공용 컴포넌트** 신규(`src/components/Icon.tsx`): props `{ name: IconName; size?: number; color?: ColorToken }`. 내부에서 SvgXml 또는 정적 import 맵으로 렌더, `color`는 토큰에서 해석. enum-style `IconName` 상수.
  4. 글리프 교체: `+`→`plus`, `›`→`chevron-right`, "프로필" 텍스트→`person` 아이콘 버튼, 탭바 아이콘(먹로그=`bubble`/`bubble-fill`, 지도=`location`).
- **이모지 전면 금지:** mk-*.jsx의 🍽️💑🥢💌🎉🍜 등은 **도입하지 않음**. EmptyLogs도 이모지 대신 아이콘/타이포로.

### 4-2. 폰트
- **Pretendard:** 이미 `expo-font` + `assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.ttf` 로드 중. `fontMap`(src/theme/fonts.ts) ↔ typography fontFamily 1:1 대응(경계면 B4). **추가 작업 없음**(body weight를 Medium으로 바꿔도 Medium 파일 이미 번들됨).
- **Wanted Sans(브랜드 헤드라인):** ui-design은 대형 브랜드 헤드라인에 Wanted Sans 권장. **이번엔 미도입.** 사유: (a) 새 폰트 파일 번들 = 앱 크기·로드 비용 증가, (b) 현 화면에 대형 브랜드 워드마크 화면(스플래시 로고 등) 부재, (c) UI 본문은 Pretendard로 충분. → `font-brand` 자리는 Pretendard-Bold로 매핑. **Wanted Sans는 별도 브랜딩 스프린트로 분리 제안.**

### 4-3. 기타 에셋 — 브랜드 이미지(`assets/images/`)는 마케팅용, 제품 화면 미사용. 도입 안 함.

---

## 5. 화면 / 컴포넌트별 리디자인 항목

> 각 항목은 **시각만** 변경. 텍스트 카피·testID·핸들러·네비 호출은 불변(테스트 보호).

### 5-1. `src/theme/tokens.ts` — (§3 반영)
- palette: `blue`에 `interactive:'#3366FF'`(+hover/active 1단계), 신규 `coolGray` 보더 색.
- lightColor/darkColor: `primary=#3366FF`, 신규 `brand`,`hairline`,`hairlineAlt`,`surfaceAlt`,`fgAssistive`.
- radius: 신규 `control:10`,`card:16`,`sheet:20`.
- spacing: `28` 보강.
- typography: `body/bodyLg/bodySm` family → `Pretendard-Medium`.

### 5-2. `src/components/Text.tsx`
- 변경 거의 없음(토큰 참조형). body weight 변경은 tokens에서 흡수. 신규 `color` 토큰 키(`brand`,`fgAssistive`) 자동 사용 가능(타입 확장만).

### 5-3. `src/components/Button.tsx` (레퍼런스: mk-ui MkButton, ui-design Button.d.ts)
- radius: `md(8)` → **`control(10)`**.
- secondary 보더: `border` 솔리드 → **`hairline`**.
- 누름 상태: 현 `opacity .85` 유지하되, primary는 hover/active 토큰으로 darken 정렬(선택). disabled는 `text-disable`/`interaction-disable` 톤.
- padding: 현 `14/20` 유지(4px 그리드 충족). 사이즈 variant(sm/md/lg)는 **이번 스코프 외**(현 단일 사이즈 유지 — 동작/Props 불변).

### 5-4. `src/components/Screen.tsx`
- 배경 `bg`(white) 유지. 화면 패딩 `spacing[20]`(=layout gutter 20) 유지(정렬됨). 변경 최소.

### 5-5. `src/components/Avatar.tsx` (레퍼런스: mk-ui MkAvatar, ui-design Avatar.d.ts)
- 보더 솔리드 `border` → **`hairline`**. placeholder 배경 `primaryWeak` 유지. radius full 유지. 이니셜 타이포 유지(이모지 금지 — 현재도 이니셜이라 OK).

### 5-6. `src/components/Card.tsx` **(신규)** (레퍼런스: ui-design Card, mk LogCard)
- props `{ children; onPress?; style? }`. surface=white, `borderWidth: hairlineWidth`, `borderColor: hairline`, `borderRadius: card(16)`, padding `spacing[16]`. **그림자 없음.** Pressable 래핑 시 누름 opacity.

### 5-7. `src/components/Badge.tsx` **(신규)** (레퍼런스: mk MemberBadge)
- props `{ label; tone?: 'primary'|'neutral' }`. pill radius, primary tone=`primaryWeak`+`primary` 텍스트 / neutral=`fill`톤. **이모지 미포함**(mk의 💑🙋 제거).

### 5-8. `src/components/Icon.tsx` **(신규)** — §4-1.

### 5-9. `src/navigation/screens/LogListScreen.tsx` (레퍼런스: **mk-home LogCard / EmptyLogs / LogListScreen**)
- 카드 → 신규 `Card` 사용(헤어라인·card radius 16). 인라인 카드 스타일 제거.
- 배지 → 신규 `Badge`(멤버 수 파생 라벨 유지: 둘이/혼자).
- chevron 글리프 `›` → `Icon name="chevron-right"`(`fgMuted`).
- 생성일 타이포 `bodySm/fgWeak` 유지(포맷 불변).
- 빈 상태: 현 텍스트 2줄 유지 + (선택) 상단에 `Icon`(이모지 금지). 카피 불변("아직 로그가 없어요" / "오른쪽 위 + 버튼으로…").
- mk-home의 아바타 더블스택·"맛집 N곳" 줄은 **데이터 의존(OUT-OF-SCOPE)** — 현 데이터(roomId/memberCount/createdAt)만으로 구성. 추가 데이터 페치 금지.

### 5-10. `src/navigation/screens/LogScreen.tsx`
- stub 유지(준비 중). 타이포·색 토큰 정렬만. 신규 기능 추가 금지.

### 5-11. `src/navigation/screens/ProfileScreen.tsx` (레퍼런스: mk 프로필 톤 + ui-design Input)
- 아바타: size 96 유지, 신규 hairline. "사진 변경" 버튼 secondary(control radius).
- 닉네임 입력: radius `lg(12)` → **`control(10)`**, 보더 → **`hairline`**, placeholder 색 `fgMuted`→`fgAssistive`. 패딩 4px 그리드 유지.
- 에러 메시지·검증 카피·핸들러 **불변**.

### 5-12. `src/navigation/HomeTabs.tsx`
- 탭바: 활성=`primary`(#3366FF), 비활성=`fgWeak`. `borderTopColor` → `hairline`. 탭 아이콘 도입(react-navigation `tabBarIcon`): 먹로그=`bubble`/`bubble-fill`, 지도=`location`(focused 변형). 라벨 타이포 유지.
- 헤더: `headerShadowVisible:false` 유지(헤어라인 톤). 헤더 타이틀 타이포 토큰 유지.

### 5-13. `src/navigation/PlusHeaderButton.tsx`
- 텍스트 `+`(Text h3) → **`Icon name="plus"` color="primary"**. loading 스피너·핸들러·접근성 라벨("로그 만들기") 불변.

### 5-14. `src/navigation/ProfileHeaderButton.tsx`
- 텍스트 "프로필"(Text) → **`Icon name="person"` color="primary"**(아이콘 버튼). 접근성 라벨("프로필")·navigate 호출 불변.

### 5-15. `src/navigation/screens/SplashView.tsx` / `AuthErrorView.tsx` / `MapTabScreen.tsx`
- 토큰 정렬(색/타이포)만. 카피·핸들러 불변. 빈 상태 톤 정돈(이모지 금지).

---

## 6. 인수조건 (검증 가능 / 가능한 한 테스트)

### A. 브랜드/토큰 준수
- [ ] **AC-1** `src/theme/tokens.ts`에서 `primary === '#3366FF'`, 신규 `brand === '#0066FF'` 존재. (단위 테스트: tokens import 후 값 단언 — 신규 `tokens.spec.ts`)
- [ ] **AC-2** 신규 토큰 키 `hairline`,`hairlineAlt`,`surfaceAlt`,`fgAssistive` 존재 + `radius.control===10`,`radius.card===16`. (tokens.spec.ts)
- [ ] **AC-3** `src/` 전체에서 컴포넌트/화면 스타일의 **raw hex 색상 = 0건**(`#RRGGBB` literal). (grep 게이트: `rg "#[0-9a-fA-F]{6}" src/ --glob '!**/tokens.ts' --glob '!**/*.spec.*'` → 0건. hairline의 rgba는 tokens.ts에만 존재.)
- [ ] **AC-4** 카드/입력/아바타 보더가 솔리드 회색이 아닌 **hairline 토큰** 사용(코드 리뷰 + grep `theme.color.border` 잔존 0 또는 의도적).
- [ ] **AC-5** body 계열 typography family === `Pretendard-Medium`. (tokens.spec.ts)

### B. 아이콘/이모지
- [ ] **AC-6** 제품 화면 코드에 **이모지 유니코드 0건**. (grep 게이트: 이모지 정규식 스캔 src/ → 0건.)
- [ ] **AC-7** `Icon` 컴포넌트 렌더 테스트: `name` prop으로 해당 SVG 노드 렌더, `color` 토큰 해석. (`Icon.spec.tsx`)
- [ ] **AC-8** `PlusHeaderButton`/`ProfileHeaderButton`이 텍스트 글리프 대신 Icon을 렌더(접근성 라벨은 유지). (기존 스펙 갱신 — 아래 §7 테스트 영향)

### C. 화면별 핵심 시각 요소
- [ ] **AC-9** `LogListScreen` 카드가 `Card`(hairline·radius 16)로 렌더되고 chevron-right 아이콘 포함. 멤버 배지·생성일 텍스트 **불변**.
- [ ] **AC-10** `ProfileScreen` 입력 radius=control(10)·hairline 보더. 아바타 96.
- [ ] **AC-11** 탭바 활성색=primary(#3366FF), 탭 아이콘 표시.

### D. 기능/동작 불변 (UI-only 게이트)
- [ ] **AC-12** **기존 동작 테스트 전부 통과**(카피·testID·핸들러·네비 호출 불변). 시각 변경이 동작 단언을 깨지 않음.
- [ ] **AC-13** 라우트 추가/삭제 0, 훅 시그니처 변경 0, RPC/쿼리 변경 0. (diff 리뷰 게이트: `src/features/**` 변경은 타입 확장 외 0.)

### E. 컨벤션
- [ ] **AC-14** code-convention 100%(화살표 함수, named-object 인자, useEffect 명명, useCallback/useMemo 미사용, enum-style 상수, 토큰 스타일링). Icon/Card/Badge 신규 컴포넌트도 동일.

---

## 7. 테스트 영향

> 동작 테스트는 **text/testID/핸들러** 기반이라 시각 변경에 대체로 무영향. 단 **글리프→아이콘 전환**과 **토큰 키 변경**이 일부 단언을 건드린다.

| 영향 spec | 사유 | 갱신 방침 |
|---|---|---|
| `PlusHeaderButton.spec.tsx` | `+` 텍스트 단언이 있으면 깨짐 | 텍스트 단언 → 접근성 라벨("로그 만들기")/Icon testID 단언으로 교체 |
| `ProfileHeaderButton.spec.tsx` | "프로필" 텍스트 단언 가능성 | 접근성 라벨("프로필")/Icon으로 교체 |
| `LogListScreen.spec.tsx` | chevron `›` 텍스트 단언 시 깨짐. 카드 컴포넌트 교체 | 배지·생성일·navigate 단언은 유지. `›` 단언 있으면 Icon으로 교체 |
| `ProfileScreen.spec.tsx` | 입력 동작 단언 위주 → 영향 낮음 | placeholder 텍스트 단언 유지(불변). 스타일 단언 없으면 무수정 |
| `Avatar.spec.tsx` | testID/이니셜 기반 → **무영향** | 무수정 |
| **신규** `tokens.spec.ts` | AC-1/2/5 검증 | 신규 작성 |
| **신규** `Icon.spec.tsx` | AC-7 | 신규 작성 |
| **신규** `Card.spec.tsx`/`Badge.spec.tsx` | 렌더/누름 스모크 | 신규 작성(경량) |

- **방침:** 시각 회귀 스냅샷 테스트는 **도입하지 않음**(testing-strategy: 스냅샷 미채택, 유틸·훅·화면 동작 중심). 대신 토큰 값 단언 + 접근성 라벨/Icon 존재 단언으로 검증.
- **완료 기준:** `npm test` 전체 통과 + `npx tsc --noEmit` 통과. (토큰 타입 `ColorToken` 확장 시 컴파일 영향 점검.)

---

## 8. 엣지케이스 / 주의

1. **다크모드:** MVP는 light 고정(ThemeProvider `scheme='light'`). darkColor에 신규 키를 **미러링만** 하고 토글 UI는 미도입(차기). 누락 시 tsc에서 키 불일치 가능 → 양쪽 동일 키 보장.
2. **명도 대비(접근성):** primary #3366FF on white ≈ 4.6:1(AA 통과, 큰 텍스트/UI OK). `fgAssistive`(28%급) placeholder는 본문 금지(placeholder/disabled 한정). hairline 보더는 비텍스트(대비 규정 완화).
3. **토큰 키 변경 회귀 범위:** `primary` 값만 바뀌고 키는 유지 → 소비처 변경 0. `border`→`hairline` 교체는 **소비처를 직접 수정**(grep로 전수 확인). 값만 바꿔 모든 화면 일괄 반영됨에 유의.
4. **react-native-svg 설치:** Dev Client 재빌드 필요할 수 있음(네이티브 모듈). 설치 후 스모크는 디바이스/시뮬에서(단위는 Svg 모킹). testing-strategy의 "외부 SDK/네이티브=모킹·스모크" 경계 적용 → jest에서 `react-native-svg` 모킹.
5. **글리프 잔존:** `›`,`+` 등 텍스트 글리프가 다른 곳에 남지 않도록 grep 게이트.
6. **이모지 유혹:** mk-*.jsx가 이모지를 적극 사용 → **레퍼런스의 톤만 차용, 이모지는 전부 제외**. QA 교차검증 포인트.
7. **Avatar Image ImageStyle 캐스팅:** 기존 캐스팅 패턴 유지(hairline 추가 시 ViewStyle/ImageStyle 동일 속성 확인).

---

## 9. 스코프 평가 + 분할 제안

**전체(토큰 + 공용 4 + 신규 3 + 전 화면 9 + 네비 + 아이콘 도입 + svg 의존성)는 1스프린트로 다소 과대.** 특히 react-native-svg 도입 + 아이콘셋 + 신규 컴포넌트 3종은 그 자체로 무게가 있다.

### 권장 분할
- **슬라이스 A (이번 스프린트, 권장):** 토큰 정합(§3) + 공용 컴포넌트(Button/Text/Screen/Avatar) + 신규 Card/Badge + **Icon 인프라(react-native-svg + Icon + 필요한 글리프만)** + 핵심 화면(LogListScreen, ProfileScreen, LogScreen stub) + 헤더 버튼 아이콘화(Plus/Profile).
- **슬라이스 B (차기):** 나머지 시각 정돈 — HomeTabs 탭바 아이콘 풀세트, SplashView/AuthErrorView/MapTabScreen 톤, EmptyLogs 일러스트/아이콘 고도화, (선택) Wanted Sans 브랜드 헤드라인 도입.

> **이번 슬라이스 = A.** 사유: 토큰·공용 컴포넌트·핵심 화면은 **파급의 근원**이라 함께 가야 일관성이 확보된다. 헤더 버튼 아이콘화는 Icon 인프라가 A에 있으니 같이 처리(저비용). 탭바 풀세트/보조 화면은 B로 미뤄 위험 분산.
>
> 만약 svg 도입이 부담되면 **A를 더 줄여** Icon을 B로 미루고, A는 "토큰 + 공용 컴포넌트(보더/radius/색) + 핵심 화면 카드/입력 정돈"만으로 한정 가능(글리프는 임시 유지). 리더 판단 필요 시 질문.

---

## 10. 작업 목록 (파일 단위 · 우선순위)

> TDD: 가능한 항목은 Red(spec)→Green→Refactor. 토큰/Icon/Card/Badge는 단위 테스트 우선.

### P0 — 토큰 (파급 근원, 먼저)
- [ ] **T1** `src/theme/tokens.ts` §3 반영(primary #3366FF, brand, hairline·hairlineAlt, surfaceAlt, fgAssistive, radius.control/card/sheet, spacing 28, body→Medium). darkColor 신규 키 미러. (AC-1/2/5)
- [ ] **T2** `src/theme/tokens.spec.ts` **신규** — 값 단언. (AC-1/2/5)
- [ ] **T3** `ColorToken`/타입 확장 점검 + `npx tsc --noEmit`. (AC-13)

### P1 — Icon 인프라
- [ ] **T4** `react-native-svg` 설치(`npx expo install react-native-svg`) + jest 모킹 설정. (AC-7 / 엣지4)
- [ ] **T5** `assets/icons/` 생성 + 필요한 글리프 복사(plus·chevron-left·chevron-right·person·location·bubble·bubble-fill·camera·star·star-fill·close·setting). (AC-6)
- [ ] **T6** `src/components/Icon.tsx` 신규(enum-style IconName, color 토큰 해석) + `Icon.spec.tsx`. (AC-7)

### P2 — 공용 컴포넌트
- [ ] **T7** `Button.tsx` — radius control(10), secondary hairline, 누름/disabled 톤. (AC-3/4)
- [ ] **T8** `Avatar.tsx` — hairline 보더. (AC-4)
- [ ] **T9** `Card.tsx` **신규** + `Card.spec.tsx`(hairline·radius 16·그림자 0·누름). (AC-9 근거)
- [ ] **T10** `Badge.tsx` **신규** + `Badge.spec.tsx`(pill·tone·이모지 없음). (AC-9 근거)
- [ ] **T11** `Text.tsx` — 타입 확장(신규 color 키) 반영(로직 변경 최소). 
- [ ] **T12** `src/components/index.ts` — Icon/Card/Badge export.

### P3 — 핵심 화면
- [ ] **T13** `LogListScreen.tsx` — Card·Badge·chevron-right 아이콘 적용. 동작/카피 불변 + spec 갱신(글리프 단언 제거). (AC-9/12)
- [ ] **T14** `ProfileScreen.tsx` — 입력 control radius·hairline, 아바타 hairline. 동작 불변. (AC-10/12)
- [ ] **T15** `LogScreen.tsx` — 토큰 정렬만(stub 유지). (AC-12)

### P4 — 헤더 버튼
- [ ] **T16** `PlusHeaderButton.tsx` — `+`→Icon plus + spec 갱신. (AC-8/12)
- [ ] **T17** `ProfileHeaderButton.tsx` — 텍스트→Icon person + spec 갱신. (AC-8/12)
- [ ] **T18** `HomeTabs.tsx` — 탭바 hairline·활성색·(가능 시)탭 아이콘. 색만이면 A, 아이콘 풀세트는 B로 가능. (AC-11)

### P5 — 게이트
- [ ] **T19** grep 게이트: raw hex 0(AC-3), 이모지 0(AC-6), 글리프 잔존 0(엣지5).
- [ ] **T20** `npm test` 전체 통과 + `npx tsc --noEmit`. (완료 기준)

---

## 11. QA가 교차검증할 경계면

1. **토큰 ↔ 소비처:** primary 값 변경이 **모든 화면**에 반영되는가? `border`→`hairline` 교체 후 잔존 솔리드 보더 없는가?
2. **이모지/글리프 게이트:** 제품 화면 코드 이모지 0, 텍스트 글리프(`+`,`›`) 0 — grep 교차.
3. **동작 불변(UI-only):** 카피·testID·핸들러·navigate·접근성 라벨 불변. `src/features/**` 비변경(타입 확장 제외).
4. **헤더 버튼 접근성:** 아이콘화 후에도 `accessibilityLabel`("로그 만들기"/"프로필") 유지 → 스크린리더 회귀 없음.
5. **react-native-svg 모킹/스모크:** 단위는 모킹 통과, 실제 아이콘 렌더는 디바이스 스모크.
6. **radius/spacing 토큰값:** control=10·card=16·4px 그리드 — 하드코딩 숫자 보더/라운드 잔존 여부.
7. **tsc/light·dark 키 일관성:** darkColor 신규 키 누락으로 인한 타입/런타임 오류 없는가.

---

## 12. 비용 가드레일 체크
- **해당 없음(대부분):** 이번 기능은 시각 변경으로 Kakao/네트워크/이미지 압축 신규 호출 없음.
- **앱 번들 비용:** react-native-svg(소형) + 아이콘 SVG(필요분만) — 경량. **Wanted Sans 미도입**으로 폰트 번들 증가 회피(§4-2). 브랜드 이미지 미도입.
- **재빌드:** svg 네이티브 모듈로 Dev Client 1회 재빌드 가능 — 비용 아님(빌드 시간만).

---

## OUT-OF-SCOPE (재명시)
- 동작/로직/데이터/네비/RPC/쿼리 변경, 신규 기능, 다크모드 토글 UI, Wanted Sans 번들, mk-*.jsx 미구현 화면 디자인, 시각 스냅샷 테스트, FoodCover/이모지/warm 팔레트.
