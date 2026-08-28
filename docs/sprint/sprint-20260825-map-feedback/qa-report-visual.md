# QA Report — Visual (sprint-20260825-map-feedback)

> 검증자: qa-visual · 기준: 킷 `templates/muklog`(비주얼 단일 출처) · `visual-qa` 스킬 3축(레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피)
> 계약: `plan.md` §3.3(U5 비주얼 계약)·§7 qa-visual 3쌍 · 구현 보고: `dev-notes.md` §1·§10
> 이 스프린트는 로직 중심이라 `ui-spec.md`가 없다 — plan §3.3이 비주얼 계약을 겸한다.
> 읽기 전용 수행(코드 수정 0 · git 0). 렌더 픽셀은 볼 수 없다 — 픽셀 판정은 §5 디바이스 스모크가 단독 권위.

## 최종 판정: **PASS**

킷 대조 3쌍 전부 통과, 불일치 0건. 아래 §4 관찰 2건은 **차단 아님**(하나는 스모크 S5 관측 대기, 하나는 부수 영향 정합 확인).

---

## 1. 킷 근거 — `#EFEAE3`는 임의 색이 아니다

**킷 원천(verbatim 인라인 실값)**

| 킷 라인 | 내용 |
|---------|------|
| `.claude/skills/ui-design/templates/muklog/mk-home.jsx:336` | `<div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#EFEAE3" }}>` — `MapScreen`의 지도 영역 컨테이너 |

**킷 토큰 체계와의 관계 — 확인 완료.** 킷 `index.html:17-28`이 정의하는 `--mk-*`는 `accent`·`accent-strong`·`accent-weak`·`accent-line`·`accent-shadow`·`bg`(#FFFFFF)·`card`(#FFFFFF)·`ink`·`ink2`·`radius-card`(22)·`radius-btn`(14)·`shadow-card` **뿐이며, 지도 톤에 해당하는 변수는 없다.** 즉 `#EFEAE3`는 킷이 지도 영역에만 쓰는 **인라인 실값이 곧 SSOT**다. 이를 RN 전용 토큰으로 승격한 것은 이 저장소의 확립된 선례를 그대로 따른 것이다:

| 선례 토큰 | 킷 출처 | 성격 |
|-----------|---------|------|
| `mapNearbyPin` `#B6ABA0` | `mk-home.jsx:282·314` | `--mk-*` 아닌 인라인 실값 → 전용 토큰 |
| `mapLocate` `#3B82F6` | `mk-home.jsx:270·298` | 동일 |
| `calendarSun/Sat` `#E5484D`/`#3B82F6` | `mk-extra.jsx:100` | 동일 |
| **`mapSurface` `#EFEAE3`** | **`mk-home.jsx:336`** | **동일 패턴 — 정합** |

`tokens.ts:74-77`의 주석이 이 근거(킷 라인·SSOT·WebView 격리 사유)를 명시하고 있어 문서 부채도 0이다.

### 네 곳 실값 동일성 (plan §7 qa-visual 1)

| # | 위치 | 파일:라인 | 실값 |
|---|------|-----------|------|
| ① | 킷 지도 영역 | `mk-home.jsx:336` | `#EFEAE3` |
| ② | RN 토큰(palette) | `src/theme/tokens/tokens.ts:77` | `#EFEAE3` |
| ②' | RN 토큰(lightColor) | `src/theme/tokens/tokens.ts:142` | `palette.mapSurface` |
| ③ | WebView CSS `html, body` | `src/features/map/mapHtml/mapHtml.ts:27` | `#EFEAE3` |
| ③' | WebView CSS `#map` | `src/features/map/mapHtml/mapHtml.ts:30` | `#EFEAE3` |
| ④ | RN 컨테이너 | `src/features/map/components/MapWebView/MapWebView.tsx:53` | `theme.color.mapSurface` |

**PASS — 다섯 지점 전부 `#EFEAE3` 일치.** RN 측(④)은 raw hex가 아니라 토큰 경유이고, WebView 측(③·③')의 hex 직박음은 격리 HTML이라는 기존 예외(`.mk-pin` #3366FF·`.mk-pin--nearby` #B6ABA0·`.mk-pin--wish` #FFB23E) 선례와 동일하다 → **토큰 우회 아님**.

---

## 2. 로딩 배너 — 신규 비주얼 0 (plan §7 qa-visual 2)

| 축 | 확인 | 결과 |
|----|------|------|
| 카피 | `MapTabScreen.tsx:393`이 `MAP_COPY.loading` 재사용 → `MapTabScreen.tsx:78` `'지도를 불러오는 중이에요'` (해요체, 기존 단일 출처) | ✅ 신규 카피 0 |
| 컴포넌트 | `MapTabScreen.tsx:443-452`가 기존 `MapStatusOverlay`를 `tone={MapStatusTone.Loading}`으로 렌더 | ✅ 신규 컴포넌트 0 |
| 컴포넌트 변경 | `MapStatusOverlay.tsx`는 **이번 diff에 없음**(`git diff --stat` 미포함) | ✅ 변경 0 |
| z-순서·배치 | `styles.overlay` + `pointerEvents="box-none"` — 기존 오버레이 레이어 그대로. 우선순위 사슬만 조건 확장 | ✅ 배치 불변 |

`MapStatusOverlay` 자체도 전량 토큰 경유로 킷 규칙 정합 상태다(재확인): `backgroundColor: theme.color.surface`, `borderColor: theme.color.hairline` + `borderWidth: StyleSheet.hairlineWidth`(**그림자 아닌 헤어라인 보더**), `borderRadius: theme.radius.card`(카드 16), `paddingVertical/Horizontal: theme.spacing[16]/[20]`, `gap: theme.spacing[10]`(4px 그리드), 스피너 `color={theme.color.primary}`(#3366FF). raw hex 0.

**PASS.**

---

## 3. dev-notes §10 "킷 시안 변경 0" 주장 검증 — 사실

diff 관점으로 프로덕션 3개 RN 파일 + WebView HTML을 전수 확인했다.

| 파일 | 변경 성격 | 레이아웃 | radius | 폰트 | 간격 | 카피 |
|------|----------|---------|--------|------|------|------|
| `tokens.ts` | palette 1키 + lightColor 1키 + 주석 6줄 **추가만** | — | — | — | — | — |
| `MapTabScreen.tsx:388-394` | 로딩 분기 조건에 `\|\| !mapReady` + 주석 3줄 | 불변 | 불변 | 불변 | 불변 | 불변(`MAP_COPY.loading` 재사용) |
| `MapWebView.tsx:45-71` | 화살표 표현식 → 블록 본문(`useTheme` 호출용) + `testID` + `backgroundColor` | **불변** | — | — | — | — |
| `mapHtml.ts:23-30` | `html, body`·`#map`에 `background` 선언 각 1개 추가 + 주석 | 불변(`position/top/left/right/bottom` 동일) | — | — | 불변(`margin:0; padding:0` 동일) | — |

- `MapWebView`의 본문 형태 변경은 **JSX 트리 구조·순서·스타일 배열 순서가 그대로**다(`View > WebView + (children ? absoluteFill View : null)`). 들여쓰기만 이동 — dev-notes §10-1 주장과 diff가 일치한다.
- `styles.container`(`{ flex: 1, overflow: 'hidden' }`)·`styles.webview`(`{ flex: 1 }`)는 **무변경**.
- safe-area: `MapTabScreen`의 `insets.top` 기반 필터바(:409)·범례(:421)·재검색 pill(:435) 오프셋은 diff에 없음 → **불변**.

### 클러스터 버블 실값 회귀 0 (plan §7 qa-visual 3)

`mapHtml.ts` diff에서 `mkClusterStyle`·`MK_CLUSTER_STYLES` 블록은 **한 줄도 바뀌지 않았다.** `map-clustering` §3.4 실값 재확인: 40/48/56px 3단계(`mapHtml.ts:118-120`), 배경 `#3366FF`(:108), `border: '2px solid #FFFFFF'`(:110), `borderRadius: '999px'`(:111), `fontWeight: '700'`(:113), `boxShadow: '0 3px 5px rgba(0,0,0,0.18)'`(:114), 경계 `calculator: [10, 100]`(:91), `gridSize: 60`(:89), `minLevel: 2`(:90). 핀 클래스(`.mk-pin` 34px/radius 17, `.mk-pin--active` 44px/radius 22 + `0 6px 10px rgba(0,0,0,0.25)`)도 동일. **PASS.**

`MK_CLUSTER_OPTIONS`에 추가된 `disableClickZoom: true`는 **동작 옵션**이지 스타일 값이 아니다 → 비주얼 계약 영향 0.

---

## 4. 다크 모드 · 모션

### 4.1 다크 모드 (E11)

`tokens.ts` 전체에서 `mapSurface` 등장은 **4곳뿐**(74·77 palette / 141·142 lightColor). `darkColor`(:160-161)는 `...lightColor` 스프레드로 시작하고 **`mapSurface` 오버라이드가 없다** → 다크에서도 `#EFEAE3`로 자동 미러. `themes.light.color.bg`는 `palette.white`(#FFFFFF)라 U5-4의 `!== bg` 단언도 유효하다.

**의도대로 판정 — PASS.** 지도 캔버스는 Kakao 타일이 항상 라이트라 톤을 고정하는 게 맞고, `mapNearbyPin`·`mapWishPin`·`mapLocate`가 이미 같은 이유로 라이트/다크 공통이다. 덧붙여 `ThemeProvider.tsx:3·12`가 **MVP는 light 고정**(다크 토글은 후속 스프린트)이라 현재 런타임 영향도 0이다.

### 4.2 모션 300ms (원칙 4)

`MK_CLUSTER_ZOOM_DURATION_MS = 300`(`mapHtml.ts:98`)은 `ux-principles` 원칙 4의 **150~300ms 범위 상단**에 정확히 들어가고 Kakao `animate.duration` 기본값과도 일치한다 → **범위 내 PASS.** 다만 원칙 4는 "제스처·모션은 실기기 검증 필수"를 함께 규정하므로, 체감 판정은 스모크 S1·S2가 단독 권위다(§5).

---

## 5. 관찰 2건 (차단 아님)

### O1. WebView 자체 배경이 첫 프레임을 여전히 흰색으로 칠할 수 있다 — **미검증(스모크 S5 관측 대기)**

`MapWebView.tsx:53`의 컨테이너 배경은 WebView **뒤**에 있다. 자식 `<WebView style={styles.webview}>`(:58, `styles.webview = { flex: 1 }` :75)에는 `backgroundColor`가 없고, 네이티브 WebView는 문서가 페인트되기 전까지 자기 불투명 배경(기본 흰색)을 그린다. 그렇다면 U5가 없애려는 첫 프레임 흰 점멸이 **컨테이너 배경에 가려지지 않고 그대로 남을 수 있다.**

- 이건 킷 불일치가 아니다 — plan §3.3-③이 계약한 대상(컨테이너)은 정확히 구현됐다. **RN 렌더 실제 동작의 문제**이고, QA는 픽셀을 볼 수 없으므로 **판정 불가 → 스모크 S5가 단독 권위**.
- S5("흰 여백이 보이지 않고 지도 톤 + 로딩 배너")에서 흰 점멸이 여전히 관측되면, 후속 최소 수정안: `styles.webview`에도 `backgroundColor: theme.color.mapSurface`를 얹는다(값은 이미 토큰에 있으므로 신규 토큰 0). iOS에서 남으면 `opaque={false}` 추가 검토.
- **S5 통과 시 이 항목은 자동 종결** — 지금 수정을 요청하지 않는다(관측 없는 선제 변경은 계약 밖).

### O2. `MapWebView` 소비자 2곳이 지도 톤을 함께 상속한다 — **정합 확인, 회귀 아님**

`MapWebView`는 `MapTabScreen.tsx:404` 외에 두 곳에서 더 쓰인다. 둘 다 `style`로 배경을 덮지 않으므로 `#EFEAE3`를 상속한다.

| 소비자 | 파일:라인 | 영향 | 판정 |
|--------|-----------|------|------|
| `MapPrewarm` | `MapPrewarm.tsx:53` (래퍼 `styles.hidden` = `position:absolute, 1×1, opacity:0` :60) | **가시 영향 0** | ✅ plan §3.3이 예상한 대로 |
| `MuklogMiniMap` | `MuklogMiniMap.tsx:36-37` (먹로그 상세 "위치" 미니맵, `height:150` + `radius.action` clip) | 실제 Kakao 지도 **뒤** 배경이 흰색 → `#EFEAE3` | ✅ 킷 톤 정합 |

미니맵은 킷 `mk-log.jsx:350-360`의 `MiniMap`에 대응하고, 킷은 그 베이스 면을 `#ECE6DD`(:354)로 칠한다 — **같은 웜 계열**이라 흰색보다 킷에 가까워진 방향이다. 게다가 실제 지도 타일이 덮으므로 페인트 전에만 보인다. **회귀 아님.**

> 다만 기록해 둔다: 킷 미니맵 베이스는 `#ECE6DD`로 지도 영역(`#EFEAE3`)과 **다른 값**이다. 훗날 미니맵 폴백/플레이스홀더 톤을 명시적으로 지정하게 되면 `mapSurface`가 아니라 `#ECE6DD` 기준 전용 토큰이어야 한다(이번 스프린트 범위 밖).

---

## 6. 분류 요약

### 통과 (5)

1. `#EFEAE3` 킷 근거 확인 — `mk-home.jsx:336` verbatim 인라인 실값, 킷에 대응 `--mk-*` 없음, `mapNearbyPin`·`mapLocate` 선례와 동일한 토큰 승격 패턴 (§1)
2. 다섯 지점 실값 동일 — 킷 336 / `tokens.ts:77·142` / `mapHtml.ts:27·30` / `MapWebView.tsx:53`(토큰 경유) (§1)
3. 로딩 배너 신규 비주얼 0 — `MAP_COPY.loading`·`MapStatusOverlay` 재사용, 컴포넌트 무변경, 배치·z-순서 불변 (§2)
4. 다크 미러 정상 — `darkColor` 오버라이드 0으로 스프레드 미러, 지도 캔버스 톤 고정이 의도대로 (§4.1)
5. "킷 시안 변경 0" 사실 — 레이아웃·radius·폰트·간격·카피 변화 0, safe-area 오프셋 불변, **클러스터 버블·핀 실값 회귀 0** (§3)

### 불일치 (0)

없음.

### 근사 허용 (0)

해당 없음(이번 변경은 킷 실값을 그대로 옮긴 것이라 근사 항목이 발생하지 않았다).

### 미검증 (1)

- **O1** — WebView 자체 배경으로 인한 첫 프레임 흰 점멸 잔존 가능성. QA는 렌더 픽셀 관측 불가 → **디바이스 스모크 S5가 단독 권위**. 관측되면 §5 O1의 최소 수정안 적용(신규 토큰 0). (§5)

### 스모크 이월 확인 (비주얼 관련 — dev-notes §9와 동일)

| # | 항목 | 비주얼 관점 |
|---|------|------------|
| S1 | 클러스터 탭 깜박임 없음 | 원칙 4 "전이 설명" 충족 여부 |
| S2 | 300ms 체감 | 원칙 4 실기기 검증 요구 충족 |
| S5 | 지도 탭 진입 흰 여백 0 | **U5의 실제 판정 + O1 종결 조건** |
| S6 | 배너 지속시간(<300ms면 깜박임) | E5 후속 트리거 — 이번 범위 밖 |

---

## 7. 결론

**PASS.** 킷 `templates/muklog` 대비 비주얼 불일치 0건이고, `#EFEAE3`는 킷 `mk-home.jsx:336`에서 온 근거 있는 값이며 다섯 지점 실값이 전부 일치한다. 로딩 배너는 기존 카피·컴포넌트를 그대로 재사용해 신규 비주얼이 0이고, dev-notes §10의 "킷 시안 변경 0" 주장은 diff로 확인한 사실이다. 클러스터·핀 스타일 실값 회귀도 0이다.

`ui-publisher`에게 라우팅할 수정 요청은 **없다.** 유일한 열린 항목 O1은 스모크 S5 관측 결과에 종속되며, 관측 전 선제 수정은 계약 밖이므로 요청하지 않는다.
