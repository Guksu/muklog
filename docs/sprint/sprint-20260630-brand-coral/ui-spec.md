# UI Spec — brand-coral (2026-06-30)

블루 → 코럴 「먹 핀」 브랜드 전환. 디자인 단일 출처 = `.claude/skills/ui-design/templates/muklog/HANDOFF-2026-06-30.md §1` + 킷 원본 `mk-auth.jsx`.
**범위:** 브랜드 마크·스플래시·로그인 상단 비주얼·아이콘/스플래시 에셋·토큰 한정. **인앱 액센트(블루 `#3366FF`)는 불변.**

## OPEN 처리 결과
- **O1 (스플래시 태그라인):** 제안대로 **"함께 다닌 맛집, 한 곳에"** 채택. 네이티브 스플래시 PNG 베이크값(킷 mk-auth:54) 정합 → 네이티브→인앱 전환 시 카피 일관. 그 외 화면 카피는 S4로 유지(LoginScreen 카피 손대지 않음).
- **O2 (토큰 리네이밍):** **수행함.** `brandBlueTop/Bottom` → `brandGradTop/Bottom`(블루 함의 제거). 소비처는 `brandGradient` export 1곳뿐이라 동기화 단순. tsc 0 에러 확인.

## 킷 라인 ↔ RN 파일:라인 매핑

| 킷(mk-auth.jsx) | 대응 RN | 매핑 |
|---|---|---|
| :8-26 `AppMark` | `src/components/AppMark.tsx` | 코럴 스퀘어클 rect + 흰 핀 path + "먹" 글자 |
| :13-16 그라데이션 180deg #FF7E63→#FF4D6D | `tokens.ts` `brandGradient` → `Defs/LinearGradient x1=0 y1=0 x2=0 y2=1`(세로=180deg) | 토큰 경유 |
| :18 `rx="22.5"` | `AppMark` `DEFAULT_RX_RATIO=0.225` → `rx = 22.5`(viewBox 좌표) | 변의 22.5% |
| :20 핀 path | `AppMark` `PIN_PATH`(verbatim) | viewBox 0 0 100 100 보존 |
| :22-23 "먹" text x50 y39.5 anchor middle baseline central weight900 size27 ls-0.5 fill#FF5566 | `AppMark` RN `<Text>` 오버레이(근사 — 아래 리스크 참조) + `brandMarkGlyph` 토큰 | 중앙 절대배치 |
| :41-69 `SplashScreen` | `src/navigation/screens/SplashView.tsx` | 웜 그라데이션 + AppMark120 + 워드마크 + 태그라인 + 스피너 |
| :45 `linear-gradient(160deg,#FFF1EC 0%,#FFFFFF 62%)` | `authVisualGradient` + `GRADIENT_LOCATIONS=[0,0.62]` | 160deg 대각 근사 |
| :48 `boxShadow rgba(255,77,109,.26)` | AppMark style `shadowColor: brandShadow` | iOS 충실/Android elevation 근사 |
| :54 태그라인 | `SPLASH_TAGLINE = '함께 다닌 맛집, 한 곳에'` | O1 |
| :66 spinner borderTopColor #FF5A4D | `ActivityIndicator color: splashSpinner` | primary 블루와 분리 |
| :72-101 `LoginScreen` | `src/navigation/screens/LoginScreen.tsx` | 상단 비주얼 그라데이션 + 마크 그림자만 코럴화(버튼/카피 불변) |
| :78 `linear-gradient(160deg,#FFF1EC 0%,bg 72%)` | `authVisualGradient` + `GRADIENT_LOCATIONS=[0,0.72]` | |
| :80 `boxShadow rgba(255,77,109,.24)` | AppMark style `shadowColor: brandShadow` | |

## 토큰 매핑표 (`src/theme/tokens.ts`)

| 토큰 | 이전(블루) | 변경(코럴) | 출처 |
|---|---|---|---|
| `palette.brandGradTop/Bottom` (구 `brandBlue*`) | #5B85FF / #2A55E6 | **#FF7E63 / #FF4D6D** | mk-auth:14-15 |
| `palette.brandMarkGlyph` (신설) | — | **#FF5566** | mk-auth:23 |
| `palette.authGradTop/Bottom` | #EAF0FF / #FFF | **#FFF1EC / #FFFFFF** | mk-auth:45,78 |
| `palette.splashBg` | #EBF1FF | **#FFF1EC** | mk-auth:45 |
| `palette.brandShadow` (신설) | — | **rgba(255,77,109,0.26)** | mk-auth:48,80 |
| `palette.splashSpinner` (신설) | — | **#FF5A4D** | mk-auth:66 |
| `color.brandShadow/splashSpinner/brandMarkGlyph` | — | 신설(라이트/다크 공통, darkColor 스프레드 미러) | |
| `brandGradient` export | [#5B85FF,#2A55E6] | **[#FF7E63,#FF4D6D]** | |
| `authVisualGradient` export | [#EAF0FF,#FFFFFF] | **[#FFF1EC,#FFFFFF]** | |

**불변(브랜드 코럴 전환에서 절대 안 건드림):** `primary`(#3366FF), `accentStrong`(#1F4FE0), `primaryWeak`(#EAF0FF), `accentShadow`(rgba(51,102,255,.30) — 인앱 버튼 전용), `heroGradient`(빈 홈 §3=S3 비스코프라 블루 유지), `ring`. `expo-notifications` plugin color #3366FF(app.json) 유지.

## AppMark props 계약 (불변)
```
size?: number     // 한 변 px, 기본 96
radius?: number   // 코너 반경 px, 미지정 시 size×0.225
bg?: boolean      // 코럴 스퀘어클 배경, 기본 true. false=모노(핀+글자만)
tint?: string     // bg=true 핀색 / bg=false 마크 전체색, 기본 #FFFFFF
style?: ViewStyle // 컨테이너 View에 적용(소비처 컬러 그림자 등)
```
소비처(SplashView size120 radius32 / LoginScreen size108 radius28) 모두 `bg=true`. `bg=false` 모노 모드는 계약 보존(현재 앱 내 소비처 없음, EmptyState/헤더 AppMark 사용처 없음 — grep 확인).

## RN 미재현/근사 항목 + 사유
1. **"먹" 글자 — react-native-svg `<Text>` 대신 RN `<Text>` 오버레이 근사.**
   - 사유 (2중): (1) HANDOFF §1 자체가 "react-native-svg 한글 텍스트 렌더 = 기기·폰트 의존, 안 보일 위험"을 경고. (2) jest-expo 환경에서 `react-native-svg`의 `Text`/`TSpan` export가 `undefined`로 해소돼(probe 확인: `Path`는 function, `Text`는 undefined) SVG `<Text>`는 테스트 자체가 불가.
   - 근사: `Svg`(스퀘어클+핀) 위에 절대배치 RN `<Text>`로 "먹"을 겹침. 중앙(viewBox x50/y39.5 → left 50%·top 39.5%), fontSize=size×0.27, fontFamily=SUIT-Bold(weight 900 대응), letterSpacing -0.5, `allowFontScaling=false`·`includeFontPadding=false`로 위치 안정화. 폰트 미로드 시 시스템 폰트 폴백(형태·위치 유지). **시각 결과는 킷과 동일(핀 머리 중앙 코럴 "먹")**, 구현 수단만 다름.
2. **컬러 그림자(brandShadow) — iOS 충실 / Android elevation 근사.** RN Android는 컬러 shadow를 지원 안 해 `elevation`(검정 그레이 그림자)로 근사. 컨테이너 View에 `borderRadius`(= 마크 반경)를 줘 둥근 사각 그림자로 떨어지게 함.
3. **그라데이션 각도** — 킷 SVG 마크는 180deg(세로), 화면 배경은 160deg(대각). AppMark는 `x2=0 y2=1`(정확히 세로), 화면 배경은 expo-linear-gradient start/end로 160° 근사(기존 패턴 유지).
4. **네이티브 스플래시(app.json)** — 옵션 A 풀 이미지: `image: muklog-splash.png`, `resizeMode: cover`, `backgroundColor: #FFF1EC`(imageWidth 제거). 기기별 비율은 cover로 흡수 → qa-visual이 safe-area(상하 크롭) 실기기 확인 필요.

## 변경 파일
- `src/theme/tokens.ts` — brandGrad* 리네이밍 + 코럴 repoint + brandShadow/splashSpinner/brandMarkGlyph 신설
- `src/theme/tokens.spec.ts` — 코럴 기대값 갱신(brandGradient/authVisual/splashBg + 신규 토큰 + primary 블루 불변 단언)
- `src/components/AppMark.tsx` — 「먹 핀」 재작도(포크/스푼 제거, 핀+"먹")
- `src/components/AppMark.spec.tsx` — 글자 존재·포크 부재·rx 22.5% 단언
- `src/navigation/screens/SplashView.tsx` + `.spec.tsx` — brandShadow·splashSpinner·태그라인(O1)
- `src/navigation/screens/LoginScreen.tsx` — brandShadow·웜 그라데이션 locations(카피 불변)
- `src/navigation/AuthGate.spec.tsx` — SplashView 태그라인 회귀 단언 갱신
- `app.json` — adaptiveIcon #FF4D6D, splash 옵션 A 풀 이미지+#FFF1EC
- `assets/` — muklog-app-icon.png / -ios.png / -splash.png (리더가 코럴본 복사 완료, 차원 1024²·1242×2688 확인)

## 인수조건 결과
AC1~AC7 충족. `npm test` 1399 passed / `npx tsc --noEmit` 0 에러. 기존 AppMark 소비처(Splash·Login) 회귀 없음.
