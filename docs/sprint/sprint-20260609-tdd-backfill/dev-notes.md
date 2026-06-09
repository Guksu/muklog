# Dev Notes — tdd-backfill (테스트 인프라 + 백필)

> 입력: `plan.md`(이 스프린트), `docs/testing-strategy.md`, `.claude/skills/rn-supabase-dev/references/testing.md`, `docs/code-convention.md`.
> 결과: jest-expo 인프라 구축 + invite-room 핵심(유틸·훅·화면) 백필 테스트 **52개 전부 green**, `tsc --noEmit` 통과.

---

## 1. 셋업 (T0)

### 의존성 (devDependencies)
- `jest-expo ~52.0.6` — `npx expo install jest-expo`로 설치(SDK52 호환 해석). expo가 `dependencies`에 넣어서 **devDependencies로 이동**.
- `jest ^29.7.0`, `@testing-library/react-native ^12.9.0`, `@types/jest ^30`, `react-test-renderer ^18.3.1`.
- ⚠️ **버전 핀 사유(plan §3.1의 "임의 핀 금지"에서 의도적으로 벗어남 — 보고)**: `npm i -D @testing-library/react-native`(미지정)는 **v13.3.3**을 끌어오고, 이는 `react-test-renderer@19`(→ `react@19`)를 요구해 현재 `react@18.3.1`과 **peer 충돌(ERESOLVE)로 설치 실패**. RN 0.76/React 18 호환을 위해 `@testing-library/react-native@^12.9.0`(v12 = jest matchers 내장, React 18 지원) + `react-test-renderer@18.3.1`로 핀. testing-strategy의 "v12+" 요건 충족.

### package.json
- scripts: `test`(=jest), `test:watch`(=jest --watch) 추가. 기존 `typecheck` 유지.
- jest 설정: `preset: jest-expo`, `setupFilesAfterEnv: [<rootDir>/jest.setup.ts]`, `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }`(tsconfig paths `@/*`와 1:1), `transformIgnorePatterns`(react-native/expo/@react-navigation/@supabase 변환 포함).

### jest.setup.ts
- 전역 모킹은 **두지 않음**(plan §3.3 권장대로 시작은 비움). 유일하게 한 일: `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` **더미 주입**.
  - 사유: `src/lib/env.ts`가 env 누락 시 throw → 훅 spec은 `@/lib/supabase`를 모킹해 안전하지만, 실 모듈이 실수로 로드돼도 테스트가 env throw로 죽지 않도록 안전망.

### 스모크 (T0)
- `src/__smoke__/setup.spec.ts` — `1+1=2` + `@/features/room/code` import로 moduleNameMapper 해석 확인.

---

## 2. 작성한 테스트 파일 (콜로케이션 `*.spec.ts(x)`)

| 파일 | 대상 | 케이스 수 | 커버(인수조건) |
|------|------|-----------|----------------|
| `src/__smoke__/setup.spec.ts` | 인프라 | 2 | 부팅·alias 해석 |
| `src/features/room/code.spec.ts` | `normalizeInviteCodeInput`/`isInviteCodeComplete`/상수 | 12 | 대문자화·혼동문자/공백 제거·6자컷·빈문자열·숫자허용 / 6·5·0·7자 / charset 0·O·1·I 미포함·길이32 (C6) |
| `src/features/room/errors.spec.ts` | `mapRoomError` | 13 | 토큰5종 정확일치·키 집합·포함매칭·기본·빈메시지 / string·{message}·null·number 추출 (C2) |
| `src/features/room/useCreateRoom.spec.ts` | `useCreateRoom` | 5 | snake→camel·`create_room` 호출(C1)·loading 전이·rpcError한국어·bad-response·data null |
| `src/features/room/useJoinRoom.spec.ts` | `useJoinRoom` | 5 | `p_code` 인자계약(C1)·roomId 매핑·INVALID_CODE/ROOM_FULL(C2)·bad-response·error 리셋 |
| `src/features/room/useMembership.spec.ts` | `useMembership` | 5 | in-room/no-room/error 분기·`eq('user_id',uid)`(C3)·초기 loading·refresh 재조회(폴링없음) |
| `src/navigation/screens/OnboardingScreen.spec.tsx` | `OnboardingScreen` | 10 | choose→join 전이·정규화 반영·6자 미만 비활성·`joinRoom({code})` 호출+reset+refresh(C8)·joinError 노출·create 코드표시·복사·방으로가기·create 실패 |
| **합계** | | **52** | |

### 테스트 헬퍼
- `src/test/renderWithTheme.tsx` — `ThemeProvider` + `SafeAreaProvider`(Screen의 SafeAreaView용, initialMetrics 주입)로 감싸는 render 래퍼. 콜로케이션 예외로 `src/test/`에 집약(plan §5-1 (6) 메모 허용).

---

## 3. 모킹 경계 (생산자 ↔ 소비자 매핑)

| 경계(plan §7) | 생산자(모킹) | 소비자(테스트) | 단언 |
|---|---|---|---|
| C1 | `supabase.rpc` resolved `{ room_id, invite_code }`(snake) | `useCreateRoom`/`useJoinRoom` | 반환 `{ roomId, inviteCode }`(camel), `rpc('create_room')` / `rpc('join_room',{p_code})` 인자 |
| C2 | `new Error('<TOKEN>')` 5종 | `mapRoomError`/훅 error | 토큰→한국어 1:1, `ROOM_ERROR_MESSAGES` 키=5종, 미일치→DEFAULT |
| C3 | `from().select().eq().maybeSingle()` 체인 mock | `useMembership` | `from('room_members')`·`select('room_id')`·`eq('user_id',userId)` 호출 + 분기 |
| C6 | (SQL charset) | `INVITE_CODE_CHARSET` 단언 | 0/O/1/I 미포함·길이32 (SQL과 실제 동일성은 QA 육안) |
| C8 | (성공 resolve) | `OnboardingScreen` | `navigation.reset({index:0,routes:[{name:'RoomTabs'}]})` + `membership.refresh()` 둘 다 |

- supabase 모킹: 훅 spec은 `jest.mock('@/lib/supabase', ...)`. `useMembership`은 체인 빌더 mock + 프록시(jest.mock 팩토리 외부변수 제약 우회).
- 화면 spec: `@/features/room`을 **부분 모킹** — `code.ts`(normalize/complete/LENGTH)는 `jest.requireActual`로 실제 사용(정규화가 화면에 반영되는지 검증), 훅 3종만 jest.fn. `@react-navigation/native`(useNavigation→reset), `expo-clipboard`(setStringAsync) 모킹.
- 외부 SDK 내부 동작은 검증 안 함(모킹 경계 준수). 내부 호출 순서 과결합 회피 — 동작/계약 단언 위주.

---

## 4. 소스 변경

- **소스 코드 변경 0건.** 테스트는 현재 동작을 명세(characterization)로 고정. 테스트가 정당하게 빨개지는 버그는 발견되지 않음.
- 신규 파일만 추가: 7개 spec + `src/test/renderWithTheme.tsx` + `jest.setup.ts` + package.json jest 설정.

---

## 5. 구현 중 마주친 것 (해결)

1. **ERESOLVE peer 충돌** — RNTL v13/react19 ↔ react18. → v12.9 + rtr18 핀(위 §1).
2. **jest.mock 팩토리 호이스팅** — 네비 mock이 비-`mock`프리픽스 변수(`reset`) 참조 → babel 에러. → `mockNavReset`으로 리네임.
3. **`toBeDisabled` 매처 미등록** — v12.9에서 자동 extend 안 됨. → 매처 의존 제거, `getByRole('button',{name})...props.accessibilityState.disabled` 직접 단언(버전 무관 견고).

---

## 6. DoD 충족

- ✅ `npm test` — **7 suites / 52 tests 전부 green**.
- ✅ `npm run typecheck`(=`tsc --noEmit`) — exit 0(spec 포함 타입에러 0).
- ✅ **load-bearing 표본 확인** — (1) `code.spec` 정규화 기대값, (2) `useJoinRoom` INVALID_CODE 메시지를 일부러 틀리게 → 둘 다 **빨개짐 확인** 후 되돌림. 껍데기 단언 없음.

---

## 7. 미커버(의도적 — 비단위 경계 / 다음 스프린트)

- **SQL/RPC/RLS/트리거 자체**(`supabase/migrations/20260609120000_invite_room.sql`) — 실 DB 필요 → **사용자 디바이스 스모크**. 클라 측은 모킹 응답/에러로 계약만 검증함.
- **동시성·정원(ROOM_FULL)의 실제 경합** — 서버 트리거/`for update` 판정. 단위는 "서버가 토큰 주면 클라가 올바르게 처리"까지만. 실 2명 동시 입장은 스모크.
- **네비게이션 게이트 통합 렌더**(AuthGate/MembershipGate + NavigationContainer 실렌더) — 이번 화면 단위 범위 밖. 게이트 분기 단위 테스트는 다음 스프린트 후보.
- **컴포넌트 픽셀/스냅샷**(Button/Text/Screen) — ROI 낮아 제외.
- charset/토큰의 **SQL ↔ 클라 실제 동일성** — 클라 측 표현만 단언, SQL 문자열 1:1은 QA 육안 교차확인 요청.

---

## 8. 비용 가드레일

- 테스트는 전부 로컬 jest + 모킹 → Supabase/Kakao/AWS 호출 0, 과금 영향 0.
- devDependencies만 추가 → 런타임 번들 영향 없음.
- `useMembership` 테스트가 "refresh 명시 호출로만 재조회(폴링 없음)"를 회귀로 고정 → 비용 가드레일 §8 명세화.

---

## 9. QA 교차검증 요청 경로

- 1차(유틸+훅): code/errors/useCreateRoom/useJoinRoom/useMembership — qa-inspector에 전달 완료.
- 2차(화면): OnboardingScreen.spec.tsx — 전달.
- 실행: `npm test`(전체) 또는 `npx jest src/features/room` / `npx jest src/navigation`.
