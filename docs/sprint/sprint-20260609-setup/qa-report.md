# QA Report — 프로젝트 기반 셋업 (setup)

> 검증자: qa-inspector · 입력: `plan.md`, `dev-notes.md`, 소스 전체, `architecture.md`, `wanted-tokens.md`
> 방식: 경계면 **양쪽 동시 읽기**(생산자↔소비자) + raw 값 전수 Grep + 독립 `tsc --noEmit` 재실행
> 결론: **경계면 정합성 결함 0건.** 정적/계약 인수조건 전부 통과. 디바이스·실 Supabase 의존 런타임 항목 4건은 **미검증(환경의존, 결함 아님)**.

---

## 1. 경계면 교차검증 (plan §7 B1~B7) — 전부 통과

| # | 생산자 | 소비자 | 결과 | 근거 |
|---|--------|--------|------|------|
| **B1** env 키 | `.env.example` `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` → `src/lib/env.ts:18-21` | `src/lib/supabase.ts:10` (`env.SUPABASE_URL/ANON_KEY`) | ✅ 통과 | 키명 정확 일치. `env.ts:7-16` 누락/공백 시 **누락 키명 포함 throw**(조용한 통과 없음). 리터럴 키 접근 → 번들 인라인 OK. |
| **B2** AuthState | `AuthProvider.tsx:13-16` `{loading}\|{authenticated,userId}\|{error,message}` | `AuthGate.tsx:18-34` switch | ✅ 통과 | 3 status 전부 화면 매핑(Splash/Error/AppNavigator). `default`에 `never` exhaustive 가드(`AuthGate.tsx:31`) → 분기 누락 시 컴파일 에러. `tsc` 0 에러로 확인. |
| **B3** 토큰 별칭 | `tokens.ts` 시맨틱 별칭(`color.*`/`typography.*`/`spacing.*`/`radius.*`) | `Text`/`Button`/`Screen` + 전 screens | ✅ 통과 | `useTheme()`만 사용. **raw hex/rgb/named-color 하드코딩 0건**(Grep: src 내 tokens.ts 제외). 모든 색·간격·타이포가 토큰 경유. |
| **B4** 폰트 패밀리 | `tokens.ts:54-61` `typography.*.fontFamily`(고유 4종) | `fonts.ts:7-12` `fontMap` 키 → `App.tsx:39` `Font.loadAsync` | ✅ 통과 | `Pretendard-Regular/Medium/SemiBold/Bold` 4종 철자 1:1 일치. ttf 4파일 모두 `assets/fonts/`에 존재. 미사용 등록·누락 없음. |
| **B5** 라우트 | `routes.ts:Routes` + 네비게이터 `name`(`AppNavigator:19-20`, `RoomTabs:31,36`) | `navigate()` 호출부(`OnboardingScreen:50`→`RoomTabs`, `MuklogTabScreen:31`→`Onboarding`) | ✅ 통과 | 모든 navigate 인자가 등록 라우트명. 전부 `Routes` 상수 경유(문자열 리터럴 0건). **기본 탭 = MuklogTab**(`RoomTabs.tsx:19`, architecture §4 준수). |
| **B6** ThemeProvider | `App.tsx:71` `<ThemeProvider>`가 `AuthProvider`보다 바깥 | 전 컴포넌트 `useTheme()` | ✅ 통과 | Provider 트리 내 호출만. `ThemeProvider.tsx:29-31` Provider 밖 호출 시 throw. Splash/Error도 ThemeProvider 안(순서 정확). |
| **B7** 토큰 1:1 | `wanted-tokens.md §2` 원본 | `tokens.ts` 이식값 | ✅ 통과 | palette·light/darkColor·spacing·radius·shadow·typography **전수 1:1 일치**(임의 변경 0건). **developer ⚠️ 확인요망 답변:** 추가된 `ColorToken`/`TypographyVariant`는 **타입 레벨 export(`keyof`)일 뿐 런타임 값 변경 없음** → 계약 위반 아님, 오히려 컴포넌트 prop 타입 안전성 강화. **승인.** |

---

## 2. 엣지케이스 (plan §6) — 코드 처리 확인

| 항목 | 결과 | 근거 |
|------|------|------|
| env 키 누락/오타 → 조기 throw(키명 포함) | ✅ 통과 | `env.ts:7-16` |
| 익명 세션 실패(네트워크·5xx) → 에러화면+재시도, 무한로딩 금지 | ✅ 통과(정적) | `AuthProvider.tsx:64-69` catch→error, `retry()` 32-35 / `AuthErrorView` 재시도 버튼. *런타임 도달은 §4 미검증* |
| 폰트 ttf 누락/로드 실패 → 영구 Splash 방지, 시스템폰트 fallback | ✅ 통과 | `App.tsx:32-49` 8s 타임아웃 + `.catch()` → `setReady(true)` |
| `useTheme()`/`useAuth()` Provider 밖 호출 → throw | ✅ 통과 | `ThemeProvider.tsx:29`, `AuthProvider.tsx:96` |
| 빈 상태 UI(먹로그/지도 placeholder) | ✅ 통과 | `MuklogTabScreen`/`MapTabScreen` 안내 텍스트 |
| 임시 토글(Onboarding↔RoomTabs)이 운영코드에 남지 않도록 TODO 명시 | ✅ 통과 | `devFlags.ts:1-8` ⚠️+TODO(invite-room 제거 대상), dev-notes §5 명시 |
| AsyncStorage 손상 시 재발급 graceful | ✅ 통과(정적) | `AuthProvider.tsx:45-52` 세션 없으면 재발급 |

---

## 3. 비용 가드레일 (plan §8) — 통과

- **AWS 리소스 0** ✅ — 백엔드 Supabase only(익명 Auth, 무료 티어). 테이블/Storage 생성 없음.
- **의존성 최소·전부 필요** ✅ — `package.json` deps 14개 모두 plan §3 T3 명시 항목 또는 필수 peer(screens/safe-area/gesture-handler). 불필요 패키지 없음.
- **폰트 번들** ✅ — 필요 4 weight ttf만(나머지 weight 미포함). `pretendard` npm은 `--no-save`로 package.json 미반영, 런타임은 `assets/fonts`만 참조.
- Kakao/이미지/viewport — 이번 범위 외, 키·호출 도입 없음 ✅.

---

## 4. 미검증 (환경의존 — 결함 아님, 사용자 디바이스 스모크 필요)

> 아래는 **구현 결함이 아니라** 실 Supabase 프로젝트 + Dev Client 디바이스 빌드가 있어야만 확인 가능한 런타임 항목. 코드/계약은 완료. 이 하네스 환경에서 에이전트가 수행 불가 → "통과"로 처리하지 않음.

| Task | 인수조건(런타임 부분) | 미검증 사유 |
|------|----------------------|-------------|
| **T6** | 첫 실행 시 `signInAnonymously()`→`authenticated`+uid 도달, 재실행 시 동일 uid(AsyncStorage 영속) | 실 Supabase 프로젝트 + `.env` + 디바이스 필요 |
| **T4** | env 누락 시 supabase.ts **런타임** throw 실제 발생 | 정적 코드 경로 확인 완료. 런타임 트리거는 실행 필요 |
| **T9** | `typography.h1`이 실제 **Bold로 렌더**(weight별 fontFamily 적용) | 디바이스 렌더 필요(RN weight 미적용 회귀 검출용) |
| **T12** | `expo start --dev-client` 실기/시뮬 빌드 크래시 없이 placeholder 표시 | Metro 번들(`expo export`)은 developer 확인. 디바이스 빌드는 사용자 환경 의존 |

**권장 사용자 스모크(1·2 선행):** ① 실 Supabase 프로젝트 생성→`.env` 기입 ② `npx expo run:ios`(또는 EAS dev build) → ③ 첫 실행 uid 콘솔 확인 / 재실행 동일 uid / h1 Bold 렌더 / 네트워크 차단 시 AuthErrorView+재시도.

---

## 5. 참고(경미 — 비차단, 수정 불요)

- `dev-notes.md §1`은 `.gitignore`에 "`.env`/`.env.*`"라 적었으나 실제는 `.env`/`.env.local`/`.env.*.local`(Expo 기본). **핵심 시크릿 `.env`는 무시되고 `.env.example`은 추적 유지** → 실제 패턴이 더 안전(블랭킷 `.env.*`였다면 `.env.example`까지 무시될 뻔). 결함 아님, 문서 표현만 부정확.
- `app.json` splash `backgroundColor:"#FFFFFF"`는 네이티브 스플래시 config(JS 토큰 참조 불가 영역). B3 위반 아님.

---

## 6. 인수조건 종합 (plan §5)

| Task | 정적/계약 | 런타임 |
|------|----------|--------|
| T1 초기화 / T2 폴더 / T3 의존성 / T5 supabase클라 / T7 tokens / T8 ThemeProvider / T10 컴포넌트 / T11 네비뼈대 | ✅ 통과 | — |
| T4 env가드 | ✅ 통과(코드경로) | ⚠️ 런타임 미검증 |
| T6 익명부트스트랩 | ✅ 통과(계약) | ⚠️ 런타임 미검증 |
| T9 폰트로드 | ✅ 통과(번들·계약) | ⚠️ 렌더 미검증 |
| T12 부팅스모크 | ✅ 통과(번들) | ⚠️ 디바이스 미검증 |

**독립 검증:** `npx tsc --noEmit` → exit 0(재실행 확인). raw 색상 Grep 0건. 폰트/라우트 1:1 대조 통과.

**판정:** 경계면 통합 정합성 **결함 0건**, QA 검증 가능 범위 전부 통과. 잔여 4건은 환경의존 런타임으로 에이전트 수행 불가 → 사용자 디바이스 스모크로 최종 사인오프 권장.
