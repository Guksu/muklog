# Dev Notes — 프로젝트 기반 셋업 (setup)

> 구현자: developer · 입력: `plan.md`, `docs/design/architecture.md`, `references/wanted-tokens.md`
> 스택: Expo SDK 52 (RN 0.76.9, New Architecture) + TypeScript · Supabase JS · React Navigation 7
> 검증 도구 결과: `npx tsc --noEmit` ✅ 통과 · `npx expo export --platform ios` ✅ 번들 성공(953 모듈, 폰트 4종 포함) · `npx expo install --check` ✅ Dependencies up to date

---

## 1. 구현한 파일 (모듈별)

### A. 프로젝트 설정 / 스캐폴딩 (T1·T2·T3)
| 파일 | 내용 |
|------|------|
| `package.json` | Expo ~52, RN 0.76.9, React 18.3.1. 의존성: @supabase/supabase-js, @react-native-async-storage/async-storage, react-native-url-polyfill, @react-navigation/{native,native-stack,bottom-tabs}, react-native-{screens,safe-area-context,gesture-handler}, expo-{font,splash-screen,status-bar,dev-client,asset}. scripts: `start`(--dev-client), `typecheck`. |
| `app.json` | dev-client/font/splash-screen/asset config plugin, `newArchEnabled`, scheme `muklog`, bundleId `com.muklog.app`. |
| `tsconfig.json` | `expo/tsconfig.base` 확장, `strict`, path alias `@/* → src/*`. |
| `babel.config.js` | `babel-preset-expo`. |
| `index.ts` | gesture-handler import + `registerRootComponent(App)`. |
| `.gitignore` | node_modules, `.expo`, `dist`, **`.env`/`.env.local`/`.env.*.local` (시크릿 커밋 차단 — 블랭킷 `.env.*`가 아니라 `.env.example`은 추적 유지)**, ios/android 등. |
| `.env.example` | 두 키 + 설명(아래 §3.1). |
| `src/{lib,theme,features/auth,components,navigation/screens}`, `supabase/{migrations,functions}` | 폴더 구조. 빈 디렉터리는 `.gitkeep`(supabase/*, src/features). |
| `assets/fonts/*.ttf` + `README.md` | Pretendard 4 weight 정적 ttf 배치(아래 §폰트). |

### B. Supabase 클라이언트 + env 가드 (T4·T5)
| 파일 | export | 내용 |
|------|--------|------|
| `src/lib/env.ts` | `env` | `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` 검증. 누락/빈문자열 시 **누락 키명 포함 에러로 throw**(조용한 통과 금지). |
| `src/lib/supabase.ts` | `supabase` | `react-native-url-polyfill/auto` + AsyncStorage 스토리지. auth: `persistSession:true, autoRefreshToken:true, detectSessionInUrl:false`. |

### C. 테마 (T7·T8·T9)
| 파일 | export | 내용 |
|------|--------|------|
| `src/theme/tokens.ts` | `themes, spacing, radius, shadow, typography, Theme, ColorToken, TypographyVariant` | **wanted-tokens.md §2 값 1:1 이식**(palette/light·darkColor/spacing/radius/shadow/typography). `type Theme = typeof themes.light`. 보조 타입 `ColorToken`/`TypographyVariant` 추가(컴포넌트 prop용, 값 변경 아님). |
| `src/theme/ThemeProvider.tsx` | `ThemeProvider, useTheme` | light 고정 주입. `useTheme()`는 Provider 밖 호출 시 throw. (`themes[scheme] as Theme` — light/dark가 `as const`로 리터럴 타입이 달라 정규화 캐스팅) |
| `src/theme/fonts.ts` | `fontMap` | expo-font 등록 맵. 키 = typography fontFamily 문자열(B4). |
| `src/theme/index.ts` | (재export) | 공개 표면. |

### D. 익명 세션 부트스트랩 (T6)
| 파일 | export | 내용 |
|------|--------|------|
| `src/features/auth/AuthProvider.tsx` | `AuthProvider, useAuth, AuthState` | getSession→없으면 signInAnonymously→`authenticated`+userId / 실패시 `error`. `onAuthStateChange` 구독, unmount 시 `unsubscribe()`. `retry()` 제공(error 화면 재시도). **profiles upsert는 TODO 주석으로만**(profile 스프린트). |
| `src/features/auth/index.ts` | (재export) | 공개 표면. |

### E. 공용 컴포넌트 (T10)
| 파일 | export | 내용 |
|------|--------|------|
| `src/components/Text.tsx` | `Text` | `variant`(typography 키, 기본 body) + `color`(ColorToken, 기본 fg). `useTheme()`만 사용. |
| `src/components/Button.tsx` | `Button` | `variant`(primary/secondary) + `loading`/`disabled`(opacity 0.5 + ActivityIndicator). 토큰 color/radius/spacing만. |
| `src/components/Screen.tsx` | `Screen` | SafeAreaView + `color.bg` 배경 + `spacing[20]` 패딩, `center` prop. |
| `src/components/index.ts` | (재export) | 공개 표면. |

### F. 네비게이션 (T11)
| 파일 | export | 내용 |
|------|--------|------|
| `src/navigation/routes.ts` | `Routes, AppStackParamList, RoomTabParamList` | 라우트 이름 상수(오타 차단) + 타입드 파라미터 목록. |
| `src/navigation/devFlags.ts` | `DEV_NAV` | ⚠️ **임시** Onboarding↔RoomTabs 토글(멤버십 로직 부재 대체). invite-room에서 제거. |
| `src/navigation/screens/SplashView.tsx` | `SplashView` | 로딩 인디케이터 + "준비 중…". |
| `src/navigation/screens/AuthErrorView.tsx` | `AuthErrorView` | 에러 메시지 + "다시 시도" 버튼(`onRetry`). |
| `src/navigation/screens/OnboardingScreen.tsx` | `OnboardingScreen` | placeholder. "방 만들기/초대코드 입력"(TODO alert) + dev 토글 버튼(→RoomTabs). |
| `src/navigation/screens/MuklogTabScreen.tsx` | `MuklogTabScreen` | placeholder "먹로그가 여기 표시됩니다" + dev 토글(→Onboarding). |
| `src/navigation/screens/MapTabScreen.tsx` | `MapTabScreen` | placeholder "지도가 여기 표시됩니다". |
| `src/navigation/RoomTabs.tsx` | `RoomTabs` | bottom-tabs, **`initialRouteName=MuklogTab`(디폴트=먹로그)**, 탭 스타일 토큰 적용. |
| `src/navigation/AppNavigator.tsx` | `AppNavigator` | native-stack. initialRoute = `DEV_NAV.initial`(임시). Onboarding / RoomTabs. |
| `src/navigation/AuthGate.tsx` | `AuthGate` | `useAuth().state` 3분기: loading→Splash / error→AuthError / authenticated→`NavigationContainer`+AppNavigator. `never` exhaustive 체크로 분기 누락 컴파일 차단. |
| `src/navigation/index.ts` | (재export) | 공개 표면. |

### 루트
| 파일 | 내용 |
|------|------|
| `App.tsx` | 폰트 로드(`Font.loadAsync(fontMap)`, 8s 타임아웃 + 실패 시 시스템폰트 fallback) → SplashScreen hide. 프로바이더 트리: GestureHandlerRootView → SafeAreaProvider → ThemeProvider(light) → AuthProvider → StatusBar + AuthGate. |

---

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증용, plan §7 B1~B7)

| # | 생산자 (파일:심볼) | 소비자 (파일:사용) | 계약 / 확인 결과 |
|---|--------------------|--------------------|------------------|
| **B1** | `.env.example` / `process.env.EXPO_PUBLIC_SUPABASE_URL`·`_ANON_KEY` → `src/lib/env.ts:env` | `src/lib/supabase.ts` (`env.SUPABASE_URL`, `env.SUPABASE_ANON_KEY`) | 키명 정확 일치. 누락 시 `env.ts`가 누락 키명 포함 throw. ✅ (런타임 throw — 번들엔 영향 없음) |
| **B2** | `AuthProvider:AuthState` = `{loading}` \| `{authenticated, userId}` \| `{error, message}` | `AuthGate.tsx` switch | 3 status 모두 화면 매핑 + `default`에 `never` exhaustive 가드. ✅ |
| **B3** | `tokens.ts` 시맨틱 별칭(`color.*`, `typography.*` 등) | `Text`/`Button`/`Screen`/모든 screens | raw hex/rgb 0건(grep: `src` 내 tokens.ts 제외 0건). `useTheme()`만 사용. ✅ |
| **B4** | `tokens.ts:typography.*.fontFamily` 문자열(`Pretendard-Regular/Medium/SemiBold/Bold`) | `theme/fonts.ts:fontMap` 키 → `App.tsx:Font.loadAsync` | 4개 패밀리명 철자 1:1 일치. ttf 파일명도 동일. ✅ |
| **B5** | `routes.ts:Routes` / 네비게이터 `name` | `navigation()` 호출부(Onboarding·Muklog dev 버튼), `RoomTabs.initialRouteName=MuklogTab` | 등록 라우트명 == navigate 인자(타입드). 기본 탭=Muklog. ✅ |
| **B6** | `ThemeProvider` 주입(App.tsx 트리) | `useTheme()` 호출부(전 컴포넌트) | Provider 트리 내 호출만. 밖 호출 시 throw. AuthGate의 Splash/Error도 ThemeProvider 안(App.tsx 순서). ✅ |
| **B7** | `wanted-tokens.md §2` 원본 값 | `tokens.ts` 이식값 | palette hex·spacing·radius·shadow·typography 1:1(복사). **추가**: `ColorToken`/`TypographyVariant` 타입 export(값 아님, 컴포넌트 타입 보조). ⚠️ QA 확인 요망(값 변경 아님). |

---

## 3. 설정 계약 상세

### 3.1 환경변수 (`.env.example`)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
- `EXPO_PUBLIC_` 프리픽스 필수. anon 키 공개 OK(RLS가 보안). Kakao 키 없음(이번 범위 외).
- 실제 `.env`는 `.gitignore`로 커밋 차단. **현재 저장소에 `.env` 없음** → 앱을 실기로 띄우려면 사용자가 `.env`를 만들어야 함(없으면 env.ts가 의도대로 throw).

### 3.2 폰트
- `assets/fonts/`에 Pretendard 4종 ttf 배치 완료. 출처: npm `pretendard` 패키지의 `dist/public/static/alternative/`(정적 weight). `--no-save`로 설치만 했고 package.json에는 미반영(런타임은 `assets/fonts`만 참조).
- 번들 결과 폰트 4종 정상 포함 확인(expo export 로그).

---

## 4. 검증 현황 (작업별 인수조건)

| Task | 상태 | 근거 |
|------|------|------|
| T1 초기화 | ✅ | package.json/app.json dev-client, tsc 통과 |
| T2 폴더구조 | ✅ | find 트리 확인, .gitkeep |
| T3 의존성 | ✅ | expo install --check "up to date" |
| T4 env 가드 | ✅(정적) | .env.example 2키, .gitignore 포함, env.ts throw 구현. **런타임 throw는 실행 검증 필요(아래 미완)** |
| T5 supabase 클라 | ✅ | §3.2 옵션대로, tsc 통과 |
| T6 익명 부트스트랩 | ⚠️ 코드완료, **런타임 미검증** | 코드/계약 완성. 실제 signInAnonymously→authenticated 도달·AsyncStorage 영속은 실 Supabase 프로젝트+디바이스 필요 |
| T7 tokens 이식 | ✅ | 1:1 복사, tsc 통과 |
| T8 ThemeProvider | ✅ | useTheme throw 가드 |
| T9 폰트 로드 | ⚠️ 코드완료, **렌더 미검증** | ttf 4종 번들 포함 확인. h1 Bold 실제 렌더는 디바이스 필요 |
| T10 공용 컴포넌트 | ✅ | grep raw 색상 0건, disabled/loading 분기 |
| T11 네비 뼈대 | ✅ | 3분기 + 탭(디폴트 Muklog), Routes 상수 |
| T12 부팅 스모크 | ✅(번들) | `expo export` 953 모듈 성공. **실기기 `expo start --dev-client` 빌드는 사용자 환경 의존(아래)** |

---

## 5. 미완 / 사용자 액션 필요 / TODO

### 사용자 환경 의존 (코드는 완료, 실행 검증 못 함)
1. **실 Supabase 프로젝트 연결**: 프로젝트 생성 → URL/anon 키를 `.env`에 기입(.env.example 복사). 없으면 env.ts가 throw(의도된 동작).
2. **Dev Client 실기/시뮬 빌드**: Kakao Map 네이티브 모듈 대비 Expo Go 불가. `npx expo run:ios`/`run:android` 또는 EAS dev build 필요. 본 스프린트는 Metro 번들 성공까지 검증(`expo export`). 디바이스 빌드는 미수행.
3. 위 1·2 후 런타임 검증 권장: ① 첫 실행 시 익명 세션→authenticated, 콘솔/화면에서 uid 확인 ② 재실행 시 동일 uid(AsyncStorage) ③ h1 텍스트 Bold 렌더(weight별 fontFamily) ④ 네트워크 차단 시 AuthErrorView+재시도.

### 코드 TODO (다음 스프린트)
- **invite-room**: `DEV_NAV` 임시 토글 + 각 화면의 dev 버튼 제거 → `AppNavigator` initialRoute를 `room_members` 멤버십 조회 기반 실제 분기로 교체. `supabase/migrations/`에 rooms·room_members·profiles·RLS·트리거 SQL 추가. `AuthProvider`에 profiles upsert 추가.
- **profile**: `AuthProvider`의 profiles upsert TODO 처리.

### 의도적 범위 외 (plan §2 Out-of-scope 준수)
- 마이그레이션 SQL/Edge Function/Kakao/먹로그 CRUD/다크모드 토글 — 미구현(빈 `supabase/{migrations,functions}` 디렉터리만).

---

## 6. 비용 가드레일 체크 (plan §8)
- AWS 리소스 0. 백엔드 Supabase만(익명 Auth, 무료 티어). 테이블/Storage 생성 없음.
- Kakao 키/호출 없음(이번 범위 외). 이미지 압축/viewport 해당 없음.
- 폰트: 필요한 4 weight ttf만 포함(나머지 weight 미포함).
