# 스프린트 plan — `social-auth`

> 날짜: 2026-06-12 · 단일 기능 · TDD 기본 · git 작업 금지(사용자 전담)
> 설계 단일 출처: `docs/design/architecture.md` (본 스프린트에서 §2/§3/§5 갱신)
> 디자인 단일 출처(킷): `.claude/skills/ui-design/templates/muklog/mk-auth.jsx`
> 역할 경계: planner=무엇을(본 문서) / ui-publisher=어떻게 보이는가(로고·스플래시·로그인 화면) / developer=어떻게 동작하는가(상태머신·소셜 배선) / qa=경계면 정합성

---

## 1. 기능 한줄 정의

앱 진입 시 자동 익명 세션을 폐기하고, **명시적 로그인 화면 → Google/Apple 소셜 로그인 전용**으로 인증/가입을 전환한다. (Google·Apple **둘 다 코드/UI 구현**, OAuth 키 미발급 상태이므로 라이브 디바이스 검증은 키 발급 후로 이월)

---

## 2. 범위 (Scope)

### In-scope
- `AuthProvider` 상태머신 재설계: `loading | unauthenticated | authenticating | authenticated | error`
- 로그인 화면(`LoginScreen`) + 인앱 로고 마크(`AppMark`) + 스플래시 비주얼 — 킷 `mk-auth.jsx` 번역(ui-publisher)
- Google 네이티브 로그인 배선(`@react-native-google-signin/google-signin` → `signInWithIdToken`)
- Apple 네이티브 로그인 배선(`expo-apple-authentication` → `signInWithIdToken`), **iOS에서만 버튼 노출**(Android 숨김)
- 로그인 후 `profiles` 본인 행 보장 → `authenticated` 전이(기존 FK 무결성 패턴 유지)
- 세션 영속(재실행 시 로그인 유지) — 기존 AsyncStorage persistSession 그대로
- **로그아웃**: `signOut` → `unauthenticated` 복귀. 진입점 = Profile 화면(아래 §4.3 결정)
- 익명 로그인 코드 잔재 제거(`signInAnonymously` 호출 삭제)
- `app.json` 플러그인/설정(URL scheme, expo-apple-authentication, google-signin plugin)
- 의존성 추가
- **사용자 수동 셋업 가이드**(§7) — OAuth 키 발급/대시보드 설정/앱 주입 위치
- TDD: 모킹 단위테스트 + tsc 통과

### Out-of-scope
- 라이브 디바이스 OAuth 검증(키 발급 후 별도 스모크 — §8 종료 기준에서 미검증으로 분리)
- 이메일/비밀번호·매직링크·카카오 로그인(소셜 2종만)
- 계정 연동/병합, 기존 익명 데이터 마이그레이션(dev 단계 — 데이터 보존 의무 없음, §6)
- 회원 탈퇴(delete account), 프로필 최초 설정 온보딩
- 약관/개인정보 처리방침 실제 문서·링크(문구만 표기, 링크는 비활성 placeholder)

---

## 3. 데이터 / 상태 계약 (developer ↔ 소비자)

### 3.1 AuthState 타입 (신규)

```ts
export type AuthState =
  | { status: 'loading' }                          // 부트스트랩(getSession) 진행 중
  | { status: 'unauthenticated' }                  // 세션 없음 → LoginScreen 노출
  | { status: 'authenticating'; provider: 'google' | 'apple' }  // 소셜 로그인 진행 중(버튼 로딩)
  | { status: 'authenticated'; userId: string }    // ★ userId: string 계약 보존(회귀 0)
  | { status: 'error'; message: string };          // 부트스트랩/프로필 보장 실패(재시도 가능)
```

- **`authenticated.userId: string` 계약은 절대 불변** — `MyLogsProvider`, `ProfileScreen`, `LogScreen`, `LogListScreen`, `HomeHeader`가 모두 `status === 'authenticated'`일 때 `state.userId`를 소비(grep 확인). 새 상태 추가는 이 분기를 깨지 않으므로 회귀 없음.
- **OAuth 취소는 error가 아니다.** `authenticating` → 사용자 취소 → `unauthenticated`로 복귀(에러 토스트 없음).
- **OAuth 실패(네트워크/토큰)는 error가 아니라 인라인 메시지로 `unauthenticated` 복귀** + LoginScreen에 일시 오류 문구 표시(전체 error 화면 전환 X). → 단 부트스트랩 자체 실패(`getSession` throw)는 `error`(전체 화면 + 재시도).
  > 결정: `error` 상태는 "앱이 못 뜨는" 부트스트랩 실패 전용. 로그인 시도 실패는 LoginScreen 내부 인라인(`loginError: string | null`)으로 처리해 사용자가 즉시 재시도 가능하게 한다.

### 3.2 useAuth 표면 변화

```ts
type AuthContextValue = {
  state: AuthState;
  signInWithGoogle: () => Promise<void>;   // 신규
  signInWithApple: () => Promise<void>;    // 신규 (iOS 전용 호출, Android에선 버튼 비노출)
  signOut: () => Promise<void>;            // 신규
  loginError: string | null;              // 신규: 로그인 시도 실패 인라인 메시지(취소 시 null 유지)
  retry: () => void;                       // 보존: error 상태 재시도(부트스트랩 재실행)
};
```

- `signInWithGoogle/Apple`: 호출 시 `authenticating` 전이 → 성공 시 `signInWithIdToken` → `ensureProfileAndAuth` → `authenticated`. 취소 시 `unauthenticated` + `loginError=null`. 실패 시 `unauthenticated` + `loginError=메시지`.
- `signOut`: `supabase.auth.signOut()` → `onAuthStateChange(SIGNED_OUT)` 또는 직접 `unauthenticated` 전이. `profileEnsuredRef` 초기화(다음 로그인 시 재보장).

### 3.3 에러 토큰 (enum-style 상수, 컨벤션)

```ts
export const AuthErrorToken = {
  GoogleCancelled: 'GoogleCancelled',     // 취소 → loginError=null(메시지 X)
  AppleCancelled: 'AppleCancelled',       // 취소 → loginError=null
  NetworkFailed: 'NetworkFailed',
  TokenExchangeFailed: 'TokenExchangeFailed',  // signInWithIdToken 실패
  NoIdToken: 'NoIdToken',                  // SDK가 idToken을 반환 안 함
  PlayServicesUnavailable: 'PlayServicesUnavailable',  // Google(Android) Play 서비스 없음
} as const;

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  NetworkFailed: '네트워크 연결을 확인해 주세요.',
  TokenExchangeFailed: '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
  NoIdToken: '로그인 정보를 받지 못했어요. 다시 시도해 주세요.',
  PlayServicesUnavailable: 'Google Play 서비스를 사용할 수 없어요.',
};
```

- 취소 토큰(`*Cancelled`)은 메시지 매핑 없음 → `loginError=null`(검증 가능: 취소 후 `loginError`가 null).

### 3.4 AuthGate 분기 매핑 (신규)

| state.status | 렌더 |
|--------------|------|
| `loading` | `SplashView` (기존) |
| `unauthenticated` | **`LoginScreen`** (신규) |
| `authenticating` | **`LoginScreen`**(해당 provider 버튼 로딩 상태) — 별도 화면 전환 없이 동일 화면에서 버튼 스피너 |
| `authenticated` | `MyLogsProvider + NavigationContainer + AppNavigator` (기존) |
| `error` | `AuthErrorView(message, onRetry=retry)` (기존) |

- `authenticating`을 `LoginScreen`으로 매핑하는 이유: 화면 점멸 방지 + 버튼 인라인 로딩이 킷 UX와 일치. LoginScreen이 `state`(authenticating provider)와 `loginError`를 props/context로 받아 버튼 disabled/loading 처리.
- exhaustive `switch`의 `default: never` 패턴 유지(새 status 누락 시 컴파일 에러).

### 3.5 Supabase 호출 계약

- Google: `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
- Apple: `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })`
- `supabase.ts`는 변경 없음(persistSession/autoRefreshToken/detectSessionInUrl:false 유지). 익명 전용 코드가 없으므로 클라 설정은 그대로 재사용.

---

## 4. 화면 / UX

### 4.1 LoginScreen (신규 — 킷 `mk-auth.jsx` LoginScreen 번역, ui-publisher)
- 상단 비주얼: `AppMark`(블루 스퀘어클 로고) + `muklog 🍽️` 워드마크 + 카피("데이트하며 다닌 맛집을 사진·메모·위치로 둘이 함께 기록해요.")
- 하단 버튼 영역: **Apple 버튼(검정, iOS만)** + **Google 버튼(흰+헤어라인 보더)** + 약관 문구(밑줄, 비활성 링크)
- 버튼 높이 54, radius=control(10px), 좌측 절대배치 로고 + 중앙 텍스트(킷 SocialButton 구조)
- **Android**: Apple 버튼 비노출(`Platform.OS === 'ios'`일 때만 렌더) — 표준 동작
- `authenticating` 시 해당 버튼 로딩 스피너 + 두 버튼 모두 disabled(중복 탭 방지)
- `loginError` 존재 시 버튼 영역 위/아래 인라인 에러 텍스트(error 컬러)

### 4.2 SplashView (기존 보강 — 선택)
- 현재 `SplashView`(인디케이터 + "준비 중…") 유지. 킷 SplashScreen의 로고 비주얼은 ui-publisher 재량으로 `AppMark` 도입 가능하나 **기능 범위 밖(선택)** — 최소 기준은 기존 유지.

### 4.3 로그아웃 진입점 — 결정
- **Profile 화면 설정 리스트에 "로그아웃" 행 추가**(현재 `SETTINGS_ROWS` 4행은 비활성 placeholder). 로그아웃 행은 **활성**으로 추가하되, 위치는 리스트 최하단 별도 행(파괴적 액션 톤 — fgWeak/error 계열).
  > 결정 근거: 소셜 로그인 전환의 핵심 인수조건(로그아웃→unauthenticated 복귀)을 검증 가능한 UI 동선으로 노출해야 함. Profile은 이미 `useAuth()` 소비 중이라 `signOut` 배선 비용 최소.
- 탭 → 확인(간단 `Alert` 또는 `Sheet` 확인) → `signOut()` → AuthGate가 `unauthenticated` → LoginScreen.

---

## 5. 작업 목록 (모듈 단위, 체크박스 + 인수조건)

> 각 작업의 인수조건은 **검증 가능한 테스트 케이스**로 기술. SDK/네이티브 모듈은 `jest.mock`.

### ① 로고/스플래시/로그인 UI  (담당: ui-publisher · 의존: 없음 · 테스트: render)
- [ ] `AppMark` RN 컴포넌트(킷 SVG → `react-native-svg` 번역): blue 스퀘어클 + 위치핀 + 포크/스푼. `size`/`bg`/`tint` props.
  - 인수조건: `<AppMark size={108} />` 렌더 시 크래시 없이 svg 트리 생성(testID로 존재 확인).
- [ ] `LoginScreen` 컴포넌트(킷 LoginScreen 충실 재현). props: `{ authenticating: 'google'|'apple'|null, loginError: string|null, onGoogle, onApple }`.
  - 인수조건(iOS): Apple·Google 버튼 2개 모두 렌더("Apple로 계속하기"/"Google로 계속하기").
  - 인수조건(Android): Apple 버튼 비노출, Google 버튼만 렌더.
  - 인수조건: `onGoogle`/`onApple` 탭 → 콜백 1회 호출.
  - 인수조건: `authenticating='google'` → Google 버튼 로딩 + 두 버튼 disabled(탭해도 콜백 미호출).
  - 인수조건: `loginError='...'` → 해당 메시지 텍스트 표시.
- [ ] 토큰 정합: raw hex 0(테마 토큰만), radius=control, 헤어라인 보더 — ui-publishing 체크리스트 준수.

### ② AuthProvider 리팩터 — 상태머신 + 소셜 메서드  (담당: developer · 의존: ⑧ · 테스트: renderHook + supabase 모킹)
- [ ] AuthState 5상태로 교체(§3.1). 부트스트랩: `getSession()` 있으면 `ensureProfileAndAuth`→`authenticated`, **없으면 `unauthenticated`**(익명 발급 제거).
  - 인수조건: 세션 없음 → 부트스트랩 후 `unauthenticated`(자동 익명 발급 호출 0 — `signInAnonymously` 미호출).
  - 인수조건: 세션 있음 → `profiles` upsert 후 `authenticated`(userId 복원).
  - 인수조건: `getSession` throw → `error`(message 전달), `retry()` → 다시 `loading`→부트스트랩.
- [ ] `signInWithGoogle`/`signInWithApple`: `authenticating` 전이 → idToken 획득(모킹) → `signInWithIdToken` → `ensureProfileAndAuth` → `authenticated`.
  - 인수조건(성공): Google 성공 경로 → `authenticated`, `profiles.upsert` 1회 호출, userId 세팅.
  - 인수조건(취소): SDK가 취소 throw(SIGN_IN_CANCELLED/ERR_REQUEST_CANCELED) → `unauthenticated`, `loginError=null`, `signInWithIdToken` 미호출.
  - 인수조건(실패): `signInWithIdToken` 에러 반환 → `unauthenticated`, `loginError=TokenExchangeFailed 메시지`.
  - 인수조건(NoIdToken): SDK가 idToken 없이 반환 → `unauthenticated`, `loginError=NoIdToken 메시지`, supabase 미호출.
- [ ] `signOut`: `supabase.auth.signOut()` → `unauthenticated`, `profileEnsuredRef` 리셋.
  - 인수조건: `signOut()` → `unauthenticated`, 이후 재로그인 시 `profiles.upsert` 다시 호출(가드 리셋 확인).
- [ ] `onAuthStateChange` 구독 유지: `SIGNED_OUT`/세션 null → `unauthenticated`(error 강제 전이 금지, 기존 주석 정신 유지).
- [ ] `ensureProfileAndAuth` 재사용(기존 upsert ignoreDuplicates 패턴 그대로 — FK 무결성).

### ③ Google 네이티브 배선  (담당: developer · 의존: ②⑦⑧ · 테스트: 모킹 단위)
- [ ] `GoogleSignin.configure({ webClientId, iosClientId })`(앱 부팅 시 1회) + `signIn()` → `idToken` 추출 헬퍼(`signInWithGoogleNative()` 분리 모듈).
  - 인수조건: 헬퍼가 `{ idToken }` 반환(모킹). Play 서비스 없음 → `PlayServicesUnavailable` 토큰.
  - 인수조건: 취소 statusCode → cancelled 신호 반환(상위에서 `unauthenticated`).
- [ ] `webClientId`/`iosClientId`는 env(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `..._IOS_CLIENT_ID`)에서 주입 — `src/lib/env.ts`에 추가(누락 throw). **시크릿 아님(public 클라이언트 ID)** → EXPO_PUBLIC_ 허용.

### ④ Apple 네이티브 배선  (담당: developer · 의존: ②⑦⑧ · 테스트: 모킹 단위)
- [ ] `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })` → `identityToken` 추출 헬퍼(`signInWithAppleNative()`).
  - 인수조건: 헬퍼가 `{ identityToken }` 반환(모킹). 취소(`ERR_REQUEST_CANCELED`) → cancelled 신호.
  - 인수조건: identityToken null → `NoIdToken`.
- [ ] iOS 전용 가드: `Platform.OS !== 'ios'`면 호출 자체 차단(버튼은 ①에서 숨김, 메서드는 방어적 no-op/early return).

### ⑤ AuthGate 분기 추가  (담당: developer · 의존: ①② · 테스트: 상태별 render + 모킹)
- [ ] `unauthenticated`/`authenticating` → `LoginScreen` 매핑(§3.4). `default: never` 유지.
  - 인수조건: `unauthenticated` → LoginScreen 렌더(소셜 버튼 노출).
  - 인수조건: `authenticating={provider}` → LoginScreen + 해당 버튼 로딩.
  - 인수조건: `authenticated` → AppNavigator + MyLogsProvider(userId 주입) — **기존 spec 회귀 0**.
  - 인수조건: `loading`/`error` → 기존 SplashView/AuthErrorView(회귀 0).
- [ ] 기존 `AuthGate.spec.tsx` 갱신(3분기 → 5분기) + `useAuth` 모킹에 신규 메서드 stub 추가.

### ⑥ 로그아웃  (담당: developer(배선) + ui-publisher(행 비주얼) · 의존: ②⑤ · 테스트: render + 모킹)
- [ ] ProfileScreen 설정 리스트에 "로그아웃" 활성 행 추가 → 확인 → `signOut()`.
  - 인수조건: "로그아웃" 행 탭 → 확인 → `signOut` 1회 호출.
  - 인수조건: `signOut` 후 AuthGate가 `unauthenticated`로 LoginScreen 전환(통합은 ⑤ + ② 조합, 단위는 signOut 호출까지).

### ⑦ app.json 플러그인/설정  (담당: developer · 의존: ⑧ · 테스트: tsc/스모크 — 설정 파일)
- [ ] `expo-apple-authentication` 플러그인 추가 + iOS `usesAppleSignIn: true`(또는 entitlement).
- [ ] `@react-native-google-signin/google-signin` config plugin 추가 + **iOS URL scheme(역도메인 = iOS 클라이언트 ID의 reversed)** 등록. scheme은 §7-D 값 주입 후 채움(placeholder/주석으로 위치 명시).
- [ ] 익명 인증 관련 설정 잔재 없음 확인(클라엔 없음 — 대시보드 토글은 §7-C 사용자 작업).
  - 인수조건: `app.json` 파싱 유효 + `npx expo config` 에러 없음(스모크, 키 placeholder여도 파싱 OK).

### ⑧ 의존성 추가  (담당: developer · 의존: 없음 · 테스트: 설치/import)
- [ ] `@react-native-google-signin/google-signin`
- [ ] `expo-apple-authentication`
- [ ] `react-native-svg`(AppMark용 — 미설치 시. 설치 여부 먼저 확인)
- [ ] jest 모킹 설정: 위 네이티브 모듈 `jest.mock`(글로벌 mock 또는 spec별). `jest.setup`/`__mocks__` 위치 정합.
  - 인수조건: `npm test` 시 네이티브 모듈 import로 인한 크래시 없음(모킹 적용).

### ⑨ architecture.md 갱신  (담당: planner — 본 스프린트에서 즉시 수행 · §9 참조)

---

## 6. 엣지케이스

| # | 케이스 | 기대 동작 | 검증 |
|---|--------|----------|------|
| E1 | OAuth 취소(Google/Apple) | error 아님 — `unauthenticated` 복귀, `loginError=null` | ② 단위 |
| E2 | 네트워크 실패(로그인 중) | `unauthenticated` + `loginError=NetworkFailed 메시지`(전체 error 화면 X) | ② 단위 |
| E3 | `signInWithIdToken` 실패(토큰 거부) | `unauthenticated` + `TokenExchangeFailed` 메시지 | ② 단위 |
| E4 | SDK가 idToken 미반환 | `unauthenticated` + `NoIdToken`, supabase 미호출 | ② 단위 |
| E5 | Apple on Android | 버튼 비노출(①), 메서드 호출 시 early return | ①④ 단위 |
| E6 | Google Play 서비스 없음(Android) | `PlayServicesUnavailable` 메시지 | ③ 단위 |
| E7 | 토큰 만료/갱신 | `autoRefreshToken=true`가 자동 갱신, `onAuthStateChange(TOKEN_REFRESHED)`는 `authenticated` 유지(error 강제 전이 금지) | ② 단위 |
| E8 | 기존 익명 세션 잔존(dev 단계) | 마이그레이션 불필요. 익명 세션이 AsyncStorage에 남아있으면 `getSession()`이 그 세션으로 `authenticated`가 될 수 있음 → **위험**. ⟶ 결정: 익명 세션은 `user.is_anonymous`로 구분되므로, 부트스트랩에서 `session.user.is_anonymous === true`면 **익명 세션 폐기(signOut) → unauthenticated**로 강등(잔재 제거). 또는 사용자에게 "로그아웃 후 재로그인" 안내. dev 단계라 데이터 보존 의무 없음. | ② 단위(is_anonymous 분기) |
| E9 | profiles FK 무결성(소셜 uid) | 소셜 로그인 후 `auth.users.id`(소셜 uid)로 `profiles` 행 upsert 보장 후 authenticated — 기존 ensureProfileAndAuth 그대로 동작(uid 출처만 다름) | ② 단위 |
| E10 | 빈/중복 탭(authenticating 중 재탭) | 두 버튼 disabled로 차단(①), 중복 `signInWithIdToken` 0 | ① 단위 |
| E11 | 로그아웃 직후 동일 기기 재로그인 | `profileEnsuredRef` 리셋으로 upsert 재실행(무해 — ignoreDuplicates) | ② 단위 |
| E12 | 부트스트랩 `getSession` throw | `error` 전체 화면 + 재시도(로그인 시도 실패와 구분) | ② 단위 |

> **E8 결정이 핵심**: 익명 잔재는 단순 코드 삭제로 끝나지 않음 — AsyncStorage에 남은 익명 세션을 부트스트랩에서 적극 강등해야 "익명 제거"가 관찰적으로 보장된다.

---

## 7. 사용자 수동 작업 체크리스트 (최우선 — 사용자가 직접 수행)

> ⚠️ 에이전트는 키 발급/대시보드 설정을 수행하지 않는다. **아래는 사용자 전담.** 시크릿 값 자체는 문서에 적지 말고 "키 이름/위치"만 채운다.

### (A) Google Cloud Console
- [ ] 프로젝트 선택/생성 → **OAuth 동의 화면** 구성(앱 이름·지원 이메일·범위 email/profile).
- [ ] **OAuth 클라이언트 ID 3종** 생성:
  - **Web client** (Supabase가 idToken 검증 시 audience로 사용 → `webClientId`에 들어감, 가장 중요)
  - **iOS client** (bundle ID `com.muklog.app`)
  - **Android client** (package `com.muklog.app` + **SHA-1 지문** 필요 — 디버그/릴리스 키스토어 각각)
- [ ] iOS client 생성 시 발급되는 **reversed client ID(역도메인)** 확보 → app.json URL scheme에 사용.

### (B) Apple Developer ($99/년 — 미가입 시 보류)
- [ ] **App ID**(`com.muklog.app`)에 **Sign in with Apple** capability 활성화.
- [ ] **Services ID** 생성(웹 인증 흐름용 식별자).
- [ ] **Sign in with Apple Key(.p8)** 생성 → **Key ID** + **Team ID** 확보(다운로드는 1회뿐, 안전 보관).
- [ ] **Return URL** = Supabase 콜백(`https://<project-ref>.supabase.co/auth/v1/callback`) 등록.

### (C) Supabase 대시보드 (Authentication)
- [ ] **Google 프로바이더 활성화** → Client ID/Secret(Web) 입력.
- [ ] **Apple 프로바이더 활성화** → Services ID + Team ID + Key ID + .p8 입력.
- [ ] **Authorized Client IDs**(네이티브 idToken 검증용)에 등록:
  - Google: iOS client ID, Android client ID, Web client ID
  - Apple: iOS **bundle ID**(`com.muklog.app`) + Services ID
- [ ] **익명 로그인 비활성화**(Authentication → Providers/Settings의 Anonymous sign-ins OFF) — ★ 정책 전환의 핵심.

### (D) 앱에 넣을 값 (어디에)
- [ ] **Google Web client ID** → `.env`의 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (→ `src/lib/env.ts`에서 읽음, `GoogleSignin.configure({ webClientId })`).
- [ ] **Google iOS client ID** → `.env`의 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (→ `GoogleSignin.configure({ iosClientId })`).
- [ ] **iOS reversed client ID(역도메인 URL scheme)** → `app.json`의 google-signin plugin `iosUrlScheme` (또는 iOS `infoPlist.CFBundleURLTypes`). app.json은 빌드 시점 값이라 .env 아님 — **app.json에 직접 입력**.
- [ ] `.env.example`에 위 EXPO_PUBLIC_ 키 이름 추가(값 없이 키만).
- [ ] Apple은 코드/플러그인은 이번에 들어가나 **(B) 키 발급 후 (C) 대시보드 입력 시 활성화** — 그 전까지 iOS 버튼은 뜨지만 실제 로그인은 실패(미검증).

### (E) 네이티브 리빌드
- [ ] 네이티브 모듈(google-signin/apple-auth) + app.json scheme 변경 → **`npx expo prebuild --clean` 후 dev client 재빌드** 필요(JS-only 핫리로드로는 반영 안 됨).
- [ ] iOS: Xcode에서 Signing & Capabilities에 **Sign in with Apple** capability 확인.

---

## 8. 종료 기준 (Definition of Done)

- [ ] `npm test` **전체 통과**(신규/갱신 spec 포함, 기존 회귀 0 — 특히 AuthGate authenticated/userId 계약).
- [ ] `npx tsc --noEmit` **통과**(AuthState 5상태 exhaustive, useAuth 표면 타입 정합).
- [ ] 코드 완성: AuthProvider 상태머신·Google/Apple 배선·LoginScreen/AppMark·AuthGate 분기·로그아웃·app.json·의존성·env.
- [ ] 익명 코드 잔재 0(`signInAnonymously` grep 0 + E8 강등 로직 존재).
- [ ] §7 사용자 수동 셋업 가이드 문서화 완료.
- [ ] **라이브 OAuth 디바이스 검증은 미검증으로 분리** — 사용자 키 발급(§7 A~C) 완료 후 디바이스 스모크에서 검증(별도). dev-notes/qa-report에 "OAuth 라이브 미검증(키 대기)" 명시.

---

## 9. QA가 교차검증할 경계면 목록 (qa-inspector)

1. **AuthState ↔ AuthGate**: 5상태 모두 화면 매핑 존재 + `default: never` 컴파일 보장. unauthenticated/authenticating→LoginScreen.
2. **authenticated.userId 계약 보존**: `MyLogsProvider`/`ProfileScreen`/`LogScreen`/`LogListScreen`/`HomeHeader`가 `status==='authenticated'`에서 `state.userId: string` 소비 — 회귀 0(기존 spec green).
3. **useAuth 표면**: `signInWithGoogle/Apple/signOut/loginError/retry` 노출 + 모든 소비처(LoginScreen, ProfileScreen) 배선 일치.
4. **취소 vs 실패 경로**: 취소→`unauthenticated`+`loginError=null`(에러 화면 X) / 실패→`unauthenticated`+메시지 / 부트스트랩 실패→`error` 전체 화면. 세 경로 혼선 없는지.
5. **익명 잔재**: `signInAnonymously` 호출 0 + 부트스트랩 `is_anonymous` 강등(E8) 동작.
6. **네이티브 모듈 모킹**: google-signin/apple-auth `jest.mock` 적용 — `npm test`가 네이티브 import로 안 깨지는지.
7. **idToken 계약**: Google `idToken`/Apple `identityToken` → `signInWithIdToken({provider, token})` 정확한 provider 문자열('google'/'apple') 매핑.
8. **Platform 분기**: Apple 버튼/메서드가 iOS 전용(Android 비노출 + early return).
9. **profiles FK**: 소셜 uid로 ensureProfileAndAuth 호출 → upsert 1회(ignoreDuplicates) 후 authenticated.
10. **로그아웃 라운드트립**: signOut → unauthenticated → 재로그인 시 profileEnsuredRef 리셋으로 upsert 재실행.
11. **킷 충실도(ui-publisher)**: LoginScreen이 `mk-auth.jsx` 레이아웃(AppMark+워드마크+카피 / Apple검정·Google흰 버튼 54h / 약관문구) + 토큰만(raw hex 0) 재현.
12. **app.json/env 위치 정합**: webClientId/iosClientId=env, iosUrlScheme=app.json — 혼선 없는지 + .env.example 키 추가.

---

## 10. 비용 가드레일 체크

- [x] **AWS 미사용** — Supabase Auth(무료 티어) + 클라 네이티브 SDK만. 추가 백엔드 0.
- [x] OAuth는 Supabase 내장 Auth로 처리 — Edge Function/추가 인프라 불필요.
- [x] 네이티브 SDK는 클라 측 — 서버 호출/쿼터 비용 없음(로그인 시 idToken 검증 1회만).
- [x] 이미지/Kakao/Storage 관련 없음(본 기능 무관) — 해당 가드레일 N/A.
- [x] **익명 사용자 누적 방지 부수효과**: 익명 자동 발급 제거로 "유령 익명 계정" 무한 증식이 멈춤 → Auth 사용자 수 절감(부수 비용 이득).

---

## 11. 의존성 / 이전 스프린트 관계

- `brand-assets`(직전, 2026-06-12): 인앱 로고 마크를 미뤘음 → **본 스프린트에서 `AppMark` 도입**(킷 mk-auth.jsx 출처).
- `multi-log-home`/`log-invite`: `useAuth().state.userId` 소비 흐름 확정 → **userId 계약 보존이 회귀 방지 핵심**.
- `profile`: ProfileScreen 설정 리스트 → 로그아웃 행 추가 지점.
- **선행 차단 없음** — 코드/테스트는 키 없이 완성 가능(모킹). 라이브만 §7 대기.
