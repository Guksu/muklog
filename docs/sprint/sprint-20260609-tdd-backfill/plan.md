# Sprint: TDD 테스트 인프라 구축 + 기존 코드 백필 (tdd-backfill)

> 이 스프린트는 **기능 추가가 아니라 안전망 구축**이다. 순수 test-first가 불가능한 이유: setup·invite-room 코드가 이미 존재한다. 따라서 전략은 두 가지다.
> 1. **명세(characterization) 테스트** — 현재 동작/인수조건을 코드로 고정해 회귀를 막는다.
> 2. **누락 경계·실패 경로 테스트** — 빈 입력, 잘못된 코드, 네트워크 실패, 정원 초과(ROOM_FULL), bad-response 등.
>
> 이번 스프린트가 끝나면 **이후 모든 신규 기능 스프린트는 순수 Red→Green→Refactor**로 진행할 수 있다.

---

## 1. 기능 한줄 정의

`npm test`로 invite-room 핵심 로직(유틸·훅·화면 흐름)의 동작을 자동 검증할 수 있고, 이후 스프린트가 의존할 jest-expo 테스트 인프라가 갖춰진다.

---

## 2. 범위

### In-scope
- **테스트 인프라 셋업**: `jest-expo` + `@testing-library/react-native` + `@types/jest` + `jest` 설치, `package.json` jest preset·transformIgnorePatterns, `jest.setup.ts`, `npm test`/`npm run test:watch` 스크립트, `@/` alias의 jest moduleNameMapper.
- **순수 유틸 단위 테스트**: `code.ts`(normalizeInviteCodeInput/isInviteCodeComplete), `errors.ts`(mapRoomError 토큰 5종 + 기본 + 포함매칭 + extractMessage 분기).
- **로직 훅 테스트(supabase 모킹)**: `useCreateRoom`, `useJoinRoom`, `useMembership`.
- **화면 핵심 흐름 테스트(훅/네비/clipboard 모킹)**: `OnboardingScreen` (choose → join 입력 정규화 → 입장 호출, 에러 메시지 노출, create-result 코드 표시·복사).
- 각 테스트의 인수조건(무엇을 검증) + 경계/실패 경로 명시.

### Out-of-scope (의도적으로 안 함 — 다음 스프린트/스모크)
- **SQL/RPC/RLS/트리거 자체의 단위 테스트** — 실 DB 필요 → 사용자 디바이스 스모크. 클라 측은 모킹된 응답/에러로 **계약만** 검증.
- **외부 SDK 내부 동작**(Supabase·Kakao·expo-clipboard·AsyncStorage) — 모킹. 우리 코드의 호출·매핑·처리만 검증.
- **네비게이션 게이트 통합 렌더**(AuthGate/MembershipGate의 NavigationContainer 실렌더) — 이번엔 화면 단위만. 게이트 분기 단위 테스트는 다음 스프린트 후보(§7에 경계만 명시).
- **컴포넌트 픽셀/스타일 검증**(Button/Text/Screen 스냅샷) — ROI 낮음, 제외.
- 신규 기능, 코드 리팩터(테스트가 빨개지지 않는 한 소스 수정 없음).

---

## 3. 셋업 계약 (developer가 추측 없이 구성)

### 3.1 의존성 (devDependencies)
```bash
npx expo install jest-expo
npm i -D jest @testing-library/react-native@^12.9.0 react-test-renderer@18.3.1 @types/jest
```
- `jest-expo`는 Expo SDK 52 / RN 0.76 호환을 `expo install`이 해석하도록 둔다.
- ⚠️ **RNTL 버전 핀 필수 (react18 환경)**: `@testing-library/react-native`를 미지정 설치하면 최신(v13.3.3)이 `react-test-renderer@19`/`react@19`를 요구해 현재 `react@18.3.1`과 **ERESOLVE 설치 실패**한다. 따라서 `@testing-library/react-native@^12.9.0` + `react-test-renderer@18.3.1`로 핀한다. v12도 jest matchers 내장 + react18 호환이라 testing-strategy의 "v12+" 요건을 충족한다.
  - **이 핀은 react18을 쓰는 동안 동일 스택의 모든 후속 스프린트에 적용된다.** react19 업그레이드 시 RNTL v13로 동반 상향.
- v12에서는 별도 `@testing-library/jest-native` extend 불필요(matchers 내장). 다만 일부 matcher(`toBeDisabled` 등) 자동 extend가 불완전할 수 있어, disabled 판정은 **버전 무관하게** `props.accessibilityState.disabled` 직접 단언으로 처리한다(§5-1 (6) 참조).

### 3.2 `package.json` jest 설정
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    },
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*))"
    ]
  }
}
```
- **`moduleNameMapper`는 필수**: 소스가 `@/lib/supabase`, `@/features/room`, `@/components`, `@/theme`를 import한다. tsconfig paths(`@/* → src/*`)와 1:1 일치해야 한다.
- 기존 `typecheck` 스크립트는 유지.

### 3.3 `jest.setup.ts` (공통 모킹)
- 네이티브 전용 모듈 중 **전역에서 항상 필요한 것만** 여기에 둔다. 나머지는 각 spec에서 `jest.mock`.
- 후보(developer 판단): `expo-clipboard` 전역 모킹은 OnboardingScreen spec에서 지역 모킹으로 충분하므로 **굳이 전역에 넣지 않아도 됨**. 빈 setup으로 시작하고 필요 시 추가.
```ts
// jest.setup.ts — 시작은 비워두고, 공통으로 반복되는 모킹만 승격한다.
```

### 3.4 파일명 규칙 (코드 컨벤션 §네이밍)
- 소스 옆 **콜로케이션**, 대표 심볼명 기준: `code.spec.ts`, `errors.spec.ts`, `useCreateRoom.spec.ts`, `useJoinRoom.spec.ts`, `useMembership.spec.ts`, `OnboardingScreen.spec.tsx`.
- 테스트 코드도 `docs/code-convention.md` 100% 준수(화살표 함수, named-object 인자 호출, useCallback/useMemo 미사용 — 단 테스트는 단언 위주라 대부분 무관).

### 3.5 완료 기준 (DoD)
- `npm test` 전체 green.
- `npm run typecheck`(=`tsc --noEmit`) 통과 — spec 파일 포함 타입 에러 0.
- 아래 §5-1의 모든 테스트 케이스가 실제 파일에 존재하고 통과.
- 표본 검증: 단언 1~2개를 일부러 깨면 빨개지는지 확인(껍데기 단언 금지, §5-1 끝 메모).

---

## 4. 테스트 대상 표면 (계약 — 이미 구현됨, 변경 없음)

> developer는 이 시그니처를 **명세로 고정**한다. 소스를 바꾸지 않는다(테스트가 정당하게 빨개지는 경우 제외, 그땐 리더에게 보고).

| 심볼 | 시그니처 | 핵심 동작 |
|------|----------|----------|
| `normalizeInviteCodeInput` | `({ raw: string }) => string` | toUpperCase → charset(32자) 외 제거(공백·0/O/1/I 포함) → 최대 6자 컷 |
| `isInviteCodeComplete` | `({ code: string }) => boolean` | `code.length === 6` |
| `INVITE_CODE_CHARSET` / `LENGTH` | `'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` / `6` | 상수. charset에 0/O/1/I 미포함 단언 |
| `mapRoomError` | `({ error: unknown }) => string` | 토큰 정확일치 → 포함매칭 → 기본. Error/string/{message}/기타 모두 처리 |
| `ROOM_ERROR_MESSAGES` | `Record<string,string>` (5키) | INVALID_CODE/ROOM_FULL/ALREADY_IN_ROOM/CODE_GENERATION_FAILED/NOT_AUTHENTICATED |
| `useCreateRoom` | `() => { createRoom: () => Promise<{roomId,inviteCode}>, loading, error }` | `rpc('create_room')` → snake→camel. bad-response 시 throw. 실패 시 error 한국어 |
| `useJoinRoom` | `() => { joinRoom: ({code}) => Promise<{roomId}>, loading, error }` | `rpc('join_room',{p_code:code})` → `{roomId}`. 토큰별 한국어 error |
| `useMembership` | `({ userId }) => { state, refresh }` | `from('room_members').select('room_id').eq('user_id',userId).maybeSingle()` → loading/no-room/in-room/error |

**모킹 계약 (supabase):**
- 훅 테스트는 `jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))`.
- `useMembership`은 체이닝 `from().select().eq().maybeSingle()`을 모킹 → 각 단계가 다음을 반환하는 mock 객체 빌더 필요.
- RPC 응답 shape는 **snake_case**(`{ room_id, invite_code }`), 우리 코드가 camel로 매핑하는지 검증.

---

## 5. 작업 목록 (각 인수조건 + 검증 테스트)

- [ ] **T0 셋업** — 인수조건: `npm test`가 0개 테스트로라도 에러 없이 부팅(preset·transformIgnorePatterns·moduleNameMapper 정상) — 테스트: 더미 `1+1=2` spec 1개가 green, `@/lib/supabase` import가 모듈 해석됨.
- [ ] **T1 code.spec.ts** — 인수조건: 입력 정규화·완성판정·charset 상수가 명세대로 — 테스트: §5-1 (1).
- [ ] **T2 errors.spec.ts** — 인수조건: 토큰 5종 매핑 + 포함매칭 + 미일치 기본 + 다양한 error 타입 추출 — 테스트: §5-1 (2).
- [ ] **T3 useCreateRoom.spec.ts** — 인수조건: 성공 시 snake→camel 매핑, rpcError·bad-response 시 throw + 한국어 error, loading 전이 — 테스트: §5-1 (3).
- [ ] **T4 useJoinRoom.spec.ts** — 인수조건: `p_code` 인자 전달, `{roomId}` 매핑, INVALID_CODE/ROOM_FULL 토큰 → 한국어 error, bad-response throw — 테스트: §5-1 (4).
- [ ] **T5 useMembership.spec.ts** — 인수조건: 마운트 시 in-room/no-room/error 분기, refresh 재조회, eq 인자=userId — 테스트: §5-1 (5).
- [ ] **T6 OnboardingScreen.spec.tsx** — 인수조건: choose→join 전이, 입력 정규화 반영, 6자 미만 입장 비활성, 입장 클릭 시 `joinRoom({code})` 호출, joinError 노출, create 성공 시 코드 표시·복사 — 테스트: §5-1 (6).

---

## 5-1. 테스트 케이스 (TDD — 파일별 정상·경계·실패)

> 표기: ✅정상 / ⚠️경계 / ❌실패. 각 케이스는 독립 `it()` 하나로 쓴다. 단언은 **인수조건**을 검증하고 내부 구현 순서에 과결합하지 않는다.

### (1) `src/features/room/code.spec.ts` — 순수 유틸 (단위 ✅)
**normalizeInviteCodeInput**
- ✅ 소문자 → 대문자: `{ raw: 'abcdef' }` → `'ABCDEF'`.
- ⚠️ 혼동문자·공백 제거 + 6자 컷: `{ raw: ' ab0o1i cdefg ' }` → `'ABCDEF'` (0,O,1,I,공백 제거 후 a b c d e f g 중 앞 6자).
- ⚠️ 6자 초과 컷: `{ raw: 'ABCDEFGH' }` → `'ABCDEF'` (length 6).
- ⚠️ 허용문자만 남기면 빈 문자열: `{ raw: '0011OOII' }` → `''`.
- ⚠️ 숫자 허용(2~9)·특수문자 제거: `{ raw: 'A2-B3@C4' }` → `'A2B3C4'`.

**isInviteCodeComplete**
- ✅ 6자 → true: `{ code: 'ABCDEF' }`.
- ⚠️ 5자 → false: `{ code: 'ABCDE' }`.
- ⚠️ 빈 문자열 → false: `{ code: '' }`.
- ⚠️ 7자 → false(정규화를 거치면 7자는 생기지 않지만 함수 자체는 ===6 이므로 false 보장).

**상수**
- ⚠️ `INVITE_CODE_LENGTH === 6`.
- ⚠️ `INVITE_CODE_CHARSET`에 `0`,`O`,`1`,`I`가 **포함되지 않음** + 길이 32 (C6 — SQL charset과 동일성의 클라 측 표현).

### (2) `src/features/room/errors.spec.ts` — 순수 유틸 (단위 ✅)
**mapRoomError — 토큰 정확 일치(5종)**
- ✅ `INVALID_CODE` → `'초대코드를 다시 확인해 주세요.'`
- ✅ `ROOM_FULL` → `'이미 2명이 모두 입장한 방이에요.'`
- ✅ `ALREADY_IN_ROOM` → `'이미 참여 중인 방이 있어요.'`
- ✅ `CODE_GENERATION_FAILED` → `'코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'`
- ✅ `NOT_AUTHENTICATED` → `'세션이 만료됐어요. 앱을 다시 시작해 주세요.'`
  - 각 케이스를 `new Error(TOKEN)`으로 입력(소비자 실제 경로 = rpcError throw).

**mapRoomError — 포함 매칭 / 기본**
- ⚠️ Postgres가 토큰을 감쌈: `new Error('ERROR: ROOM_FULL (SQLSTATE P0001)')` → ROOM_FULL 메시지.
- ❌ 미일치 토큰: `new Error('some network failure')` → `DEFAULT_ROOM_ERROR_MESSAGE`.
- ❌ 빈 메시지: `new Error('')` → 기본 메시지.

**mapRoomError — error 타입 추출(extractMessage 분기)**
- ⚠️ 문자열 입력: `{ error: 'INVALID_CODE' }` → INVALID_CODE 메시지.
- ⚠️ `{ message }` 객체: `{ error: { message: 'ROOM_FULL' } }` → ROOM_FULL 메시지.
- ⚠️ null/undefined/숫자 등 기타: `{ error: null }`, `{ error: 42 }` → 기본 메시지(throw 없이 안전 반환).

### (3) `src/features/room/useCreateRoom.spec.ts` — 훅 (단위 ✅ + supabase 모킹)
모킹: `jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))`. `beforeEach(() => rpc.mockReset())`.
- ✅ 성공 매핑: `rpc.mockResolvedValueOnce({ data: { room_id: 'r1', invite_code: 'ABCDEF' }, error: null })` → `createRoom()` 반환 `{ roomId: 'r1', inviteCode: 'ABCDEF' }`. `rpc`가 `'create_room'`으로 호출됨.
- ⚠️ loading 전이: 호출 전 `loading === false`, await 후 `false`(finally). (정상/실패 모두 finally로 false 복귀)
- ❌ rpcError throw + 한국어 error: `{ data: null, error: new Error('CODE_GENERATION_FAILED') }` → `createRoom()` rejects, `result.current.error === '코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'`.
- ❌ bad-response(필드 누락): `{ data: { room_id: 'r1' }, error: null }`(invite_code 없음) → rejects(`CREATE_ROOM_BAD_RESPONSE`), error는 기본 메시지(토큰 미일치 → DEFAULT).
- ❌ data null: `{ data: null, error: null }` → rejects(bad-response).

### (4) `src/features/room/useJoinRoom.spec.ts` — 훅 (단위 ✅ + supabase 모킹)
- ✅ 성공 매핑 + 인자 계약: `{ data: { room_id: 'r1' }, error: null }` → `joinRoom({ code: 'ABCDEF' })` 반환 `{ roomId: 'r1' }`. `rpc`가 `'join_room', { p_code: 'ABCDEF' }`로 호출됨(인자명 `p_code` — C1 경계).
- ❌ INVALID_CODE 토큰: `{ data: null, error: new Error('INVALID_CODE') }` → rejects, `error === '초대코드를 다시 확인해 주세요.'`.
- ❌ ROOM_FULL 토큰(정원 초과 경계): `{ data: null, error: new Error('ROOM_FULL') }` → rejects, `error === '이미 2명이 모두 입장한 방이에요.'`.
- ❌ bad-response: `{ data: {}, error: null }`(room_id 없음) → rejects(`JOIN_ROOM_BAD_RESPONSE`), error 기본 메시지.
- ⚠️ 호출 중 error 초기화: 첫 호출 실패로 error 세팅 후, 두 번째 성공 호출 시작 시 `setError(null)` → 성공 후 error null (상태 리셋 검증).

### (5) `src/features/room/useMembership.spec.ts` — 훅 (단위 ✅ + supabase 모킹 체이닝)
모킹: `from().select().eq().maybeSingle()` 체인. 헬퍼로 `maybeSingle`의 resolved 값을 케이스별 주입.
```ts
const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(() => ({ select })) } }));
```
- ✅ in-room: `maybeSingle.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null })` → `waitFor`로 `state === { status: 'in-room', roomId: 'r1' }`. `eq`가 `'user_id', userId`로 호출됨(C3 경계).
- ✅ no-room: `{ data: null, error: null }` → `state.status === 'no-room'`.
- ❌ error 분기: `{ data: null, error: new Error('rls denied') }` → `state.status === 'error'`, message `'멤버십 조회에 실패했어요. 다시 시도해 주세요.'`.
- ⚠️ 초기 상태: 첫 렌더 시 `state.status === 'loading'`(resolve 전).
- ⚠️ refresh 재조회: 최초 no-room 후 `maybeSingle`를 in-room으로 바꾸고 `act(() => refresh())` → `state`가 in-room으로 전이(폴링 없이 명시 호출로만 갱신 — 비용 가드레일 §8 표현).
- 메모: 언마운트 후 setState 경고 방지(mountedRef) — 테스트에서 직접 단언하지 않되, unmount 직후 resolve 케이스는 경고 없이 통과하면 충분.

### (6) `src/navigation/screens/OnboardingScreen.spec.tsx` — 화면 (단위 ✅ + 훅/네비/clipboard 모킹)
모킹 대상:
- `@/features/room`의 `useCreateRoom`/`useJoinRoom`/`useMembershipContext` (반환을 jest.fn으로 제어). `normalizeInviteCodeInput`/`isInviteCodeComplete`/`INVITE_CODE_LENGTH`는 **실제 구현 사용**(정규화가 화면에 반영되는지 봐야 하므로 — partial mock: `jest.requireActual`).
- `@react-navigation/native`의 `useNavigation` → `{ reset: jest.fn() }`.
- `expo-clipboard` → `{ setStringAsync: jest.fn().mockResolvedValue(undefined) }`.
- 렌더는 `renderWithTheme` 헬퍼(`<ThemeProvider>`로 감쌈)로 — Button/Text/Screen이 `useTheme` 사용.

**choose step**
- ✅ 초기 렌더: "방 만들기", "초대코드 입력" 버튼 노출.
- ✅ "초대코드 입력" 탭 → join step 전이: "입장" 버튼·코드 입력 노출.

**join step — 입력/검증/호출**
- ⚠️ 입력 정규화 반영: TextInput에 `'ab0o1icd'` 입력(`fireEvent.changeText`) → 표시값 `'ABCD'`(0,O,1,I 제거)… 실제 입력 `'abcdef'` → `'ABCDEF'`. (실 normalize 사용)
- ⚠️ 6자 미만 입장 비활성: 코드 `'ABC'` → "입장" 버튼 `disabled`(isInviteCodeComplete false). 6자 → 활성. **disabled 단언은 `props.accessibilityState.disabled`로 직접 검증**(RNTL v12.9의 `toBeDisabled` 자동 extend가 불완전 — 버전 무관 방식).
- ✅ 입장 호출 계약: 6자 입력 후 "입장" press → `joinRoom`이 `{ code: 'ABCDEF' }`로 호출됨. 성공(mock resolve) 시 `navigation.reset`이 `{ index:0, routes:[{name:'RoomTabs'}] }`로, `membership.refresh` 호출됨(C8 전이 경계).
- ❌ joinError 노출: `useJoinRoom` mock의 `error`를 `'초대코드를 다시 확인해 주세요.'`로 두고 join 실패(reject) → 에러 메시지 텍스트가 화면에 노출, step은 join 유지(코드 입력 유지).

**create-result step**
- ✅ create 성공 → 코드 표시: `useCreateRoom` mock의 `createRoom`이 `{ roomId:'r1', inviteCode:'ABCDEF' }` resolve → "방 만들기" press 후 `'ABCDEF'` 텍스트 노출 + "방으로 가기" 버튼.
- ⚠️ 복사: "코드 복사" press → `Clipboard.setStringAsync`가 `'ABCDEF'`로 호출, 버튼 라벨 "복사됨"으로 전환.
- ❌ create 실패: `createRoom` reject + `useCreateRoom.error` 세팅 → choose step 유지 + createError 메시지 노출.
- ✅ "방으로 가기" press(create-result) → `navigation.reset(RoomTabs)` + `refresh` 호출.

> **테스트 헬퍼**: `src/test/renderWithTheme.tsx`(또는 spec 내 로컬) — `render(ui, { wrapper: ThemeProvider })`. 콜로케이션 규칙 예외로 `src/test/` 허용(developer 판단, 단 한 곳에 모은다).

> **load-bearing 확인(필수 절차)**: 작성 후 표본으로 (1) `code.spec` 정규화 기대값을 틀리게, (2) `useJoinRoom` 토큰 메시지를 틀리게 바꿔 `npm test`가 **실제로 빨개지는지** 1회 확인 → 되돌린다. 껍데기 단언(`expect(true).toBe(true)`류) 금지.

---

## 6. 엣지케이스 (테스트로 커버할 각도)

- **빈/불완전 입력**: 빈 코드, 5자 코드, charset 외 문자만 입력 → 입장 비활성·정규화 빈 문자열.
- **잘못된 코드(인증/오타)**: INVALID_CODE 토큰 → 한국어 메시지, step 유지, 입력 보존.
- **정원 초과(커플 2명 동시성의 결과)**: ROOM_FULL 토큰 → "이미 2명이 모두 입장한 방이에요." (서버가 동시성/트리거로 판정, 클라는 토큰 매핑만 — 단위 테스트는 매핑까지).
- **이미 참여 중**: ALREADY_IN_ROOM 토큰 매핑.
- **네트워크 실패/미상 에러**: 토큰 미일치 → DEFAULT 메시지(throw 안 함, 안전 반환).
- **bad-response(서버 계약 위반)**: 필드 누락 시 throw + 기본 메시지(앱이 잘못된 데이터로 진행하지 않음).
- **세션 만료/미인증**: NOT_AUTHENTICATED 토큰 매핑.
- **멤버십 상태 동시성**: no-room→in-room을 refresh로만 전이(폴링 없음), 초기 loading 노출.
- **error 값 타입 다양성**: Error/string/{message}/null/number — extractMessage가 모두 안전 처리.

> 주의: **동시성·정원·RLS의 진짜 판정은 서버(트리거/RPC)** 이며 단위 테스트 범위 밖이다. 여기서는 "서버가 토큰을 주면 클라가 올바르게 처리하는가"까지만 검증한다. 실제 2명 동시 입장 경합은 **사용자 디바이스 스모크**로 남긴다(§7 비단위 경계).

---

## 7. QA 교차검증 경계면 (qa-inspector가 양쪽을 같이 읽을 대상)

생산자 ↔ 소비자 / 계약 일치 중심:

1. **RPC 응답 shape ↔ 훅 매핑** — `create_room`이 `{ room_id, invite_code }`(snake) 반환 ↔ `useCreateRoom`이 `{ roomId, inviteCode }`(camel) 매핑. 테스트가 snake 입력 → camel 출력을 단언하는가.
2. **`join_room` 인자명 ↔ 훅 호출** — RPC 시그니처 `p_code` ↔ `useJoinRoom`이 `{ p_code: code }`로 호출. 테스트가 `rpc`의 두 번째 인자를 단언하는가.
3. **에러 토큰 단일 출처** — SQL `raise exception '<TOKEN>'` 토큰 5종 ↔ `ROOM_ERROR_MESSAGES` 키. 테스트가 5종을 모두 커버하고, 토큰 문자열이 정확히 일치하는가. (SQL은 `supabase/migrations/20260609120000_invite_room.sql` — QA가 토큰 문자열 일치 육안 확인.)
4. **charset 단일 출처(C6)** — `INVITE_CODE_CHARSET`(클라) ↔ SQL의 create_room charset. 테스트가 0/O/1/I 미포함·길이 32를 단언하는가(클라 측 표현). SQL과의 실제 동일성은 QA 육안 교차확인.
5. **화면 ↔ 훅 호출 계약** — OnboardingScreen이 `joinRoom({ code })`/`createRoom()`을 올바른 인자로 호출하고, 훅의 `error`/`loading`을 UX에 올바르게 바인딩하는가.
6. **전이 계약(C8)** — 성공 시 `navigation.reset(RoomTabs)` + `membership.refresh()` 둘 다 호출. 테스트가 두 호출을 모두 단언하는가.
7. **멤버십 조회 계약(C3)** — `from('room_members').select('room_id').eq('user_id', userId)` 체인과 분기. 테스트의 모킹 체인이 실제 호출 체인과 일치하는가(오버피팅 아닌 계약 단언).
8. **테스트 인프라 정합** — `moduleNameMapper`가 tsconfig `@/*`와 1:1인가. `transformIgnorePatterns`가 @supabase/expo/react-navigation을 포함해 변환 누락이 없는가.

**QA 검증 포인트(테스트 자체 품질):**
- (a) §5-1의 모든 케이스가 **실제 파일에 존재**하는가.
- (b) `npm test` 전체 green, `tsc --noEmit` 통과.
- (c) 단언이 **의미 있는가**(load-bearing) — 표본 변형 시 빨개지는지 확인됐는가.
- (d) 경계·실패 경로가 **누락 없이** 커버됐는가(빈 입력/잘못된 코드/네트워크 실패/ROOM_FULL/bad-response).
- (e) 외부 SDK 내부 동작을 검증하지 않고(모킹 경계 준수), 내부 구현 순서에 과결합하지 않는가.

---

## 8. 비용 가드레일 체크

- **런타임 비용 무관**: 테스트는 로컬 jest 실행 — Supabase/Kakao/AWS 호출 없음(전부 모킹). 쿼터·과금 영향 0.
- **AWS 미사용** 유지(CI 도입은 이번 범위 아님).
- **폴링 금지 정책의 명세화**: `useMembership` 테스트가 "refresh 명시 호출로만 재조회"를 단언 → 비용 가드레일 §8(폴링/주기조회 금지)을 회귀로 고정.
- devDependencies만 추가(런타임 번들 영향 없음).

---

## 부록: 의존성·실행 순서 권장
1. T0(셋업) → 더미 spec green 확인.
2. T1·T2(순수 유틸 — supabase 모킹 불필요, ROI 최고) → 모킹 패턴 없이 빠른 green.
3. T3·T4(rpc 모킹) → T5(체이닝 모킹, 난이도↑).
4. T6(화면 — 훅/네비/clipboard 모킹 + renderWithTheme).
5. 전체 `npm test` green + `tsc --noEmit` + load-bearing 표본 확인 → DoD 충족.
</content>
</invoke>
