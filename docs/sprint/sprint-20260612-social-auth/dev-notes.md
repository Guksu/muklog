# dev-notes — `social-auth` (developer)

> 데이터·로직·배선. 비주얼/토큰/프리미티브는 ui-publisher 산출물(ui-spec.md)에 props 주입만.
> 결과: `npm test` **396 passed (58 suites)** · `npx tsc --noEmit` **0 error** · `npx expo config` **exit 0(파싱 OK)**.
> 익명 인증 제거 + Google/Apple 소셜 로그인 배선 완료. **라이브 OAuth 디바이스 검증은 미검증(키 발급 대기)** — §라이브 미검증 참조.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `src/features/auth/AuthProvider.tsx` | **재작성** | 5상태 머신 + signInWithGoogle/Apple/signOut + loginError + E8 익명강등 + configure 1회 |
| `src/features/auth/socialSignIn.ts` (+spec) | 신규 | google-signin/apple-auth 래퍼 → 판별 union(NativeSignInResult) |
| `src/features/auth/errors.ts` | 신규 | AuthErrorToken(enum-style) + AUTH_ERROR_MESSAGES + messageForAuthError(취소→null) |
| `src/features/auth/AuthProvider.spec.tsx` | 신규 | 부트스트랩 4분기 + Google/Apple 성공·취소·NoIdToken·실패 + signOut + onAuthStateChange |
| `src/features/auth/index.ts` | 수정 | errors 표면 re-export |
| `src/navigation/AuthGate.tsx` | 수정 | 3분기→5분기(unauthenticated/authenticating→LoginScreen), exhaustive never 유지 |
| `src/navigation/AuthGate.spec.tsx` | 수정 | 5분기 + useAuth 신규 메서드 stub + LoginScreen 배선 단언 |
| `src/navigation/screens/ProfileScreen.tsx` | 수정 | 설정 리스트 하단 "로그아웃" 행 → Alert 확인 → signOut |
| `src/navigation/screens/ProfileScreen.spec.tsx` | 수정 | 로그아웃 행 표시 + Alert 확인→signOut 호출 |
| `src/lib/env.ts` | 수정 | GOOGLE_WEB_CLIENT_ID / GOOGLE_IOS_CLIENT_ID 키 추가(누락 throw) |
| `jest.setup.ts` | 수정 | Google env 더미 주입(throw 회피) |
| `__mocks__/@react-native-google-signin/google-signin.js` | 신규 | 글로벌 모킹(배럴 import 크래시 방지) |
| `__mocks__/expo-apple-authentication.js` | 신규 | 글로벌 모킹 |
| `app.json` | 수정 | iOS usesAppleSignIn + expo-apple-authentication plugin + google-signin iosUrlScheme(placeholder) |
| `.env.example` | 수정 | EXPO_PUBLIC_GOOGLE_WEB/IOS_CLIENT_ID 키 추가 |
| `package.json` | 수정(expo install) | google-signin / expo-apple-authentication 의존성 |

---

## 2. AuthState / useAuth 최종 표면 (계약)

```ts
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticating'; provider: 'google' | 'apple' }
  | { status: 'authenticated'; userId: string }   // ★ userId:string 계약 보존(회귀 0)
  | { status: 'error'; message: string };

type AuthContextValue = {
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  loginError: string | null;   // 취소 시 null, 실패 시 인라인 메시지
  retry: () => void;           // 부트스트랩 재실행(error 전용)
};
```

**취소 ≠ 에러 (plan §3.1 — 세 경로 분리):**
- OAuth 취소 → `unauthenticated` + `loginError=null`(전체 error 화면 없음).
- OAuth 실패(NoIdToken/TokenExchange/Network/PlayServices) → `unauthenticated` + `loginError=메시지`.
- 부트스트랩 실패(getSession throw) → `error`(전체화면 AuthErrorView + retry).

---

## 3. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 생산자 | 계약(shape) | 소비자 | 비고 |
|--------|------------|--------|------|
| `AuthProvider.state` | AuthState 5상태 | `AuthGate` (switch 5분기 + `default: never`) | loading→Splash / unauth·authing→LoginScreen / error→AuthErrorView / authenticated→MyLogsProvider+AppNavigator |
| `AuthProvider.{loginError, signInWithGoogle, signInWithApple}` | `string\|null` / `()=>Promise<void>` | `AuthGate` → `LoginScreen` props | `authenticating={status==='authenticating'?provider:null}`, `onGoogle/onApple`, `loginError` |
| `AuthProvider.signOut` | `()=>Promise<void>` | `ProfileScreen`(ProfileContent) | 설정 하단 로그아웃 행 → Alert 확인 → signOut |
| `AuthProvider.state.userId`(authenticated) | `string` | `MyLogsProvider`/`useProfile`/`HomeHeader`/`LogScreen`/`LogListScreen`/`ProfileScreen` | **계약 보존 — 기존 spec green(396 passed)** |
| `socialSignIn.signInWithGoogleNative()` | `{ok:true,token}\|{ok:false,cancelled,token:AuthErrorToken}` | `AuthProvider.runSocialSignIn` | idToken → `signInWithIdToken({provider:'google',token})` |
| `socialSignIn.signInWithAppleNative()` | 동일 union(iOS 전용, Android early return) | `AuthProvider.runSocialSignIn` | identityToken → `signInWithIdToken({provider:'apple',token})` |
| `supabase.auth.signInWithIdToken` | `{data:{user},error}` | AuthProvider | error\|!user → `unauthenticated`+TokenExchangeFailed |
| `supabase.auth.onAuthStateChange` | session→userId | AuthProvider | userId → ensureProfileAndAuth→authenticated. 세션 null → 강제 전이 X(error 금지) |
| `profiles.upsert({id})` onConflict id, ignoreDuplicates | FK 무결성 | ensureProfileAndAuth | profileEnsuredRef 가드(1회), signOut 시 리셋(재로그인 재실행) |

---

## 4. 추가 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@react-native-google-signin/google-signin` | ^16.1.2 | Google 네이티브 로그인 → idToken (v16: `signIn()`이 `{type:'success'\|'cancelled'}` 반환) |
| `expo-apple-authentication` | ~7.1.3 | Apple 로그인(iOS) → identityToken (취소는 `ERR_REQUEST_CANCELED` throw) |

> `react-native-svg`는 이미 설치돼 있어 추가 불필요(AppMark는 ui-publisher가 기존 버전 사용).
> `expo install`이 google-signin config plugin을 app.json plugins에 자동 추가 → array 형태로 iosUrlScheme 보강.

---

## 5. app.json 변경

```jsonc
ios.usesAppleSignIn: true                           // Apple Sign-In entitlement
plugins += "expo-apple-authentication"
plugins += ["@react-native-google-signin/google-signin",
            { "iosUrlScheme": "com.googleusercontent.apps.REPLACE_WITH_REVERSED_IOS_CLIENT_ID" }]
```

- `iosUrlScheme` 값은 **placeholder** — 사용자가 iOS reversed client ID로 교체(§사용자 체크리스트 D).
- `npx expo config` exit 0 (파싱/플러그인 해석 OK, placeholder여도 통과).

---

## 6. env 키 이름 / 주입 위치 (시크릿 값 없음 — 이름·위치만)

| env 키(.env / .env.example) | 읽는 곳 | 주입 대상 | 종류 |
|------------------------------|---------|-----------|------|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `src/lib/env.ts` → `env.GOOGLE_WEB_CLIENT_ID` | `GoogleSignin.configure({ webClientId })` (socialSignIn.ts) | public 클라이언트 ID(시크릿 아님) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `src/lib/env.ts` → `env.GOOGLE_IOS_CLIENT_ID` | `GoogleSignin.configure({ iosClientId })` | public 클라이언트 ID |

> Apple은 env 키 불필요(identityToken은 네이티브 SDK가 직접 반환, Supabase 대시보드에서 검증).
> iOS **reversed** client ID는 .env 아님 → **app.json iosUrlScheme**(빌드 시점 값).

---

## 7. 사용자 수동 작업 체크리스트 (실제 코드에 맞춰 구체화 — 시크릿 값 없이 위치만)

> ⚠️ 에이전트는 키 발급/대시보드 설정을 수행하지 않음. 아래 전부 **사용자 전담**.

### (A) Google Cloud Console
- [ ] OAuth 동의 화면 구성(email/profile 범위).
- [ ] OAuth 클라이언트 ID 3종 생성:
  - **Web client** → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`에 들어감(가장 중요, Supabase audience).
  - **iOS client**(bundle `com.muklog.app`) → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + reversed ID는 app.json.
  - **Android client**(package `com.muklog.app` + 디버그/릴리스 **SHA-1** 각각).
- [ ] iOS client의 **reversed client ID** 확보.

### (B) Apple Developer ($99/년 — 미가입 시 보류)
- [ ] App ID(`com.muklog.app`)에 Sign in with Apple capability 활성화.
- [ ] Services ID 생성, Sign in with Apple Key(.p8) → Key ID + Team ID 확보.
- [ ] Return URL = `https://<project-ref>.supabase.co/auth/v1/callback` 등록.

### (C) Supabase 대시보드 (Authentication)
- [ ] **Google 프로바이더 활성화** → Web Client ID/Secret 입력.
- [ ] **Apple 프로바이더 활성화** → Services ID + Team ID + Key ID + .p8.
- [ ] **Authorized Client IDs** 등록:
  - Google: iOS / Android / **Web** client ID 전부(네이티브 idToken 검증).
  - Apple: iOS **bundle ID**(`com.muklog.app`) + Services ID.
- [ ] **Anonymous sign-ins OFF** (Authentication → Providers/Settings) — ★ 정책 전환 핵심(코드의 E8 강등과 짝).

### (D) 앱에 값 넣기 (정확한 위치)
- [ ] `.env`에 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = Google **Web** client ID.
- [ ] `.env`에 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` = Google **iOS** client ID.
- [ ] `app.json` → plugins의 `@react-native-google-signin/google-signin` → `iosUrlScheme`:
      현재 `com.googleusercontent.apps.REPLACE_WITH_REVERSED_IOS_CLIENT_ID` → **iOS reversed client ID**로 교체.
- [ ] (`.env.example`에 키 이름 이미 추가됨 — 값만 .env에 채우면 됨)

### (E) 네이티브 리빌드 (JS 핫리로드로 반영 안 됨)
- [ ] `npx expo prebuild --clean` 후 dev client 재빌드.
- [ ] iOS: Xcode Signing & Capabilities에 **Sign in with Apple** 확인.

---

## 8. 라이브 미검증 항목 (DoD §8 — 키 발급 후 디바이스 스모크로 별도 검증)

- **Google/Apple 실제 로그인 라운드트립**(idToken/identityToken → Supabase 세션 발급) — OAuth 키 미발급으로 디바이스 미검증.
- **Apple iOS entitlement 실동작**(usesAppleSignIn) — Apple Developer 가입($99) + (B)(C) 완료 후.
- **Android Google Play 서비스 경로**(SHA-1 등록 후).
- 코드/모킹 단위테스트/타입은 전부 green — 위 항목만 키 발급(§7 A~C) 대기.

---

## 9. ui-publisher에게 (비주얼 위임 — 직접 만들지 않음)

- **로그아웃 행**: ui-publisher가 별도 프리미티브를 제공하지 않아, ProfileScreen에 **최소 행**(surface 카드 + error 컬러 텍스트, 토큰만 사용)으로 임시 구현. 킷에 로그아웃 행 디자인이 있으면 비주얼 정합을 요청드림(현재 아이콘 없이 중앙 텍스트 — 파괴적 톤). 데이터 배선(Alert 확인→signOut)은 완료.
- 그 외 LoginScreen/AppMark/SocialButton/SplashView는 ui-spec.md props 계약 그대로 주입만 함(비주얼 무변경).

---

## 10. 종료 기준 대조 (DoD §8)

- [x] `npm test` 전체 통과 — 396 passed / 58 suites (기존 369 + 신규 27).
- [x] `npx tsc --noEmit` 통과 — 0 error(5상태 exhaustive, useAuth 표면 정합).
- [x] 코드 완성 — AuthProvider 상태머신/Google·Apple 배선/AuthGate 5분기/로그아웃/app.json/의존성/env.
- [x] 익명 잔재 0 — `signInAnonymously` grep 0 + E8 is_anonymous 강등 로직 존재.
- [x] §7 사용자 수동 셋업 가이드 문서화(본 문서 §7).
- [ ] 라이브 OAuth 디바이스 검증 — **미검증(키 대기)**, §8 분리 명시.
