# ui-spec — `social-auth` (ui-publisher)

> 킷 단일 출처: `.claude/skills/ui-design/templates/muklog/mk-auth.jsx`
> 담당: 비주얼/토큰/프리미티브 골격. 데이터·OAuth 배선은 developer(useAuth 주입).
> 결과: `npm test` 369 passed · `tsc --noEmit` 0 error · 회귀 0.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `src/theme/tokens.ts` | 수정 | 인증 토큰 추가(brandGradient·authVisualGradient·lineStrong·social 색) |
| `src/theme/index.ts` | 수정 | `brandGradient`/`authVisualGradient` re-export |
| `src/theme/tokens.spec.ts` | 수정 | 인증 토큰 단언 |
| `src/components/AppMark.tsx` (+spec) | 신규 | 브랜드 마크 프리미티브(react-native-svg) |
| `src/components/SocialButton.tsx` (+spec) | 신규 | apple/google 소셜 버튼 + 로고 SVG |
| `src/components/index.ts` | 수정 | AppMark·SocialButton export |
| `src/navigation/screens/LoginScreen.tsx` (+spec) | 신규 | 로그인 화면 골격(props 계약) |
| `src/navigation/screens/SplashView.tsx` (+spec) | 수정 | 킷 SplashScreen 정합(그라데이션+마크+태그라인+스피너) |
| `src/navigation/AuthGate.spec.tsx` | 수정 | loading 단언 텍스트만 "준비 중…"→태그라인(분기 로직 불변) |
| `__mocks__/react-native-svg.js` | 수정 | Ellipse/Defs/LinearGradient/Stop mock 추가 |

---

## 2. 토큰 변경 목록 (킷 `mk-auth.jsx` / `index.html` 출처)

| 토큰 | 값 | 킷 출처 |
|------|----|---------|
| `brandGradient` (export) | `['#5B85FF', '#2A55E6']` | mk-auth:15-16 AppMark `linearGradient` stops |
| `authVisualGradient` (export) | `['#EAF0FF', '#FFFFFF']` | mk-auth:57,91 스플래시/로그인 상단 비주얼 |
| `color.lineStrong` | `rgba(112,115,124,0.52)` | mk-auth:128 `--line-strong`(ui-design 52% 보더) |
| `color.socialAppleBg` | `#000000` | mk-auth:129 apple bg |
| `color.socialAppleFg` | `#FFFFFF` | mk-auth:130 apple 텍스트/로고 |
| `color.socialGoogleBg` | `#FFFFFF` | mk-auth:129 google bg |
| `color.socialGoogleFg` | `#1F1F1F` | mk-auth:130 google 텍스트 |

- 그라데이션 stops는 배열이라 시맨틱 `color` 맵(단일 string 가정)에 넣지 않고 별도 `export const`로 분리.
- 다크 미러링: 신규 시맨틱 키는 `darkColor = {...lightColor}`로 자동 상속(소셜 버튼은 라이트/다크 공통 — 애플/구글 공식 버튼 고정색). 키 일관성 spec green.
- raw hex 0(컴포넌트는 토큰/`brandGradient`만 소비). 단 SVG 로고 글리프 색(Apple 흰·Google 4색)은 **브랜드 고정 자산값**이라 토큰화 대상 아님(킷 path 그대로, 주석 명시).

---

## 3. 킷 라인 ↔ RN 매핑

### 3.1 `AppMark` (킷 mk-auth:8-37 → `src/components/AppMark.tsx`)

| 킷 | RN |
|----|----|
| `<svg viewBox="0 0 100 100">` | `<Svg viewBox="0 0 100 100" testID="app-mark">` (좌표계 보존) |
| `linearGradient #5B85FF→#2A55E6` | `<Defs><LinearGradient><Stop brandGradient[0/1]>` |
| `<rect rx={r/size*100}>` | `<Rect testID="app-mark-bg" rx={radius/size*100, 기본 26}>` |
| 위치핀 `path` (mk-auth:21-22) | `<Path fill={tint}>` (그대로) |
| 포크/스푼 rect·path·ellipse (mk-auth:25-34) | `<Rect>×3 + <Path>×2 + <Ellipse>` fill=`brandGradient[1]`(bg) / `tint`(모노) |
| `bg=false` 모노 | `bg=false`면 Rect 미렌더 + 유틸 색 tint(킷 주석 "핀+유틸만") |

- props: `size`(96) · `radius`(px, 기본 size×0.26) · `bg`(true) · `tint`(#FFF) · `style`.

### 3.2 `SocialButton` (킷 mk-auth:118-158 → `src/components/SocialButton.tsx`)

| 킷 | RN |
|----|----|
| `height 54` | `BUTTON_HEIGHT = 54` |
| `borderRadius var(--mk-radius-btn)`=14 | `theme.radius.control` |
| apple `background #000` / google `#FFF` | `socialAppleBg` / `socialGoogleBg` |
| apple 무테 / google `1px var(--line-strong)` | `borderWidth 0` / `hairlineWidth + lineStrong` |
| `font 700 16px` | `<Text variant="button">`(700/16) |
| 로고 `position absolute; left 20` | `styles.logo {position:absolute, left:20}` |
| 텍스트 중앙 | `justifyContent:'center'` (로고는 absolute) |
| `AppleLogo`/`GoogleLogo` SVG (mk-auth:142-158) | `<Svg><Path>` 동일 d·fill |
| (킷 없음) onMouseDown scale | `Pressable pressed → opacity 0.85` 근사 |

- props: `variant`('apple'|'google') · `onPress` · `loading`(스피너+차단) · `disabled` · `style`.

### 3.3 `LoginScreen` (킷 mk-auth:85-115 → `src/navigation/screens/LoginScreen.tsx`)

| 킷 | RN |
|----|----|
| 전체 `flex column; bg` | `<SafeAreaView edges=['top','bottom']>` |
| 상단 `flex 1; center; gap 20; linear-gradient(160deg,#EAF0FF→bg 70%); pad 0 32` | `<LinearGradient authVisualGradient, locations[0,0.7], start{.2,0}→end{0,1}, paddingH 32, gap 20>` |
| `AppMark 108 + boxShadow rgba(42,85,230,.26) radius 28` | `<AppMark size={108} radius={28} style={accentShadow 근사}>` |
| 워드마크 `muklog 800/34 + 🍽️ 23 baseline gap 7` | `wordmarkRow {baseline, gap 7}` + `<Text emptyTitle fontSize 34>` + 🍽️(23) |
| 카피 `600 15.5/1.6, br` (mk-auth:99-101) | `<Text bodySm fontSize 15.5 lineHeight 25>` `'…\n…'` |
| 하단 `flex none; pad 0 24 40; gap 11` | `actions {paddingH 24, paddingBottom 40, gap 11}` |
| `SocialButton apple` (mk-auth:107) | `showApple`일 때만 렌더(기본 Platform.OS==='ios') |
| `SocialButton google` (mk-auth:108) | 항상 렌더 |
| 약관 `500 11.5/1.6, <u>…</u>` (mk-auth:109) | `<Text caption fgAssistive>` + nested `<Text underline>` |

### 3.4 `SplashView` (킷 mk-auth:53-74 → `src/navigation/screens/SplashView.tsx`)

| 킷 | RN |
|----|----|
| `linear-gradient(160deg,#EAF0FF→#FFF 60%)` | `<LinearGradient authVisualGradient, locations[0,0.6]>` |
| `AppMark 120 + boxShadow rgba(42,85,230,.28) radius 32` | `<AppMark size={120} radius={32} style={accentShadow}>` |
| 워드마크 `muklog 800/38 + 🍽️ 26 gap 8` | `<Text display fontSize 38>` + 🍽️(26) |
| 태그라인 `600 15` "둘이 함께 쌓는 맛집 지도" | `<Text bodySm fontSize 15>` |
| `Spinner` (position absolute bottom 54) | `<ActivityIndicator testID="splash-spinner" bottom 54>` |

---

## 4. props 계약 (→ developer)

### `LoginScreen` — `AuthGate`가 `unauthenticated`/`authenticating`에서 렌더(plan §3.4)

```ts
type LoginScreenProps = {
  authenticating: 'google' | 'apple' | null; // useAuth().state: status==='authenticating' → state.provider, 아니면 null
  loginError: string | null;                 // useAuth().loginError (취소 시 null — 메시지 X)
  onGoogle: () => void;                       // useAuth().signInWithGoogle
  onApple: () => void;                        // useAuth().signInWithApple (iOS 전용)
  showApple?: boolean;                        // 기본 Platform.OS==='ios'. 보통 생략(기본값 사용)
};
```

- **developer 배선 예시**: `authenticating={state.status === 'authenticating' ? state.provider : null}`.
- `authenticating !== null`이면 LoginScreen이 **두 버튼 모두 disabled** + 해당 버튼 스피너(중복 탭 방지, E10) — 추가 작업 불필요.
- `loginError`만 넘기면 버튼 영역 위에 error 컬러 인라인 텍스트 자동 표시. 취소 시 `loginError=null`로 넘기면 메시지 미표시(E1).

### `AppMark`

```ts
type AppMarkProps = { size?: number; radius?: number; bg?: boolean; tint?: string; style?: ViewStyle };
```
- 헤더/빈상태 등 차후 재사용 가능. 데이터 없음(순수 프리미티브).

### `SocialButton`

```ts
type SocialButtonProps = {
  variant: 'apple' | 'google'; onPress: () => void;
  loading?: boolean; disabled?: boolean; style?: ViewStyle;
};
```
- `onPress`는 **탭 신호만** — developer가 useAuth 메서드 주입. loading/disabled로 상태 표현.

---

## 5. RN 미재현 / 근사 항목 (사유)

| 킷 | RN 처리 | 사유 |
|----|---------|------|
| `box-shadow: 0 14~16px 34~40px rgba(42,85,230,.26~.28)` (컬러 그림자) | `shadowColor=accentShadow` + offset 근사. iOS는 컬러 충실, **Android는 elevation(회색)만** | RN Android는 컬러 그림자 미지원(스킬 §변환 규칙) |
| `linear-gradient(160deg, …)` | `expo-linear-gradient` start{.2,0}→end{0,1} + locations | RN은 각도 직접 지정 불가 — 세로 위주 근사 |
| `animation: mkPop/mkFade`(진입 모션), `mkSpin`(Spinner 회전) | 정적 + `ActivityIndicator` | 진입 모션은 비주얼 충실도 핵심 아님(스킬 §5 근사 허용). 로딩 표시는 ActivityIndicator로 충분 |
| 약관 `<u>` 링크 | `textDecorationLine underline`(비활성 placeholder) | 링크 라우팅은 out-of-scope(plan §2) |
| 버튼 `onMouseDown scale(.985)` | `Pressable pressed opacity 0.85` | 웹 hover/press → RN press 상태 표준 매핑 |

---

## 6. 비주얼 충실도 self-check (ui-publishing §5)

- [x] raw hex 0 (컴포넌트는 토큰/`brandGradient`만; SVG 글리프는 브랜드 고정 자산값, 주석 명시).
- [x] radius=control(14, 소셜 버튼), AppMark radius props 경유.
- [x] google 보더 = lineStrong(헤어라인 폭), apple 무테 — 킷 정합.
- [x] 워드마크/카피/태그라인 폰트 크기 킷 실값(34/15.5 · 38/15).
- [x] 레이아웃 간격(gap 20/22/11, padding 0 32 / 0 24 40, 로고 left 20, 스피너 bottom 54) 킷 실값.
- [x] 음식 이모지 🍽️ 허용(muklog 웜 변형 — 킷이 기준).
- [x] testID: `app-mark`/`app-mark-bg`/`social-button-spinner`/`login-visual-gradient`/`splash-gradient`/`splash-spinner` — QA 대조용.

---

## 7. QA 대조 포인트 (qa-inspector §9-11 "킷 충실도")

- LoginScreen ↔ mk-auth:85-115: AppMark 108 + 워드마크 + 카피 / Apple(검정)·Google(흰+보더) 54h / 약관.
- Apple 버튼 iOS 전용: `showApple` 기본 `Platform.OS==='ios'` (Android 비노출 — E5). developer는 보통 prop 생략.
- 토큰만(raw hex 0): §2 표 + tokens.spec green.
- SplashView ↔ mk-auth:53-74: 마크 120 + 태그라인 + 스피너. AuthGate loading 단언이 태그라인으로 갱신됨(분기 불변).
