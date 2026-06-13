# qa-report — `social-auth` (qa-inspector)

> 검증일: 2026-06-12 · 방식: 경계면 교차검증(생산자↔소비자 동시 읽기) + 킷 비주얼 충실도 + TDD/컨벤션 전수
> 재실행 결과: `npx tsc --noEmit` **exit 0** · `npx jest` **396 passed / 58 suites** (직접 재실행 확인)
> git 작업 없음 · 코드 수정 없음(발견만 보고)

---

## 0. 회귀 재실행 (종료기준 §8)

| 항목 | 결과 | 근거 |
|------|------|------|
| `npx tsc --noEmit` | ✅ exit 0 | 직접 재실행 |
| `npx jest`(전체) | ✅ 396 passed, 58 suites, 0 fail | 직접 재실행 |
| 테스트 load-bearing 표본 | ✅ 의미 있음 | AuthProvider.spec L137 provider 문자열을 'google'→'apple'로 일부러 깨자 1 failed 발생 후 복원·재확인(IDENTICAL) |

---

## 1. 인수조건별 판정

### ① AuthState 계약 정합 — ✅ 통과
- 생산자 `AuthProvider.tsx:33-38` 5상태 union ↔ 소비자 `AuthGate.tsx:21-50` switch가 5분기 모두 매핑 + `default: never`(L45-48) 빠짐없음 보장.
- `authenticated.userId:string` 소비처 전수 확인(모두 `status==='authenticated'` 가드 후 읽음, 회귀 0):
  - `AuthGate.tsx:39` `MyLogsProvider userId={state.userId}`
  - `ProfileScreen.tsx:40,49` 가드→`ProfileContent userId={state.userId}`
  - `HomeHeader.tsx:76-78` `authState.status==='authenticated' ? userId : Avatar(null)`
  - `LogScreen.tsx:122` `authState.status==='authenticated' ? authState.userId : ''`
  - `LogListScreen.tsx:146` 동일 패턴
- 기존 spec green 유지(396 passed). userId:string 계약 불변 확인.

### ② useAuth 표면 ↔ LoginScreen props 계약 — ✅ 통과
- 생산자 표면 `AuthProvider.tsx:46-58`: `state/signInWithGoogle/signInWithApple/signOut/loginError/retry` — dev-notes §2와 일치.
- AuthGate 주입(`AuthGate.tsx:27-34`): `authenticating={status==='authenticating'?provider:null}`, `loginError`, `onGoogle/onApple` ↔ LoginScreen props(`LoginScreen.tsx:18-29`) 정확히 일치.
- `showApple` 기본 `Platform.OS==='ios'`(L43) — AuthGate는 prop 생략, ui-spec §4 계약대로.
- AuthGate.spec이 6케이스로 배선 단언(provider 전달·onGoogle/onApple 호출까지).

### ③ 취소 ≠ 에러 3경로 분기 — ✅ 통과
- 취소: `runSocialSignIn`(AuthProvider.tsx:103-108) `!ok` 경로 → `unauthenticated` + `messageForAuthError` (취소 토큰은 `errors.ts:38` null 반환) → loginError=null. spec L146-160 단언(signInWithIdToken 미호출 + loginError null).
- 실패: TokenExchange `AuthProvider.tsx:114-119` → unauthenticated + 메시지. spec L177-187.
- 부트스트랩 실패: `bootstrap catch`(AuthProvider.tsx:186-190) → `error` 전체화면. spec L106-117 + retry 재부트스트랩. AuthGate error→AuthErrorView(L35-36).
- 세 경로 혼선 없음. `onAuthStateChange` 세션 null이 error로 강제 전이하지 않음(L210 주석 + spec L226-235).

### ④ 익명 제거(E8) — ✅ 통과
- `signInAnonymously` grep: **0건**(src/__mocks__/jest.setup 전수).
- E8 강등: `AuthProvider.tsx:171-175` `user.is_anonymous===true` → signOut → unauthenticated. spec L98-104(signOut 1회 + upsert 미호출) 검증.
- architecture.md §2/§3 소셜 정책으로 갱신 확인(L17 인증 테이블·L124-130 AuthGate 흐름·L172 백로그 status).

### ⑤ OAuth idToken 흐름 — ✅ 통과
- `IdTokenProvider`(AuthProvider.tsx:41-44) enum-style 상수, `signInWithIdToken({provider:IdTokenProvider[provider], token})`(L110-113).
- Google: `socialSignIn.ts:49` `response.data.idToken` → ok.token. Apple: `socialSignIn.ts:87` `credential.identityToken` → ok.token. 토큰 키 정확.
- provider 문자열 'google'/'apple' 정확(spec L137·L203이 exact 단언 — load-bearing 확인됨).

### ⑥ 비주얼 충실도(킷 mk-auth 대조) — ✅ 통과
- **AppMark**(AppMark.tsx ↔ mk-auth:8-37): viewBox 0 0 100 100 보존, 그라데이션 stops `brandGradient[0/1]`(#5B85FF→#2A55E6), 위치핀/포크 살×3/포크/스푼 ellipse+path = 킷 d 속성 그대로. rx 환산(radius/size*100, 기본 26) 정합.
- **SocialButton**(SocialButton.tsx ↔ mk-auth:118-158): 54h(L37), radius `theme.radius.control`(=14, L86), apple 무테/google `hairlineWidth + lineStrong`(L88-89), 텍스트 `variant="button"`(700/16), 로고 좌측 absolute left:20(L113·L127), AppleLogo/GoogleLogo path 그대로.
- **LoginScreen**(↔ mk-auth:85-115): 상단 그라데이션+AppMark 108 radius28+워드마크(34/🍽️23)+카피 / 하단 Apple(iOS만)·Google·약관. 간격 gap20·paddingH32·actions paddingH24 paddingBottom40 gap11 = 킷 실값.
- **SplashView**(↔ mk-auth:53-74): AppMark 120 radius32+워드마크(38/🍽️26)+태그라인+스피너 bottom54.
- raw hex: 화면 3파일 0(주석만). AppMark/SocialButton의 hex는 브랜드 고정 글리프(Apple 흰·Google 4색) + AppMark `tint` 기본 #FFFFFF — ui-spec §2/§7이 명시 허용(킷 path 고정 자산값).
- Android Apple 숨김: `showApple = Platform.OS==='ios'` 기본값 + LoginScreen.spec L33-37(Android Apple null) 검증.

### ⑦ app.json / env — ✅ 통과
- `app.json`: `ios.usesAppleSignIn:true`(L17), plugins에 `expo-apple-authentication`(L45) + google-signin `iosUrlScheme` placeholder(L49).
- env 키 일관성: `env.ts:24-31` `GOOGLE_WEB/IOS_CLIENT_ID`(required throw) ↔ `.env.example:18-19` `EXPO_PUBLIC_GOOGLE_WEB/IOS_CLIENT_ID` ↔ 사용처 `socialSignIn.ts:26-27` `GoogleSignin.configure`. 이름 정합.
- **시크릿 누출 0**: grep(apps.googleusercontent.com / 숫자-해시 client id / BEGIN PRIVATE KEY / client_secret / .p8)에서 실값 없음. placeholder(`REPLACE_WITH_REVERSED_IOS_CLIENT_ID`)·example(`your-google-*`)·테스트더미(`web-client-id`)만 존재.

### ⑧ 회귀/종료기준 — ✅ 통과
- tsc 0 / jest 396 passed 직접 재실행. 기존 화면(HomeHeader/LogScreen/LogListScreen/ProfileScreen) userId 소비 회귀 0.

### ⑨ 코드 컨벤션 — ✅ 통과
- `useCallback`/`useMemo` 실호출: 변경 파일 전수 **0건**.
- `export function` 컴포넌트/훅: 변경 파일 **0건**(모두 화살표 const).
- named-object 인자: `ensureProfileAndAuth({userId})`·`runSocialSignIn({provider,nativeResult})`·`messageForAuthError({token})`·`required(key,value)`(외부형 2-arg) — 준수.
- useEffect 명명 함수: `configureGoogleOnMount`·`bootstrapAuth`·`syncNicknameDraft` — 인라인 0.
- enum-style 상수: `AuthErrorToken`·`IdTokenProvider` `as const`. 판별 union status는 예외 허용.
- 파일명=심볼명: AppMark/SocialButton/LoginScreen/SplashView/socialSignIn/errors 일치.

### ⑩ 스코프(라이브 OAuth) — 미검증(정상)
- 아래 §2 참조. 실패 아님.

---

## 2. 미검증(키 대기 — 디바이스 스모크로 분리)

| 항목 | 사유 |
|------|------|
| Google/Apple 실제 로그인 라운드트립(idToken/identityToken→Supabase 세션) | OAuth 키 미발급 |
| Apple iOS entitlement 실동작(usesAppleSignIn) | Apple Developer 가입 + 대시보드 입력 후 |
| Android Google Play 서비스 경로 | SHA-1 등록 후 |
| `npx expo prebuild` 후 네이티브 빌드 정합 | dev client 재빌드 필요(사용자 §7-E) |

코드/모킹테스트/타입은 전부 green — 위 항목만 사용자 키 발급(plan §7 A~C) 대기. plan §8/dev-notes §8과 일치.

---

## 3. 결함

**없음.** 모든 코드/모킹 검증 가능 인수조건 통과. 발견된 차단/경계면 불일치 0건.

(참고 — 결함 아님) AppMark `tint` 기본값 `'#FFFFFF'` 및 SVG 글리프 hex는 ui-spec §2/§7이 "브랜드 고정 자산값(킷 path 그대로)"으로 명시 허용한 범위. 토큰화 대상 아님.

---

## 종료 판정

**PASS** — tsc 0 / jest 396 passed, 인수조건 30개 전부 통과(코드·모킹 범위), 결함 0. 라이브 OAuth 디바이스 검증만 키 발급 후 별도 스모크로 이월(미검증 분리, 정상). 스프린트 완료 가능.
