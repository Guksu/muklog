# Sprint: 프로젝트 기반 셋업 (setup)

> 스프린트 슬러그: `sprint-20260609-setup` · 단일 기능: **프로젝트 기반 셋업**
> 설계 단일 출처: `docs/design/architecture.md`. 토큰 출처: `.claude/skills/rn-supabase-dev/references/wanted-tokens.md`.
> 본 스프린트는 **비즈니스 기능 0개** — 모든 후속 스프린트(`invite-room` 등)가 올라탈 토대만 만든다.

---

## 1. 기능 한줄 정의

개발자가 `npx expo start --dev-client`로 앱을 실행하면, **Pretendard 폰트와 원티드 토큰이 적용된 화면**이 뜨고, **익명 Supabase 세션이 자동 확보**되며, **AuthGate → (Onboarding 플레이스홀더 | RoomTabs[Muklog/Map] 플레이스홀더)** 네비게이션 뼈대가 동작한다. (실제 방/먹로그/지도 로직은 없음)

---

## 2. 범위

### In-scope
1. **Expo 프로젝트 초기화** — Dev Client, TypeScript 템플릿.
2. **폴더 구조** — `src/{lib,theme,features,components,navigation}`, `supabase/{migrations,functions}` (빈 디렉터리는 `.gitkeep`).
3. **Supabase 클라이언트** — `src/lib/supabase.ts` + AsyncStorage 세션 영속 + `.env.example`.
4. **익명 세션 부트스트랩 골격** — 앱 진입 시 세션 없으면 `signInAnonymously()` 호출하는 훅/프로바이더 (profiles row 생성은 다음 스프린트).
5. **원티드 토큰** — `src/theme/tokens.ts`(참조 문서 값 그대로) + `ThemeProvider`/`useTheme()` + Pretendard `expo-font` 로드.
6. **네비게이션 뼈대** — `AuthGate` → 분기 → `Onboarding`(플레이스홀더) / `RoomTabs`(Muklog 디폴트 / Map, 둘 다 플레이스홀더).
7. **공용 컴포넌트 최소셋** — `Text`, `Button`, `Screen` (전부 토큰 기반, raw 값 금지).

### Out-of-scope (다음 스프린트로 미룸 — 의도적 제외)
- 초대코드 생성/방 생성·입장 로직 (`invite-room` 스프린트).
- `profiles` 행 생성/프로필 편집 (`profile` 스프린트).
- 먹로그 CRUD·리스트·상세·에디터 (`muklog-*` 스프린트).
- Kakao Map SDK 실제 연동·장소검색 Edge Function (`map-tab` 스프린트).
- DB 마이그레이션 SQL 실제 작성(테이블/RLS/트리거) — **이번엔 빈 `supabase/migrations/` 디렉터리만**. (스키마는 `invite-room`부터)
- 다크모드 토글 UI — 토큰/테마는 light/dark 둘 다 정의하되 **MVP는 light 고정**, 토글은 후순위.

---

## 3. 데이터 · 설정 계약 (개발자가 추측 없이 구현할 기준)

### 3.1 환경변수 (`.env.example` — 실제 `.env`는 커밋 금지)
| 키 | 예시값 | 노출 | 용도 |
|----|--------|------|------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | 공개 OK | Supabase 프로젝트 URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | 공개 OK (RLS가 보안 담당) | anon 키 |

- `EXPO_PUBLIC_` 프리픽스 필수(Expo가 클라이언트 번들에 주입). Kakao REST 키는 **이번 스프린트에 없음**(Edge Function 환경변수로 후속 처리).
- `.gitignore`에 `.env` 포함되어 있는지 확인(파일 작성만, git 명령은 금지).

### 3.2 Supabase 클라이언트 (`src/lib/supabase.ts`)
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
```
- env 누락 시 **명확한 에러 메시지**로 조기 실패(개발자가 원인 즉시 인지). "잘 동작" 금지.

### 3.3 익명 세션 부트스트랩 (`src/features/auth/useAuthBootstrap.ts` 또는 `AuthProvider`)
- 반환 상태(컴포넌트가 소비할 계약):
```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; userId: string }
  | { status: 'error'; message: string };
```
- 흐름: 마운트 → `supabase.auth.getSession()` 확인 → 세션 없으면 `signInAnonymously()` → 성공 시 `authenticated`, 실패 시 `error`.
- `onAuthStateChange` 구독으로 세션 변화 반영, unmount 시 구독 해제.
- **profiles upsert는 이번 스프린트 제외** (주석으로 TODO 표기).

### 3.4 테마 타입 (`src/theme/`)
- `tokens.ts`: 참조 문서(`wanted-tokens.md` §2)의 `palette / lightColor / darkColor / spacing / radius / shadow / typography / themes` **값 그대로** 옮긴다. 임의 변경 금지.
- 익스포트 계약:
```ts
export const themes = { light: {...}, dark: {...} } as const;
export type Theme = typeof themes.light; // { color, spacing, radius, shadow, typography }
```
- `ThemeProvider` + `useTheme(): Theme` (`src/theme/ThemeProvider.tsx`). MVP는 `light` 고정 주입.
- 컴포넌트는 **시맨틱 별칭만** 사용: `useTheme().color.primary` 등. raw hex/숫자 색상 하드코딩 금지.

### 3.5 폰트 (Pretendard, `expo-font`)
- `assets/fonts/`에 4개 weight 정적 ttf 배치 + `useFonts`로 로드.
- 패밀리명 계약(타이포 토큰의 `fontFamily`와 정확히 일치해야 함):
  `Pretendard-Regular` / `Pretendard-Medium` / `Pretendard-SemiBold` / `Pretendard-Bold`.
- 폰트 로드 완료 전 `SplashScreen` 유지 → 완료 후 hide. 로드 실패 시 fallback 처리(§6).

### 3.6 네비게이션 구조 (`src/navigation/`)
- 라이브러리: `@react-navigation/native` + native-stack + bottom-tabs.
```
AuthGate (RootNavigator)
  status==='loading'        → SplashView (로딩 인디케이터)
  status==='error'          → AuthErrorView (재시도 버튼)
  status==='authenticated'  → AppNavigator
       ├─ Onboarding (placeholder 화면, "방 만들기 / 초대코드 입력" 버튼만 — 동작 없음 or TODO alert)
       └─ RoomTabs (Tab Navigator)
            ├─ MuklogTab (디폴트, placeholder)
            └─ MapTab    (placeholder)
```
- **이번 스프린트 분기 기준**: 방 멤버십 조회 로직이 없으므로, Onboarding↔RoomTabs 전환은 **임시 토글**(예: dev 버튼 또는 상수 플래그)로 둘 다 도달 가능하게 한다. 실제 멤버십 기반 분기는 `invite-room`에서 교체. → 이 임시 처리를 dev-notes에 TODO로 명시.
- 라우트 이름 상수: `Routes = { Onboarding, RoomTabs, MuklogTab, MapTab }` (문자열 오타로 인한 이동 실패 방지).

---

## 4. 화면 · 뼈대 구조

| 화면/컴포넌트 | 역할 | 상태 처리 |
|---------------|------|-----------|
| `SplashView` | 폰트/세션 로딩 중 | 로딩 인디케이터 |
| `AuthErrorView` | 익명 세션 실패 | 에러 메시지 + 재시도 버튼 |
| `OnboardingScreen` (placeholder) | 방 진입 전 분기 화면 | "방 만들기"/"초대코드 입력" 버튼(비동작·TODO) |
| `MuklogTabScreen` (placeholder) | 먹로그 탭 자리 | 빈 상태 텍스트 "먹로그가 여기 표시됩니다" |
| `MapTabScreen` (placeholder) | 지도 탭 자리 | 빈 상태 텍스트 "지도가 여기 표시됩니다" |
| `Text` | 토큰 typography 적용 공용 텍스트 | variant prop(`body`, `h1` 등) |
| `Button` | 토큰 color/radius/spacing 적용 버튼 | `loading`/`disabled` 상태 |
| `Screen` | SafeArea + bg 토큰 래퍼 | - |

- **원티드 토큰 사용 지점**: 모든 화면/컴포넌트의 색·간격·타이포·radius·shadow는 `useTheme()` 경유. 예) `Screen` 배경=`color.bg`, `Button` 기본=`color.primary`/`color.primaryFg`, 제목=`typography.h1`.

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. Expo Dev Client + TS 초기화** — 인수조건: `package.json`에 expo·typescript 존재, `npx tsc --noEmit` 통과, `app.json`/`app.config`에 dev client 설정 존재.
- [ ] **T2. 폴더 구조 생성** — 인수조건: `src/{lib,theme,features,components,navigation}` + `supabase/{migrations,functions}` 디렉터리 존재(빈 폴더는 `.gitkeep`).
- [ ] **T3. 의존성 설치** — 인수조건: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `@react-navigation/native`+native-stack+bottom-tabs(+제스처/세이프에어리어 peer), `expo-font`, `expo-splash-screen` 설치됨.
- [ ] **T4. `.env.example` + env 가드** — 인수조건: `.env.example`에 두 키 존재, `.env`가 `.gitignore`에 포함, env 누락 시 supabase.ts가 명확한 에러를 throw(빈 문자열로 조용히 통과하지 않음).
- [ ] **T5. supabase 클라이언트** — 인수조건: `src/lib/supabase.ts`가 §3.2 옵션대로 `supabase` 익스포트, 타입 에러 없음.
- [ ] **T6. 익명 세션 부트스트랩** — 인수조건: 앱 첫 실행 시 세션 없으면 `signInAnonymously()` 호출되어 `authenticated`+userId 도달(콘솔/화면에서 uid 확인 가능), 재실행 시 동일 uid 유지(AsyncStorage 영속).
- [ ] **T7. tokens.ts 이식** — 인수조건: `wanted-tokens.md §2` 값과 1:1 일치(palette hex·spacing·typography), `Theme` 타입 익스포트, `npx tsc --noEmit` 통과.
- [ ] **T8. ThemeProvider/useTheme** — 인수조건: `useTheme()`가 light 테마 객체 반환, Provider 미적용 시 명확한 에러.
- [ ] **T9. Pretendard 폰트 로드** — 인수조건: 4 weight ttf 로드 완료 전 Splash 유지, 완료 후 화면 표시, `typography.h1` 텍스트가 Bold로 렌더(weight별 fontFamily 적용 확인).
- [ ] **T10. 공용 컴포넌트(Text/Button/Screen)** — 인수조건: 세 컴포넌트가 raw 색/숫자 색 하드코딩 없이 `useTheme()`만 사용(Grep `#` 색상 0건), Button `disabled`/`loading` 시각 구분.
- [ ] **T11. 네비게이션 뼈대** — 인수조건: AuthGate가 loading/error/authenticated 3분기 렌더, authenticated에서 Onboarding·RoomTabs 도달 가능, RoomTabs 기본 탭=Muklog, Map 탭 전환 동작, 라우트 이름은 `Routes` 상수 사용.
- [ ] **T12. 앱 부팅 스모크** — 인수조건: `npx expo start --dev-client`로 빌드/번들 성공, 크래시 없이 placeholder 화면 표시, `npx tsc --noEmit` 통과.

> 작업 단위로 완성될 때마다 developer는 dev-notes.md에 "생산자↔소비자" 매핑을 남기고, 모듈 완성 시 qa-inspector에 교차검증 요청.

---

## 6. 엣지케이스

**인증 / 세션**
- 익명 세션 발급 실패(네트워크 단절·Supabase 5xx) → `AuthErrorView` + 재시도 버튼. 무한 로딩 금지.
- env 키 누락/오타 → supabase.ts에서 조기 throw, 메시지에 누락 키명 포함.
- 재실행 시 기존 세션 복원 실패(AsyncStorage 손상) → 재발급 시도로 graceful fallback.
- 세션은 있으나 만료 → `autoRefreshToken`으로 갱신, 갱신 실패 시 재발급.

**폰트 / 테마**
- Pretendard ttf 누락/로드 실패 → 앱이 영구 Splash에 갇히지 않도록 타임아웃/실패 분기로 시스템 폰트 fallback 후 진입(에러 로깅).
- weight별 fontFamily 미적용(RN 흔한 버그) → h1이 Bold로 안 보이면 회귀. T9 인수조건으로 검출.
- `useTheme()`를 Provider 밖에서 호출 → 명확한 throw(런타임에 undefined 접근 방지).

**네비게이션 / 빌드**
- Onboarding↔RoomTabs 임시 토글이 운영 코드에 남지 않도록 TODO 명시(다음 스프린트 교체 대상).
- Dev Client 미설치 환경에서 Expo Go로 실행 시도 → README/dev-notes에 Dev Client 필요 명시(네이티브 모듈 추후 대비).
- 라우트 이름 문자열 오타 → `Routes` 상수로 차단.

**범위 경계(이번 스프린트에서 의도적으로 비움)**
- 방 멤버십 기반 실제 분기 없음 → 임시 토글이 그 자리. QA는 "분기 자체가 동작"만 검증(멤버십 로직 아님).

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 검증 포인트 |
|---|--------|--------|-------------|
| B1 | `.env.example` / 실제 env | `src/lib/supabase.ts` | 키 이름(`EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`) 정확 일치, 누락 시 throw |
| B2 | `useAuthBootstrap` `AuthState` | `AuthGate` 분기 렌더 | status 3종(`loading/authenticated/error`) 모두 대응 화면 존재, 누락 분기 없음 |
| B3 | `tokens.ts` (`Theme` 타입·시맨틱 별칭) | `Text`/`Button`/`Screen` 등 컴포넌트 | 컴포넌트가 존재하는 별칭만 참조, raw 색/숫자 하드코딩 0건(Grep) |
| B4 | `typography` 토큰의 `fontFamily` 문자열 | `useFonts`에 등록한 폰트 키 | 4개 패밀리명 철자 정확 일치(`Pretendard-*`) |
| B5 | `Routes` 상수 / 네비게이터 `name` | 화면 이동 호출부 | 등록된 라우트명과 `navigate()` 인자 일치, 기본 탭=Muklog |
| B6 | `ThemeProvider` 주입 | `useTheme()` 호출부 | Provider 트리 안에서만 호출, 밖 호출 시 throw |
| B7 | wanted-tokens.md §2 원본 값 | `tokens.ts` 이식값 | palette hex·spacing·typography 1:1 일치(임의 변경 0건) |

---

## 8. 비용 가드레일 체크

| 항목 | 이번 스프린트 해당 | 조치 |
|------|-------------------|------|
| AWS 미사용 | ✅ 필수 | 백엔드는 Supabase만. AWS 리소스 0. |
| Supabase 무료 티어 | ✅ | 익명 Auth만 사용(무료 포함). 테이블/Storage 생성 없음. |
| Kakao 디바운스/캐싱 | ❌ 이번 무관 | 지도/장소검색은 `map-tab` 스프린트. 키도 도입 안 함. |
| 이미지 압축 | ❌ 이번 무관 | 사진 업로드는 `muklog-editor` 스프린트. |
| viewport 조회 | ❌ 이번 무관 | 지도 조회 없음. |
| 번들 크기 | ⚠️ 경미 | Pretendard 4 weight ttf만 포함(불필요 weight 미포함), 아이콘/라이브러리 최소. |

---

## 부록. 다음 스프린트 핸드오프 메모
- `invite-room`이 이 뼈대 위에서: ① `supabase/migrations/`에 rooms·room_members·profiles·RLS·트리거 추가, ② AuthGate의 임시 토글을 **방 멤버십 조회 기반 실제 분기**로 교체, ③ `useAuthBootstrap`에 profiles upsert 추가.
- 토큰/테마/공용 컴포넌트는 전 스프린트 공유 자산 — 이번에 계약을 단단히 고정해야 후속 경계면 버그가 준다.
