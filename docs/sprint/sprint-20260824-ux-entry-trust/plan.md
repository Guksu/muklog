# Sprint: 진입·생성 신뢰 3종 (sprint-20260824-ux-entry-trust)

> UX 개선 스프린트 · 백로그 항목 **U1·U2·U3**(`docs/ux/ux-backlog.md` 임팩트 상·비용 하 구간)
> 원칙 출처: `ux-principles` 스킬 — 인수조건에 위반 원칙 번호를 인용한다(U1: 3·7·10 / U2: 2·3 / U3: 5·10).
> 비주얼 단일 출처는 킷 `templates/muklog` 불변. 이 스프린트는 킷이 이미 정의한 플로우로 **되돌리는** 작업이라 킷 충돌 0(사용자 승인 대기 항목 없음).

## 1. 기능 한줄 정의

로그를 **어디서 만들든 초대코드를 반드시 한 번 보고**(U1), 초대코드 입력은 **첫 탭에 들어가지며**(U2), 앱 진입이 실패해도 **한국어로 다음 행동을 안내받는다**(U3).

## 2. 범위

**In-scope (이 3건만)**

- **U1** — `LogListScreen`의 생성 경로를 `PlusHeaderButton`과 동일 배선으로 통일. 하단 "새 로그 시작하기"는 킷대로 `AddSheet`(생성/입장 두 갈래)를 연다.
- **U2** — `JoinLogScreen` 키보드 마찰 제거(`keyboardShouldPersistTaps` + `KeyboardAvoidingView` + 6자 완성 시 자동 내림).
- **U3** — 부트스트랩·프로필 보장 실패의 영어 원문 노출 제거. `features/auth/errors` 매핑 재사용, 원문은 `console.warn`.

**Out-of-scope (일부러 안 함 — 백로그 별도 항목)**

- U42(생성 진행/실패 피드백: 시트 유지·인라인 스피너·Alert→토스트) — **Alert·시트 선(先)닫힘 현행 동작을 그대로 보존**한다. 이번엔 "어느 경로로 만들어도 코드를 본다"만 고친다.
- U24(입력 변경 시 에러 클리어·실패 후 코드 비우기) — JoinLogScreen을 만지지만 에러 표시 로직은 손대지 않는다.
- U14(백그라운드 refresh 실패가 화면을 통째로 error로 덮음) — U1 복귀 경로에서 관찰될 수 있으나 이번 범위 아님(§6에 기록만).
- U41(부트스트랩 타임아웃·취소), U49(로그인 실패 문구 레이아웃) — U3와 인접하지만 별도 항목.
- `AUTH_ERROR_MESSAGES[NetworkFailed]` 문구 자체("네트워크 연결을 확인해 주세요.")는 **변경하지 않는다**(§9 결정 D3).
- DB·RPC·Edge Function 변경 0. 킷 시안 변경 0. 신규 라우트 0.

## 3. 데이터 · API 계약

**테이블/컬럼/RLS/RPC 변경: 없음.** 이 스프린트는 클라이언트 배선·문구만 바꾼다. `create_room`·`join_room` RPC와 `useCreateRoom`/`useJoinRoom` 반환 shape은 불변.

### 3-1. 기존 계약(변경 없음 — 개발자가 추측하지 않도록 명시)

```ts
// src/features/room/useCreateRoom/useCreateRoom.ts
createRoom(): Promise<{ roomId: string; inviteCode: string; mode: RoomMode }>
// 실패 시 error state에 한국어 메시지 세팅 + 원본 에러 throw

// src/navigation/routes/routes.ts
[Routes.RoomCreated]: { roomId: string; code: string }   // ⚠️ inviteCode → code 로 이름이 바뀌는 지점
[Routes.JoinLog]: undefined

// src/features/room/useMyLogs (useOneShotQuery 기반)
refresh(): Promise<void>   // ⚠️ reject하지 않는다 — 실패는 내부에서 state.error로 흡수(useOneShotQuery.ts:45-53)

// src/features/room/code
isInviteCodeComplete({ code: string }): boolean          // 길이 6 판정 단일 출처
normalizeInviteCodeInput({ raw: string }): string        // 정규화 단일 출처(자체 정규식 재작성 금지)
```

### 3-2. 신규 — `useStartLogFlow` (U1의 핵심 계약)

U1의 근본 원인은 "같은 행동이 두 곳에 따로 구현돼 있었다"는 것이다. 배선을 복사해 고치면 같은 방식으로 또 갈라진다 → **단일 훅으로 추출**하고 두 소비처가 이를 호출한다.

```ts
// 신규: src/navigation/useStartLogFlow/useStartLogFlow.ts  (+ index.ts 배럴)
export type StartLogFlow = {
  /** 로그 생성 → 목록 갱신 → RoomCreated 축하화면. 실패 시 Alert만(throw 하지 않음 — 호출부 void 안전). */
  createLog: () => Promise<void>;
  /** 초대코드 입력 화면으로 이동. */
  goToJoin: () => void;
  /** 생성 진행 중(useCreateRoom.loading) — 호출부가 CTA/시트 행 비활성에 사용. */
  creating: boolean;
};

export const useStartLogFlow = (): StartLogFlow;
```

내부 배선(현행 `PlusHeaderButton.tsx:27-43`을 그대로 옮긴다 — 관찰 가능한 행동 불변):

```ts
const { roomId, inviteCode } = await createRoom();   // 무인자 호출(p_mode 미지정 → default 'couple')
await myLogs.refresh();                              // reject 없음 → navigate가 항상 뒤따른다
navigation.navigate(Routes.RoomCreated, { roomId, code: inviteCode });
// catch: Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err })) — navigate/refresh 없음
```

의존: `useCreateRoom`, `useMyLogsContext`, `useNavigation<NavigationProp<AppStackParamList>>`.
컨벤션: 화살표 함수, `useCallback` 미사용, 인자 없는 훅(named-object 규칙은 인자가 있을 때 적용).

### 3-3. U1 소비처 계약

| 소비처 | 트리거 | 호출 | 킷 근거 |
|---|---|---|---|
| `PlusHeaderButton` | 헤더 + → AddSheet | 시트행 → `createLog` / `goToJoin` | `mk-home.jsx:189-198` |
| `LogListScreen` 빈 상태 | "새 로그 만들기" 카드 | `createLog` (시트 없이 직행) | `mk-home.jsx:133` `EmptyLogs onCreate` → `index.html:116` `doCreate` |
| `LogListScreen` 빈 상태 | "초대코드로 입장" 카드 | `goToJoin` | `index.html:117` `doJoin` |
| `LogListScreen` 하단 CTA | "새 로그 시작하기" | `setSheetOpen(true)` (**생성 아님**) | `mk-home.jsx:120` `onClick={onAdd}`, `SPEC.md:36` |
| `LogListScreen` AddSheet | 시트 두 행 | `createLog` / `goToJoin` | `SPEC.md:41-43` |

`AddSheet` props 계약은 불변: `{ visible, onClose, onCreate, onJoin, creating }`.

### 3-4. U2 계약 (`JoinLogScreen`)

```tsx
<Screen edges={['left','right']}>
  <SubBar title="초대코드 입력" onBack={…} />
  <KeyboardAvoidingView
    testID="join-kav"
    style={styles.flex}                                    // flex: 1
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    <ScrollView testID="join-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={…}>
      …  {/* 콘텐츠·패딩·카피 전부 불변 */}
    </ScrollView>
  </KeyboardAvoidingView>
</Screen>
```

```ts
// 6자 완성 시 키보드 자동 내림. 완성 판정은 isInviteCodeComplete 단일 출처(길이 6 하드코딩 금지).
const handleChangeCode = (next: string) => {
  setCode(next);
  if (isInviteCodeComplete({ code: next })) Keyboard.dismiss();
};
```

`CodeInput` 자체는 **변경 0**(`value`/`onChangeText` 계약 유지, `autoFocus` 유지). 셀 탭 시 `inputRef.focus()` 재포커스 경로도 유지 — 코드를 고치려는 사용자의 복귀 수단이다.

### 3-5. U3 계약 (`features/auth/errors`)

```ts
// src/features/auth/errors/errors.ts — 추가
AuthErrorToken.BootstrapFailed = 'BootstrapFailed';
AUTH_ERROR_MESSAGES[AuthErrorToken.BootstrapFailed] = '잠시 후 다시 시도해 주세요.';

/** 네트워크 계열 실패인지 판정(unknown 안전 — 비-Error/문자열/null도 throw 없이 false). */
export const isNetworkAuthError = ({ error }: { error: unknown }): boolean;

/** 원문 노출 금지. 네트워크면 NetworkFailed 메시지, 그 외 BootstrapFailed 메시지. 항상 문자열 반환. */
export const messageForAuthFailure = ({ error }: { error: unknown }): string;
```

판정 규칙(enum-style 상수로 선언):

```ts
const NETWORK_ERROR_NAME = 'AuthRetryableFetchError';   // supabase-js 재시도 가능 fetch 실패
const NETWORK_ERROR_HINTS = ['network request failed', 'failed to fetch', 'network error', 'timeout', 'timed out'];
// name 일치 OR message.toLowerCase()가 힌트 중 하나를 포함 → 네트워크
```

`AuthProvider` 배선 변경 2곳:

| 위치 | 현행 | 변경 후 |
|---|---|---|
| `AuthProvider.tsx:212-216` 부트스트랩 catch | `err.message` 원문 → `state.error.message` | `console.warn('[auth] 부트스트랩 실패', err)` + `messageForAuthFailure({ error: err })` |
| `AuthProvider.tsx:227-233` 리스너 프로필 보장 catch | `err.message` 원문 → `loginError` | `console.warn('[auth] 프로필 보장 실패', err)` + `messageForAuthFailure({ error: err })` |

폴백 문자열 `'알 수 없는 인증 오류'`·`'프로필 초기화에 실패했습니다.'`는 제거한다(매핑이 비-Error도 처리하므로 도달 불가 + 후자는 해요체 위반).
`AuthErrorView`·`AuthGate`는 **변경 0**(message prop만 소비). 배럴 `src/features/auth/index.ts`에 신규 export 2개 추가.

## 4. 화면 · UX

| 화면 | 변경 | 상태별 |
|---|---|---|
| `LogListScreen` (빈 상태) | 두 갈래 카드 → `createLog`/`goToJoin`. **생성 성공 시 축하화면으로 이동**(현행: 제자리 유지) | 생성 중 = 카드 `opacity 0.6` + 비활성(현행 유지) |
| `LogListScreen` (목록) | 하단 CTA = **AddSheet 오픈**(현행: 즉시 생성). 시트 마운트 추가 | 생성 중 = CTA `opacity 0.5` + 비활성(현행 유지) |
| `PlusHeaderButton` | 내부 배선만 훅으로 이전 — 렌더/행동 불변 | 불변 |
| `JoinLogScreen` | KAV 래핑 + tap 관통 + 6자 시 키보드 내림 | 로딩/에러/비활성 표시 불변 |
| `AuthErrorView` | 코드 변경 0, **표시 문구만 한국어로** | "연결에 문제가 있어요" + 매핑 메시지 + "다시 시도" |

**비주얼·토큰 변경 0.** 신규 스타일·신규 컴포넌트 없음(AddSheet·Sheet·Card 기존 프리미티브 재사용). 새 문구는 `AUTH_ERROR_MESSAGES` 두 개뿐이며 해요체.

## 5. 작업 목록

### U1 — 생성 경로 통일 (원칙 3·7·10)

- [ ] **T1** `useStartLogFlow` 훅 신설(`src/navigation/useStartLogFlow/`)
      — 인수조건: `createLog()` 호출 시 `createRoom()`(무인자) → `refresh()` → `navigate(Routes.RoomCreated, { roomId, code: inviteCode })` 순으로 진행되고, `createRoom` 실패 시 `Alert('로그를 만들지 못했어요', mapRoomError)`만 발생하며 `navigate`·`refresh`는 호출되지 않는다 — **원칙 3(행동의 결과가 즉시 보인다)**
      — 테스트: `useStartLogFlow.spec.tsx` — renderHook + navigate/createRoom/refresh 모킹으로 성공·실패 두 경로 단언
- [ ] **T2** `PlusHeaderButton`을 T1 훅 소비로 리팩터(시트 open/close 상태는 로컬 유지)
      — 인수조건: `PlusHeaderButton.spec.tsx`를 **한 줄도 고치지 않고** 전량 green — 리팩터가 관찰 가능한 행동을 바꾸지 않았다는 증거
      — 테스트: 기존 spec 무수정 통과
- [ ] **T3** `LogListScreen` 빈 상태 두 갈래를 T1 훅에 연결
      — 인수조건: 로그 0개 화면에서 "새 로그 만들기"를 누르면 생성 직후 `RoomCreated{roomId, code}`로 이동해 **초대코드가 화면에 보인다**(현행은 제자리) — **원칙 3·7(짝꿍을 부를 수단을 즉시 제공)**
      — 테스트: `LogListScreen.spec.tsx` — `navigate`가 `Routes.RoomCreated, { roomId:'r1', code:'ABCDEF' }`로 호출됨
- [ ] **T4** `LogListScreen` 하단 CTA를 AddSheet 오픈으로 교체 + 시트 마운트
      — 인수조건: "새 로그 시작하기"를 누르면 시트 제목 "어떻게 시작할까요?"와 두 행이 뜨고 **`createRoom`은 호출되지 않는다**(킷 `mk-home.jsx:120`·`SPEC.md:36`) — **원칙 10(다음 행동을 고르게 한다)**
      — 테스트: press 후 시트 텍스트 존재 + `createRoom` 미호출 단언
- [ ] **T5** LogList AddSheet의 두 행을 훅에 배선
      — 인수조건: 시트 "새 로그 만들기" → 시트가 닫히고 `RoomCreated{roomId, code}`로 이동 / "초대코드로 들어가기" → 시트가 닫히고 `JoinLog`로 이동
      — 테스트: 두 행 각각 press → navigate 인자 + 시트 텍스트 소멸 단언
- [ ] **T6** 생성 중 중복 방지 유지
      — 인수조건: `useCreateRoom.loading === true`면 하단 CTA와 시트 "새 로그 만들기" 행이 비활성이라 press해도 `createRoom`이 추가 호출되지 않는다
      — 테스트: `loading:true` 모킹 후 press → `createRoom` 호출 0

### U2 — 초대코드 입력 첫 탭 동작 (원칙 2·3)

- [ ] **T7** `ScrollView`에 `keyboardShouldPersistTaps="handled"` + `testID="join-scroll"`
      — 인수조건: 키보드가 떠 있어도 "들어가기" **첫 탭이 `joinRoom`을 호출한다**(현행은 첫 탭이 키보드 닫기에 소비) — **원칙 2(진입 마찰 제거)·3(탭 즉시 반응)**
      — 테스트: `getByTestId('join-scroll').props.keyboardShouldPersistTaps === 'handled'` + press 1회로 `joinRoom` 1회
- [ ] **T8** `KeyboardAvoidingView`(iOS `padding`, Android `undefined`) 래핑 + `testID="join-kav"`
      — 인수조건: iOS에서 키보드가 올라와도 "들어가기" 버튼에 도달할 수 있다(작은 화면 가림 해소) — **원칙 3**
      — 테스트: `join-kav`의 `behavior`가 iOS `'padding'` / Android `undefined`(Platform 모킹)
- [ ] **T9** 6자 완성 시 `Keyboard.dismiss()`
      — 인수조건: 6번째 글자가 채워지는 순간 키보드가 내려가고 버튼이 활성 상태로 노출된다. 5자 이하에서는 내려가지 않는다 — **원칙 3(다음 행동을 가리지 않는다)**
      — 테스트: `Keyboard.dismiss` 스파이 — 6자 시 1회 / 5자 시 0회 / 지웠다 다시 채우면 2회
- [ ] **T10** 화면 카피·패딩·에러 표시 회귀 0
      — 인수조건: 기존 `JoinLogScreen.spec.tsx` 전량 green(성공 토스트 + `replace(LogScreen)`, 실패 시 인라인 에러 유지·`replace` 0)
      — 테스트: 기존 spec 무수정 통과

### U3 — 인증 실패 카피 한국어화 (원칙 5·10)

- [ ] **T11** `isNetworkAuthError` + `messageForAuthFailure` + `BootstrapFailed` 토큰 추가(`features/auth/errors`), 배럴 export
      — 인수조건: 임의의 `unknown`(Error·plain object·문자열·null)을 넣어도 throw 없이 `AUTH_ERROR_MESSAGES`의 한국어 값 하나를 반환한다 — **원칙 5(시스템 용어 금지)**
      — 테스트: `errors.spec.ts` — 네트워크/비네트워크/비-Error 입력 매트릭스
- [ ] **T12** `AuthProvider` 부트스트랩 catch 배선 교체 + `console.warn` 원문 기록
      — 인수조건: `getSession()`이 `Error('Network request failed')`로 실패하면 화면 문구가 "네트워크 연결을 확인해 주세요."이고, 그 외 실패는 "잠시 후 다시 시도해 주세요."다. **영어 원문은 화면에 나타나지 않고 `console.warn`에만 남는다** — **원칙 5·10**
      — 테스트: `AuthProvider.spec.tsx` — `state.message` 단언 2종 + `console.warn` 스파이가 원본 에러를 받았는지
- [ ] **T13** 리스너 프로필 보장 실패 catch 동일 처리 + 폴백 문자열 2개 제거
      — 인수조건: `profiles` upsert 실패 시 `loginError`가 원문이 아니라 매핑 메시지이고, `'프로필 초기화에 실패했습니다.'`(해요체 위반)는 코드베이스에서 사라진다
      — 테스트: upsert error 모킹 → `loginError` 단언 + `grep` 회귀(QA)
- [ ] **T14** 전체 회귀: `npm test` green(스프린트 완료 기준)
      — 인수조건: 수정이 필요한 기존 단언은 **AuthProvider.spec.tsx:139 하나뿐**(원문 `'연결 실패'` → 매핑 메시지). 그 외 spec 수정이 필요하면 계약 위반을 의심하고 planner에 보고
      — 테스트: `npm test`

## 5-1. 테스트 케이스 (TDD — Red → Green → Refactor)

단위 대상: 유틸(`errors.ts`)·훅(`useStartLogFlow`)·화면(`LogListScreen`·`JoinLogScreen`·`PlusHeaderButton`·`AuthProvider`).
모킹 대상: `@/lib/supabase`, `@react-navigation/native`, `react-native` `Alert`/`Keyboard`/`Platform`.
스모크(단위 아님): 실기기 키보드 첫 탭 반응, 작은 화면(iPhone SE) 버튼 가림, 오프라인 콜드스타트.

### `useStartLogFlow.spec.tsx` (신설)

| 유형 | 케이스 | 기대 |
|---|---|---|
| 정상 | `createLog()` 성공 | `createRoom()` 무인자 1회 → `refresh` 1회 → `navigate(RoomCreated, { roomId:'r1', code:'ABCDEF' })` |
| 정상 | `goToJoin()` | `navigate(Routes.JoinLog)` 1회, `createRoom` 0 |
| 경계 | `useCreateRoom.loading = true` | 훅이 `creating: true`를 그대로 노출 |
| 경계 | `createLog()`가 반환한 promise | reject하지 않는다(호출부 `void` 안전) |
| 실패 | `createRoom` reject | `Alert.alert('로그를 만들지 못했어요', mapRoomError 결과)` 1회 + `navigate` 0 + `refresh` 0 |
| 실패 | `refresh` reject(방어적) | `Alert` 1회 + `navigate` 0 — 계약상 refresh는 reject하지 않지만 흡수 경로를 잠근다 |

### `LogListScreen.spec.tsx` (기존 수정 + 추가)

| 유형 | 케이스 | 기대 |
|---|---|---|
| 정상 | 빈 상태 "새 로그 만들기" | `createRoom` → `refresh` → `navigate(RoomCreated, { roomId, code })` — **기존 273행 테스트를 navigate 단언까지 확장(Red 시작점)** |
| 정상 | 빈 상태 "초대코드로 입장" | `navigate(JoinLog)` (회귀) |
| 정상 | 하단 "새 로그 시작하기" | 시트 "어떻게 시작할까요?"·두 행 표시 + **`createRoom` 호출 0** — **기존 382행 테스트를 대체** |
| 정상 | 시트 "새 로그 만들기" | `navigate(RoomCreated, { roomId:'r2', code:'ZZZZZZ' })` + 시트 텍스트 소멸 |
| 정상 | 시트 "초대코드로 들어가기" | `navigate(JoinLog)` + 시트 텍스트 소멸 |
| 경계 | `creating:true` | CTA press해도 시트 미오픈, `createRoom` 0 |
| 실패 | `createRoom` reject | `Alert` 1회 + `navigate` 0, 화면 유지(목록 그대로) |

### `JoinLogScreen.spec.tsx` (추가)

| 유형 | 케이스 | 기대 |
|---|---|---|
| 정상 | ScrollView prop | `keyboardShouldPersistTaps === 'handled'` |
| 정상 | 키보드 노출 상태 첫 탭 | press 1회 → `joinRoom({ code })` 1회 |
| 정상 | iOS KAV | `behavior === 'padding'` |
| 경계 | Android KAV | `behavior === undefined` |
| 정상 | 6자 입력 완료 | `Keyboard.dismiss` 1회 |
| 경계 | 5자 입력 | `Keyboard.dismiss` 0회 |
| 경계 | 6자 → 1자 삭제 → 다시 6자 | `Keyboard.dismiss` 2회(재완성마다) |
| 경계 | 혼동문자 포함 붙여넣기(정규화 후 6자 미만) | `Keyboard.dismiss` 0회, 버튼 비활성 |
| 실패 | `joinRoom` reject | 인라인 에러 유지, `replace` 0, 토스트 0 (회귀) |

### `errors.spec.ts` (신설 또는 확장)

| 유형 | 입력 | 기대 |
|---|---|---|
| 정상 | `new TypeError('Network request failed')` | `'네트워크 연결을 확인해 주세요.'` |
| 정상 | `{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }` | 네트워크 메시지 |
| 경계 | `new Error('NETWORK REQUEST FAILED')`(대문자) | 네트워크 메시지(대소문자 무시) |
| 경계 | `null` / `undefined` / `'boom'` / `42` / `{}` | `'잠시 후 다시 시도해 주세요.'`, throw 0 |
| 실패군 | `new Error('invalid claim: missing sub claim')` | `'잠시 후 다시 시도해 주세요.'` |
| 불변 | 임의 입력 | 반환값이 항상 `AUTH_ERROR_MESSAGES`의 값 집합에 속한다(원문 누출 잠금) |

### `AuthProvider.spec.tsx` (기존 1건 수정 + 추가)

| 유형 | 케이스 | 기대 |
|---|---|---|
| 실패 | `getSession` throw `Error('연결 실패')` | `state.message === '잠시 후 다시 시도해 주세요.'` — **기존 139행 단언 교체(의도된 계약 변경)** |
| 실패 | `getSession` throw `TypeError('Network request failed')` | `state.message === '네트워크 연결을 확인해 주세요.'` |
| 실패 | 위 두 경우 | `console.warn`이 **원본 에러 객체**를 인자로 1회 이상 받는다 |
| 실패 | 리스너 경로 upsert error | `loginError`가 매핑 메시지, `state.status === 'unauthenticated'` |
| 회귀 | `retry()` 후 정상 세션 | `authenticated` 진입(기존 유지) |

> **단언 유효성 표본 확인**(메모 `string-assertion-dead-locks`): T7·T8의 prop 단언과 T12의 문구 단언은 구현을 되돌렸을 때 실제로 red가 되는지 각 1건씩 뮤테이션으로 확인한다. 특히 `keyboardShouldPersistTaps`는 기본값(`'never'`)과 다르므로 삭제 시 반드시 red여야 한다.

## 6. 엣지케이스

**빈 상태 / 전이**
- 로그 0개 → 생성 → 축하화면 "나중에" → 목록에 새 로그 1장(빈 상태 탈출). `refresh` 완료 후 navigate이므로 복귀 시 목록은 최신.
- 축하화면 "로그 열기" → LogScreen replace(기존 `RoomCreatedRoute` 동작, 변경 0).
- 하단 CTA → 시트 → backdrop 탭으로 닫기: 아무것도 생성되지 않는다(현행 CTA는 즉시 생성이라 취소 수단이 없었다 — U1이 부수적으로 고치는 것).

**동시성(커플 2명)**
- 두 명이 각자 생성 → 서로 다른 room. 새 코드가 상대 화면에 자동으로 뜨지 않음(Realtime 없음, 정상).
- 파트너가 방금 만든 로그에 즉시 join → `memberCount` 변화는 다음 `refresh`(재포커스)에서 반영.
- 한 명이 축하화면을 보는 동안 다른 기기에서 join → 정원(2) 초과 아님, 코드 유효.

**중복 실행**
- 생성 중 재탭: ① `creating`으로 CTA·시트 행·헤더 + 버튼 비활성 ② 시트가 먼저 닫혀 재탭 표면 소멸. 이중 가드 유지.
- 빈 상태 카드 연타 → 첫 press로 `creating:true` 전이, 이후 press는 `onPress: undefined`.

**네트워크 실패**
- `createRoom` 실패 → Alert, 화면 유지, 목록 불변. (시트는 이미 닫혀 있음 — U42 범위)
- `createRoom` 성공 + `refresh` 실패 → `MyLogs`가 error state로 전이해 축하화면에서 복귀했을 때 목록이 전체화면 에러로 보일 수 있다. **U14 범위, 이번 스프린트에서 고치지 않음.** navigate 자체는 정상 수행되므로 초대코드는 반드시 보인다(U1 목표 달성).
- `join_room` `TOO_MANY_ATTEMPTS`(실패 10회/1시간, invite-code-hardening) → 인라인 에러 문구 그대로. U2는 에러 표시 로직 미변경.

**입력 한계 / 키보드**
- 붙여넣기로 6자 한 번에 입력 → `Keyboard.dismiss` 1회, 버튼 활성.
- 키보드가 내려간 뒤 코드를 고치려는 경우 → 셀 영역 탭으로 재포커스(`CodeInput` `Pressable`). `keyboardShouldPersistTaps="handled"`가 이 탭을 막지 않는지 실기기 확인 필요.
- 하드웨어 키보드/외장 키보드 연결 상태에서 `Keyboard.dismiss()`는 무해(no-op).

**인증**
- 오프라인 콜드스타트 → "연결에 문제가 있어요" + "네트워크 연결을 확인해 주세요." + 다시 시도.
- 비-Error throw(문자열·plain object) → `"[object Object]"`·`undefined`가 화면에 절대 나타나지 않는다.
- OAuth 딥링크 복구 경로(`subscribeOAuthCallback` → `failLogin`)는 이미 토큰 매핑을 쓰므로 **변경 0** — 중복 매핑을 새로 넣지 않는다.
- `retry()` 후에도 실패 반복 → 같은 매핑 문구가 다시 표시(원문 누출 없음).

**권한·RLS**: DB 미변경이므로 해당 없음.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. `useCreateRoom` 반환 `{ roomId, inviteCode }` ↔ `useStartLogFlow`의 `navigate(..., { roomId, code })` — **필드명이 `inviteCode` → `code`로 바뀌는 유일한 지점.** 오타 시 축하화면 코드가 빈 문자열.
2. `useStartLogFlow` ↔ `AppStackParamList[Routes.RoomCreated]` 타입(`{ roomId: string; code: string }`).
3. `RoomCreatedRoute`(route.params 소비) ↔ `RoomCreatedScreen`(`inviteCode` prop) ↔ `InviteCodeCard` — 코드가 실제로 렌더되는 끝단까지.
4. `LogListScreen` ↔ `AddSheet` props(`visible`/`onClose`/`onCreate`/`onJoin`/`creating`) — `creating` 전달 누락 시 중복 생성 가드가 사라진다.
5. `PlusHeaderButton` ↔ `useStartLogFlow` — 리팩터 전후 행동 동일성. 기존 spec **무수정 green**이 판정 기준.
6. 두 소비처(`LogListScreen`·`PlusHeaderButton`)가 **같은 훅을 쓰는지** — 어느 한쪽이 배선을 로컬로 복제하면 U1이 재발한다(이 스프린트의 근본 원인).
7. `JoinLogScreen` ↔ `CodeInput`(`value`/`onChangeText` 계약 불변, `autoFocus` 유지) ↔ `normalizeInviteCodeInput`.
8. `JoinLogScreen`의 완성 판정 ↔ `isInviteCodeComplete` — 길이 6이 두 곳에 하드코딩되지 않았는지(버튼 활성 조건과 키보드 내림 조건이 같은 출처).
9. `Screen`/`SubBar`/safe-area ↔ 신규 `KeyboardAvoidingView` — 래핑으로 레이아웃(패딩·insets.bottom)이 변하지 않았는지.
10. `AuthProvider` ↔ `messageForAuthFailure` ↔ `AuthGate` ↔ `AuthErrorView(message)` — 원문이 어느 단계에서도 살아남지 않는지.
11. `AuthProvider.loginError` ↔ `LoginScreen` 인라인 에러 — 신규 문구가 기존 로그인 실패 문구와 충돌·중복되지 않는지.
12. `features/auth/errors/errors.ts` ↔ `features/auth/index.ts` 배럴 — 신규 export 누락 시 소비처가 깊은 경로로 import(컨벤션 위반).
13. 회귀 grep: `src/` 전체에서 `'프로필 초기화에 실패했습니다.'`·`'알 수 없는 인증 오류'` 잔존 0.

## 8. 비용 가드레일 체크

- **네트워크 호출 증감 0.** `createRoom`(RPC 1회) + `refresh`(list_my_rooms 1회)는 현행과 동일 횟수. 축하화면 경유가 추가 조회를 유발하지 않는다(코드는 생성 응답에서 그대로 전달).
- **Kakao Local API 호출 0** — 이 스프린트는 지도·검색을 건드리지 않는다(디바운스/캐싱 해당 없음).
- **이미지 업로드·압축 해당 없음.**
- **폴링·Realtime 신설 0.** `useOneShotQuery` 정책(진입 1회 + 명시적 refresh) 유지.
- **AWS 리소스 0**, Supabase 스키마·함수 변경 0 → 무료 티어 사용량 변화 없음.
- `console.warn`은 개발/런타임 로그일 뿐 외부 전송 없음(원격 로깅 도입 아님).

## 9. 기획 결정 · 개발자에게 남기는 플래그

- **D1 — 배선 복제 대신 훅 추출.** U1의 원인이 "두 곳에 각자 구현"이므로 `LogListScreen`에 `PlusHeaderButton` 코드를 복사하면 같은 방식으로 다시 갈라진다. `useStartLogFlow` 단일 출처로 만들고 두 소비처가 호출한다(§3-2). QA 경계면 6이 이 결정을 검증한다.
- **D2 — 하단 CTA는 "생성"이 아니라 "시트 오픈"이다.** 킷 `mk-home.jsx:120`이 `onAdd`(시트)이고 `SPEC.md:36`도 "AddSheet 열림"이다. 즉시 생성으로 두면 취소 수단이 없는 파괴적 기본값이 된다. 빈 상태 카드만 킷 `doCreate`대로 직행한다(`index.html:116`).
- **D3 — 네트워크 문구는 기존 `AUTH_ERROR_MESSAGES[NetworkFailed]`("네트워크 연결을 확인해 주세요.")를 그대로 재사용한다.** 백로그 U1~U3 행의 "인터넷 연결을 확인해 주세요"는 의도를 적은 표현이고, 기존 문구를 바꾸면 범위 밖 화면(LoginScreen 인라인 에러)의 카피와 spec 2곳(`LoginScreen.spec.tsx:82,84`, `AuthGate.spec.tsx:135,139`)이 함께 흔들린다. **같은 원인에는 같은 문구**가 원칙 5에도 부합한다. 리더가 "인터넷"을 원하면 `errors.ts` 한 줄 + spec 2파일 수정으로 끝나는 저비용 변경이니 지시만 주면 반영한다.
- **D4 — 비-네트워크 실패는 신규 토큰 `BootstrapFailed`("잠시 후 다시 시도해 주세요.")를 쓴다.** 기존 `TokenExchangeFailed`("로그인에 실패했어요. …")를 재사용하면 세션 복원·프로필 보장 실패에 "로그인에 실패했어요"라는 사실과 다른 카피가 붙는다(원칙 5). 매핑 테이블·`messageForAuthError`는 그대로 재사용하므로 "기존 매핑 재사용" 요건은 충족한다.
- **D5 — 수정이 허용된 기존 spec은 `AuthProvider.spec.tsx:139` 한 줄뿐.** 다른 spec을 고쳐야 green이 된다면 의도치 않은 행동 변경이므로 planner에 보고한다.
- **D6 — Alert·시트 선닫힘·전체화면 error 강등은 이번에 손대지 않는다**(U42·U14). 스프린트를 3건으로 유지하기 위한 의도적 out-of-scope다.
- **디바이스 스모크 항목**(단위로 못 잡음): ① 키보드 노출 상태에서 "들어가기" 첫 탭 ② iPhone SE급 화면에서 버튼 가림 여부 ③ 6자 완성 후 셀 탭 재포커스 ④ 오프라인 콜드스타트 시 AuthErrorView 문구.
