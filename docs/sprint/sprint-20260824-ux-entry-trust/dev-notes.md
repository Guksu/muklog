# Dev Notes — 진입·생성 신뢰 3종 (sprint-20260824-ux-entry-trust)

> 구현 범위: plan.md §5 T1~T14 (U1·U2·U3). DB·RPC·Edge Function 변경 **0**, 비주얼·토큰 변경 **0**, 신규 라우트 **0**.
> 최종 상태: `npm test` **207 suites / 2213 tests green**, `npx tsc --noEmit` 통과.

## 1. 변경 파일

**신설**

| 파일 | 내용 |
|---|---|
| `src/navigation/useStartLogFlow/useStartLogFlow.ts` | U1 핵심 — 생성/입장 배선 단일 출처 훅 |
| `src/navigation/useStartLogFlow/index.ts` | 배럴 |
| `src/navigation/useStartLogFlow/useStartLogFlow.spec.tsx` | 8 케이스 |
| `src/features/auth/errors/errors.spec.ts` | 13 케이스 (신설 — 기존에 auth errors spec 부재) |

**수정**

| 파일 | 내용 |
|---|---|
| `src/navigation/PlusHeaderButton/PlusHeaderButton.tsx` | 내부 배선 → 훅 소비. 시트 open/close만 로컬 유지. **spec 무수정 green** |
| `src/navigation/screens/LogListScreen/LogListScreen.tsx` | 훅 소비 + 하단 CTA를 AddSheet 오픈으로 교체 + 시트 마운트 |
| `src/navigation/screens/LogListScreen/LogListScreen.spec.tsx` | 273행 확장 · 382행 대체 · 시트 describe 신설 |
| `src/navigation/screens/JoinLogScreen/JoinLogScreen.tsx` | KAV 래핑 + `keyboardShouldPersistTaps` + 6자 완성 시 `Keyboard.dismiss` |
| `src/navigation/screens/JoinLogScreen/JoinLogScreen.spec.tsx` | U2 describe 신설(8 케이스) |
| `src/features/auth/errors/errors.ts` | `BootstrapFailed` 토큰·문구 + `isNetworkAuthError` + `messageForAuthFailure` |
| `src/features/auth/index.ts` | 신규 export 2종 배럴 추가 |
| `src/features/auth/AuthProvider/AuthProvider.tsx` | catch 2곳 배선 교체 + `console.warn` 원문 기록 + 폴백 문자열 2개 제거 |
| `src/features/auth/AuthProvider/AuthProvider.spec.tsx` | 139행 단언 교체(D5 허용분) + U3 describe 신설(5 케이스) |
| `src/navigation/screens/RoomCreatedRoute/RoomCreatedRoute.tsx` | **주석만** — 진입 출처가 PlusHeaderButton → useStartLogFlow로 바뀐 사실 반영(코드 변경 0) |

## 2. 계약 shape (구현 확정본)

```ts
// src/navigation/useStartLogFlow/useStartLogFlow.ts — plan §3-2 그대로
export type StartLogFlow = {
  createLog: () => Promise<void>;   // reject 없음(호출부 void 안전)
  goToJoin: () => void;
  creating: boolean;
};
export const useStartLogFlow = (): StartLogFlow;

// src/features/auth/errors/errors.ts — plan §3-5 그대로
AuthErrorToken.BootstrapFailed = 'BootstrapFailed';
AUTH_ERROR_MESSAGES[BootstrapFailed] = '잠시 후 다시 시도해 주세요.';
export const isNetworkAuthError = ({ error }: { error: unknown }): boolean;
export const messageForAuthFailure = ({ error }: { error: unknown }): string;
```

`AddSheet` props(`visible`/`onClose`/`onCreate`/`onJoin`/`creating`)·`useCreateRoom`·`useJoinRoom`·`CodeInput`·라우트 파라미터 타입은 전부 **불변**.

## 3. 생산자 ↔ 소비자 매핑 (plan §7 경계면 13개)

| # | 경계면 | 생산자 | 소비자 | 상태 |
|---|---|---|---|---|
| 1 | `inviteCode` → `code` 필드명 전환 | `useCreateRoom/useCreateRoom.ts:41` (`{ roomId, inviteCode, mode }` 반환) | `useStartLogFlow/useStartLogFlow.ts:38` 구조분해 → `:41` `navigate(Routes.RoomCreated, { roomId, code: inviteCode })` | ✅ 유일 지점. spec `useStartLogFlow.spec.tsx:64-68`이 `{ roomId:'r1', code:'ABCDEF' }` 정확 일치 단언 |
| 2 | 라우트 파라미터 타입 | `routes/routes.ts:56` `[Routes.RoomCreated]: { roomId: string; code: string }` | `useStartLogFlow.ts:41` | ✅ `tsc --noEmit` 통과가 증거 |
| 3 | 코드 렌더 끝단 | `RoomCreatedRoute.tsx:18` `route.params.{roomId, code}` | `RoomCreatedRoute.tsx:23` → `RoomCreatedScreen.tsx:55` `<InviteCodeCard code={inviteCode} />` | ✅ 코드 변경 0(주석만). 기존 spec green |
| 4 | AddSheet props | `LogListScreen.tsx:471-477` (`visible`/`onClose`/`onCreate`/`onJoin`/`creating`) | `AddSheet/AddSheet.tsx:77-94` | ✅ `creating` 전달 누락을 잡는 spec: `LogListScreen.spec.tsx` "시트가 열린 채 생성이 시작되면…" (뮤테이션 `creating={false}` → red 확인) |
| 5 | 리팩터 전후 행동 동일성 | `useStartLogFlow.ts:36-48` | `PlusHeaderButton.tsx:19,22-30,59-61` | ✅ `PlusHeaderButton.spec.tsx` **한 줄도 수정 없이** 6/6 green |
| 6 | 두 소비처가 같은 훅을 쓰는가 (D1, U1 근본 원인) | `useStartLogFlow` | `PlusHeaderButton.tsx:15,19` · `LogListScreen.tsx:42,393` | ✅ 배선 복제 0 — 두 파일 모두 `useCreateRoom`/`mapRoomError`/`Alert` 직접 import 없음(LogListScreen에서 3개 import 제거) |
| 7 | 코드 입력 계약 | `JoinLogScreen.tsx:99` `<CodeInput value={code} onChangeText={handleChangeCode} />` | `CodeInput/CodeInput.tsx:37` `onChangeText(normalizeInviteCodeInput({ raw }))` | ✅ `CodeInput` 변경 0(`autoFocus`·셀 탭 재포커스 유지). 정규화는 여전히 `normalizeInviteCodeInput` 단일 출처 |
| 8 | 길이 6 단일 출처 | `features/room/code/code.ts:35` `isInviteCodeComplete` | 버튼 활성 `JoinLogScreen.tsx:40` · 키보드 내림 `JoinLogScreen.tsx:45` | ✅ 두 조건이 같은 함수. 화면에 `6`/`length ===` 하드코딩 0 |
| 9 | safe-area/레이아웃 불변 | `Screen`(edges `['left','right']`) + `SubBar` | 신규 `KeyboardAvoidingView` `JoinLogScreen.tsx:66-71` (`styles.avoider = { flex: 1 }`, `:125`) | ✅ `contentContainerStyle`(패딩·`insets.bottom`) 값 변경 0 — KAV는 SubBar 아래 잔여 높이를 그대로 차지 |
| 10 | 원문 누출 차단 | `errors.ts:80-83` `messageForAuthFailure` | `AuthProvider.tsx:217`(부트스트랩) · `:236`(리스너) → `AuthGate` → `AuthErrorView(message)` | ✅ 반환값이 항상 `AUTH_ERROR_MESSAGES` 값 집합에 속함(`errors.spec.ts` 불변 케이스). 화면 원문 부재 단언 `AuthProvider.spec.tsx` "그 외 실패면…" |
| 11 | loginError ↔ LoginScreen | `AuthProvider.tsx:236` | `LoginScreen` 인라인 에러 | ✅ 신규 문구는 `BootstrapFailed` 1건뿐이고 기존 `TokenExchangeFailed`("로그인에 실패했어요…")와 구분됨(D4). `LoginScreen.spec.tsx`·`AuthGate.spec.tsx` 무수정 green |
| 12 | 배럴 export | `errors.ts:65,80` | `features/auth/index.ts:3-9` | ✅ `isNetworkAuthError`·`messageForAuthFailure` 추가. `AuthProvider`는 상대경로 `../errors` 유지(기존 패턴) |
| 13 | 회귀 grep | — | `src/` 전체 | ✅ `'프로필 초기화에 실패했습니다.'`·`'알 수 없는 인증 오류'` **잔존 0** |

## 4. 단언 유효성 — 뮤테이션 표본 확인

메모 `string-assertion-dead-locks` 대응. plan §5-1 하단 요구(T7·T8 prop, T12 문구) + 자체 추가 2건.

| 뮤테이션 | 결과 |
|---|---|
| `keyboardShouldPersistTaps="handled"` 삭제 | ✕ "스크롤뷰가 키보드 위 탭을 관통시킨다" red |
| KAV `behavior`를 항상 `undefined` | ✕ "iOS에서는 KAV behavior가 padding이다" red |
| 부트스트랩 catch를 `err.message`로 되돌림 | ✕ 3건 red(139행 교체분 + 네트워크/비네트워크 문구) |
| 리스너 catch를 `err.message`로 되돌림 | ✕ 2건 red |
| `AddSheet creating={false}` | ✕ "시트가 열린 채 생성이 시작되면…" red |
| 하단 CTA를 즉시 생성으로 되돌림 | ✕ 4건 red |

전부 복원 후 재검증: 2213/2213 green.

## 5. 계획 대비 편차 (3건, 전부 테스트 기법 — 계약·행동은 계획대로)

**D-1. T8 KAV `behavior` 단언 위치 변경 — plan §5-1 "`join-kav`의 behavior"**
plan은 `getByTestId('join-kav').props.behavior`를 상정했으나, `KeyboardAvoidingView`는 `behavior`를 내부에서 소비하고 호스트 `View`로 내려보내지 않는다. 그대로 두면 **Android 케이스가 항상 green인 거짓 통과**(undefined === undefined)가 된다. `screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior`로 합성 엘리먼트에서 읽도록 바꿨다. `testID="join-kav"`는 계약대로 유지하고, KAV 존재 자체를 확인하는 케이스를 별도로 하나 뒀다. 뮤테이션으로 iOS 케이스가 red가 되는 것 확인.

**D-2. T6 "creating 중 CTA press → createRoom 0"을 렌더 표면 단언으로 변경**
`fireEvent.press`는 대상에 핸들러가 없으면 조상을 타고 올라가며 `onPress` prop을 찾는데, **합성 컴포넌트(`CreateLogCta`)의 raw `onPress` prop까지 집어 `disabled` 가드를 우회**한다(실기기 동작과 무관한 테스트 라이브러리 특성). 그래서 press 단언 대신 "생성 중에는 `Card`가 `Pressable`이 아니라 `View`로 렌더된다"를 단언한다 — `accessibilityRole`이 `'button'` → `undefined`, `onStartShouldSetResponder` 부재. 평상시 `'button'`인 것도 같은 케이스에서 함께 확인해 양방향으로 잠갔다. 시트 행(`SheetAction`, `Pressable` + `disabled`)은 press 단언이 정상 동작해 그대로 뒀다.

**D-3. `RoomCreatedRoute.tsx` 주석 1블록 수정(계획에 없던 파일)**
"진입: PlusHeaderButton이 createRoom 성공 시…"라는 주석이 U1 이후 사실과 달라져(진입 경로가 3개, 배선 출처는 훅) 주석만 갱신했다. **코드 변경 0**, 기존 spec 무수정 green.

## 6. D5 준수 — 수정한 기존 spec

`AuthProvider.spec.tsx:139` 한 줄(`'연결 실패'` → `'잠시 후 다시 시도해 주세요.'`)이 계약 변경에 따른 유일한 수정. 그 외 기존 spec 파일은 **한 줄도 수정하지 않았다.**
`LogListScreen.spec.tsx`의 2건은 plan §5-1이 "확장(273행)·대체(382행)"로 명시한 이번 스프린트의 대상 단언이며, `PlusHeaderButton.spec.tsx`·`JoinLogScreen.spec.tsx` 기존 케이스·`LoginScreen.spec.tsx`·`AuthGate.spec.tsx`는 무수정 green(경계면 5·11의 판정 기준).

## 7. 미완 / 이월

- **U42·U14·U24·U41·U49** — plan §2 out-of-scope 그대로 손대지 않음. 특히 `createRoom` 성공 + `refresh` 실패 시 복귀 목록이 전체화면 error로 보일 수 있는 U14 경로는 **여전히 존재**(navigate는 정상 수행되므로 초대코드 노출이라는 U1 목표는 달성).
- **디바이스 스모크 4종**(단위로 못 잡음, plan §9): ① 키보드 노출 상태 "들어가기" 첫 탭 ② iPhone SE급 화면 버튼 가림 ③ 6자 완성 후 셀 탭 재포커스가 `keyboardShouldPersistTaps="handled"`에 막히지 않는지 ④ 오프라인 콜드스타트 `AuthErrorView` 문구.
- **비용**: 네트워크 호출 증감 0, Kakao 호출 0, 폴링·Realtime 신설 0, Supabase 스키마 변경 0. `console.warn`은 로컬 로그일 뿐 외부 전송 없음.

## 8. 테스트 수

| 스코프 | 결과 |
|---|---|
| 이번 스프린트가 만지는 9개 suite | 125 passed |
| `useStartLogFlow.spec.tsx` (신설) | 8 |
| `errors.spec.ts` (신설) | 13 |
| `LogListScreen.spec.tsx` | 32 (기존 26 + 신규 6) |
| `JoinLogScreen.spec.tsx` | 15 (기존 6 + 신규 9) |
| `AuthProvider.spec.tsx` | 24 (기존 19 + 신규 5) |
| `PlusHeaderButton.spec.tsx` | 6 (무수정) |
| **전체 `npm test`** | **207 suites / 2213 tests green** |
| `npx tsc --noEmit` | 통과 |
