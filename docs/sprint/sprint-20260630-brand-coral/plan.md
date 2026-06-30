# Sprint: brand-coral (2026-06-30)

## 단일 기능
ui-design 킷 2026-06-30 델타 **§1 — 블루 → 코럴 「먹 핀」 브랜드 전환**. 앱 아이콘·스플래시·인앱 브랜드 마크·로그인 상단 비주얼을 코럴 톤으로 전환한다.

> 출처: `.claude/skills/ui-design/templates/muklog/HANDOFF-2026-06-30.md §1`, 새 에셋 `.claude/skills/ui-design/assets/muklog-app-icon.png`·`muklog-app-icon-ios.png`·`muklog-splash.png`.
> 선행 스프린트: `sprint-20260612-brand-assets`(에셋 도입), `sprint-20260615-splash-login-wordmark`(스플래시/로그인 워드마크).

## 핵심 제약 (사용자 결정)
- **인앱 액센트색 `--mk-accent`/`theme.color.primary`(#3366FF 블루)는 유지.** 코럴 전환은 **브랜드 마크·스플래시·로그인 상단 비주얼·온보딩 한정**. 버튼·칩·강조 등 인앱 인터랙션 색은 블루 그대로. (코럴 통일은 미정)
- **git 작업 금지.** 커밋은 사용자 전담.
- 네이티브 변경(아이콘·스플래시·app.json)이라 **OTA 불가 → dev build 재빌드 필수**.

## 스코프 (해야 할 것)
1. **에셋 교체** — 킷 3종을 프로젝트 `assets/`로 복사·덮어쓰기:
   - `muklog-app-icon.png` (1024², Android/adaptive·범용 icon)
   - `muklog-app-icon-ios.png` (1024², iOS 풀블리드)
   - `muklog-splash.png` (1242×2688, 워드마크+태그라인 구운 풀 스플래시)
   - 구 블루 `muklog-splash.png`는 새 코럴본으로 덮어써짐(별도 미사용 정리 불필요 — 동명 교체).
2. **app.json 배선**
   - `android.adaptiveIcon.backgroundColor` `#4775F0` → 코럴(아이콘 스퀘어클 하단톤 `#FF4D6D` 계열, 정확값 ui-publisher 확정).
   - `expo-splash-screen` 플러그인: **옵션 A** — 풀 이미지 `muklog-splash.png`를 스플래시로. `resizeMode: "cover"` + `backgroundColor` 웜(`#FFF1EC`)으로 변경. (현재는 app-icon을 imageWidth 200 contain으로 중앙배치 → 풀 이미지로 전환. 기기별 비율은 cover로 흡수, qa-visual이 safe-area 확인.)
3. **브랜드 토큰 (`src/theme/tokens.ts`)** — 블루 브랜드값을 코럴로 repoint(이름 유지, raw hex 회피 원칙대로 palette에 코럴 추가):
   - `brandBlueTop/Bottom`(#5B85FF→#2A55E6) → 코럴 그라데이션 `#FF7E63 → #FF4D6D` (킷 180deg). `brandGradient` 소비처(AppMark)에 반영. **토큰명은 브랜드-중립으로 정리 권장**(예 `brandGradTop/Bottom`) — 단 변경 시 소비처 동기화.
   - `authGradTop/Bottom`(#EAF0FF→#FFF) → 웜 `#FFF1EC → #FFFFFF` (킷 스플래시/로그인 상단 비주얼).
   - `splashBg`(#EBF1FF) → `#FFF1EC`.
   - 브랜드 마크 그림자 `accentShadow`(rgba(51,102,255,.30))는 **인앱 버튼 그림자와 의미가 겹침** → 브랜드 마크 전용 코럴 그림자 토큰 신설(`brandShadow: rgba(255,77,109,.26)`). 기존 `accentShadow`(블루)는 인앱 primary 버튼용으로 보존.
   - 스플래시 스피너색: 킷 `#FF5A4D` → 전용 토큰(`splashSpinner`) 신설(인앱 `primary` 블루와 분리).
   - "먹" 글자색 토큰: 킷 `#FF5566`(AppMark 글자) — `brandMarkGlyph` 등.
4. **`AppMark.tsx` 재작도** — 포크/스푼 제거, 「먹 핀」으로:
   - 배경 스퀘어클: 코럴 그라데이션 `#FF7E63→#FF4D6D`(180deg=세로), **radius = 변의 22.5%**(현 DEFAULT_RX 26 → 22.5).
   - 위치핀(흰 `#FFFFFF`) path(viewBox 0 0 100 100): `M50 14C34 14 23 25.5 23 40C23 57 44 72 48.2 82a2 2 0 0 0 3.6 0C56 72 77 57 77 40C77 25.5 66 14 50 14Z`
   - "먹" 글자: `react-native-svg` `<Text>`, 중앙 `(x=50, y=39.5)`, anchor=middle, baseline=central, fontFamily=Wanted Sans(브랜드 = `theme.font.brand`/SUIT 대응), weight 900, fontSize 27, letterSpacing -0.5, fill `#FF5566`.
   - `bg=false` 모노 모드: 스퀘어클 없이 핀+글자만(배경 투명) — 기존 prop 계약 유지.
   - `size`/`radius`/`tint`/`bg`/`style` props **계약 불변**(소비처 SplashView·LoginScreen·EmptyState·헤더 깨지지 않게).
5. **`SplashView.tsx`** — 웜 그라데이션(authVisualGradient 웜본) + AppMark 코럴 그림자(brandShadow) + 스피너 코럴(splashSpinner).
   - ⚠️ **태그라인 결정 필요**(아래 OPEN). 현재 "둘이 함께 쌓는 맛집 지도" vs 새 에셋 베이크값 "함께 다닌 맛집, 한 곳에".
6. **`LoginScreen.tsx`** — 상단 비주얼 그라데이션 웜톤(authVisualGradient) + 마크 그림자 코럴. 소셜 버튼·인앱 액센트는 불변.

## 명시적 비스코프 (이번 스프린트 아님)
- 카테고리 이모지/배지 텍스트화(§2 = S2), 빈 상태 홈(§3 = S3), 전면 카피 보이스 개정(§4 = S4), 멤버 5명(§5 = S5).
- **인앱 액센트 코럴 통일**(미정).
- 전 화면 카피 변경 — 단 스플래시 태그라인만 아래 결정에 따라 예외 가능.

## OPEN — ui-publisher가 확정 제안, 미해결 시 리더가 사용자 확인
- **O1. 인앱 SplashView 태그라인:** 네이티브 스플래시 PNG는 "함께 다닌 맛집, 한 곳에"가 구워져 있음. 인앱 SplashView가 옛 "둘이 함께 쌓는 맛집 지도"면 네이티브→인앱 전환 시 카피 불일치로 어색. **제안: 인앱 SplashView 태그라인을 "함께 다닌 맛집, 한 곳에"로 정합**(브랜드 스플래시 경험 일관성, §4 전면 카피와 별개의 최소 변경). 그 외 모든 화면 카피는 S4로 유지.
- **O2. 토큰 리네이밍 범위:** `brandBlue*`→`brandGrad*` 등 블루 함의 토큰명 정리 여부. 동작 동일하므로 ui-publisher 재량(소비처 동기화 + tsc 통과 조건).

## 인수조건 (테스트 케이스 — TDD)
- AC1. `AppMark`가 코럴 그라데이션 스퀘어클 + 흰 핀 + "먹" 글자를 렌더하고 포크/스푼 요소는 없다. (`AppMark.spec.tsx` 갱신: 글자 존재·포크 rect 부재·radius 22.5% 환산값)
- AC2. `bg=false`에서 배경 rect 미렌더, 핀+글자만. (기존 모노 계약 유지)
- AC3. `tokens` — `brandGradient`가 코럴 2색, `authVisualGradient`가 웜 2색, `splashBg`가 `#FFF1EC`, 브랜드 그림자/스피너 전용 토큰이 코럴, **`theme.color.primary`는 `#3366FF` 불변**. (`tokens.spec.ts` 갱신)
- AC4. `SplashView`가 웜 그라데이션·코럴 스피너를 사용한다(`splash-gradient`·`splash-spinner` testID 색 검증). 태그라인은 O1 결정값.
- AC5. `app.json` — adaptiveIcon backgroundColor 코럴, splash 플러그인이 풀 스플래시 이미지+웜 배경, icon 경로 3종 유효.
- AC6. 에셋 3종이 `assets/`에 존재하고 1024²/1242×2688 차원. 구 블루 마크 잔존 안 함.
- AC7. `npm test` 전체 통과 + `npx tsc --noEmit` 0 에러. 기존 소비처(EmptyState·헤더 등 AppMark 사용처) 회귀 없음.

## 완료 기준
- AC1~7 충족 + qa-report-visual(킷 시안 충실도) PASS + qa-report-logic(정합성·TDD·회귀) PASS.
- **dev build 실기기에서 런처 아이콘·네이티브 스플래시·인앱 스플래시·로그인 코럴 확인** (네이티브라 OTA 불가 — 사용자 빌드 단계).

## 데이터 계약
- DB·RPC·Edge Function **변경 없음**. 순수 에셋·토큰·프리젠테이션 변경.
