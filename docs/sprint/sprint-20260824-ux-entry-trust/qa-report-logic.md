# QA Report — Logic (sprint-20260824-ux-entry-trust)

> 검증자: qa-logic · 2026-08-24
> 방식: 격리 worktree(base b46e8c4 = 본 트리 HEAD)에 본 트리 스냅샷을 동기화해 실행. 경계면 13개는 생산자/소비자 파일 양쪽을 직접 열어 교차 확인, dev-notes §3 주장은 전부 재검증.
> 검증 지문: `npm test` **207 suites / 2213 tests green** (동결 지문과 일치, 뮤테이션 원복 후 재확인) · `npx tsc --noEmit` 통과.

## 판정: **통과**

인수조건 T1~T14 전부 충족. 경계면 13개 전부 정합. 뮤테이션 표본(자체 3건, 계 8 red) 전부 유효. D5 실질 준수. 회귀 grep 0. DB·RPC·네트워크 호출 증감 0. 아래 발견 이슈는 전부 정보성(수정 요구 없음), 디바이스 스모크 4종만 미검증 이월.

---

## 1. 경계면 13개 교차검증 (plan §7)

| # | 경계면 | 생산자 근거 | 소비자 근거 | 판정 |
|---|---|---|---|---|
| 1 | `inviteCode` → `code` 전환점 | `useCreateRoom.ts:42` `{ roomId: obj.room_id, inviteCode: obj.invite_code, mode }` 반환 | `useStartLogFlow.ts:38` 구조분해 → `:41` `navigate(Routes.RoomCreated, { roomId, code: inviteCode })` | ✅ 유일 지점. **뮤테이션 M1**(`code: ''`)로 3 red 확인 — 훅 spec + 소비처 spec 양쪽에서 잠김 |
| 2 | 라우트 파라미터 타입 | `routes.ts:51` `[Routes.RoomCreated]: { roomId: string; code: string }` | `useStartLogFlow.ts:41` | ✅ tsc 통과 + `useStartLogFlow.spec.tsx:59-62` 정확 일치 단언 |
| 3 | 코드 렌더 끝단 | `RoomCreatedRoute.tsx:18` `route.params` → `:23` `<RoomCreatedScreen inviteCode={code}>` | `RoomCreatedScreen.tsx:55` `<InviteCodeCard code={inviteCode} />` | ✅ 코드 변경 0(주석만 — git diff로 확인, D-3), 기존 spec green |
| 4 | AddSheet props | `LogListScreen.tsx:471-477` 5개 prop 전부 전달(`creating` 포함) | `AddSheet.tsx:13-21,77` 동일 시그니처, `:86-87` create 행 `disabled={creating}` | ✅ `creating` 누락 시 red 되는 spec 존재("시트가 열린 채 생성이 시작되면…") |
| 5 | 리팩터 전후 행동 동일성 | `useStartLogFlow.ts:36-48` | `PlusHeaderButton.tsx:19` 훅 소비, `:22-30` 시트 행 배선 | ✅ `PlusHeaderButton.spec.tsx` **git 변경 목록에 없음(무수정)** + 전량 green |
| 6 | 두 소비처 = 같은 훅 (D1) | `useStartLogFlow` | `PlusHeaderButton.tsx:15,19` · `LogListScreen.tsx:42,393` | ✅ `src/` 전체에서 `useCreateRoom` 소비처는 `useStartLogFlow.ts` 단 1곳(grep, features/room 내부·spec 제외). LogListScreen에 `Alert`/`mapRoomError`/`useCreateRoom` 참조 0 — 배선 복제 없음 |
| 7 | 코드 입력 계약 | `JoinLogScreen.tsx:99` `<CodeInput value onChangeText={handleChangeCode}>` | `CodeInput.tsx:37` `onChangeText(normalizeInviteCodeInput({ raw }))`, `autoFocus`·셀 탭 재포커스 유지 | ✅ CodeInput 변경 0(git 변경 목록에 없음). 혼동문자 spec이 실제 정규화 경로(requireActual) 경유 |
| 8 | 길이 6 단일 출처 | `code.ts:9` `INVITE_CODE_LENGTH = 6`, `:32-33` `isInviteCodeComplete` | 버튼 활성 `JoinLogScreen.tsx:40` · 키보드 내림 `:45` — 같은 함수 | ✅ 화면 내 `length === 6` 하드코딩 0(grep — "6자리" 카피만 존재) |
| 9 | safe-area/레이아웃 불변 | `Screen edges={['left','right']}` + `SubBar` | KAV `JoinLogScreen.tsx:66-71`(`avoider: {flex:1}`) 내부 ScrollView | ✅ git diff에서 `paddingTop 12 / paddingHorizontal 24 / paddingBottom 24+insets.bottom` 값 변화 0(재들여쓰기만) |
| 10 | 원문 누출 차단 | `errors.ts:80-83` `messageForAuthFailure` — 항상 `AUTH_ERROR_MESSAGES` 값만 반환 | `AuthProvider.tsx:217`(부트스트랩 catch) · `:236`(리스너 catch) → `AuthGate.tsx:45` → `AuthErrorView.tsx:20` `{message}` | ✅ 원문은 `console.warn`(`:215`,`:233`)만. `errors.spec.ts:69-82` 값-집합 불변 케이스로 잠김 |
| 11 | loginError ↔ LoginScreen | `AuthProvider.tsx:236` `setLoginError(매핑 문구)` | `LoginScreen.tsx:89-91` `{loginError}` 인라인 | ✅ 신규 문구는 `BootstrapFailed` 1건, `TokenExchangeFailed`와 구분(D4). `LoginScreen.spec`·`AuthGate.spec` 무수정 green |
| 12 | 배럴 export | `errors.ts:65,80` | `features/auth/index.ts:3-9` `isNetworkAuthError`·`messageForAuthFailure` export | ✅ AuthProvider는 기존 패턴대로 `../errors` 상대 import(`AuthProvider.tsx:32`) |
| 13 | 회귀 grep | — | `src/` 전체 | ✅ `'프로필 초기화에 실패했습니다.'`·`'알 수 없는 인증 오류'` **잔존 0** |

## 2. 인수조건 (plan §5 T1~T14)

| 작업 | 판정 | 근거 |
|---|---|---|
| T1 훅 신설 | ✅ | `useStartLogFlow.ts:36-48` 성공(create→refresh→navigate 순서)·실패(Alert만, navigate/refresh 0) — `useStartLogFlow.spec.tsx` 8케이스. 순서는 order-배열 단언(`:66-83`)으로 잠김(**뮤테이션 M2** 2 red) |
| T2 PlusHeaderButton 리팩터 | ✅ | spec 무수정(git) + 6/6 green — 원칙 3 |
| T3 빈 상태 → 축하화면 | ✅ | `LogListScreen.spec` 273행 확장분: `navigate(RoomCreated, {roomId:'r1', code:'ABCDEF'})` 단언 — 원칙 3·7 (U1 핵심 달성: 어느 경로든 초대코드 노출) |
| T4 하단 CTA = 시트 오픈 | ✅ | 382행 대체 + "CTA를 누르면 시트가 열리고 createRoom은 호출되지 않는다"(D2) — 원칙 10 |
| T5 시트 두 행 배선 | ✅ | 시트 create → `RoomCreated{r2, ZZZZZZ}` + 시트 소멸 / join → `JoinLog` + 시트 소멸 단언 |
| T6 중복 방지 | ✅ | CTA: 렌더 표면 단언(D-2 — `accessibilityRole` button→undefined 양방향) / 시트 행: press → `createRoom` 0. 편차 D-2의 사유(fireEvent 합성 컴포넌트 prop 관통) 타당 |
| T7 tap 관통 | ✅ | prop 단언 + "첫 탭이 곧바로 joinRoom 1회" — 원칙 2·3. persistTaps 삭제 뮤테이션은 dev-notes 기록분 |
| T8 KAV | ✅ | iOS `'padding'` / Android `undefined` — D-1(UNSAFE_getByType)로 Android 거짓통과 함정 회피. 편차 사유 타당(behavior는 호스트 View로 안 내려감) |
| T9 6자 자동 내림 | ✅ | 6자 1회 / 5자 0회 / 재완성 2회 / 정규화-후-미달 0회 — **뮤테이션 M3**(가드 제거) 3 red |
| T10 JoinLog 회귀 0 | ✅ | 기존 케이스 본문 무수정(diff는 추가 + 공용 beforeEach 셋업 추가뿐), 전량 green |
| T11 errors 유틸 | ✅ | `errors.spec.ts` 13케이스 — unknown 매트릭스(null/undefined/'boom'/42/{}) throw 0, 값-집합 불변 — 원칙 5 |
| T12 부트스트랩 catch | ✅ | 네트워크→"네트워크 연결을…" / 그 외→"잠시 후…" + `queryByText(/invalid claim/)` null + `console.warn`이 원본 에러 객체 수신 — 원칙 5·10 |
| T13 리스너 catch | ✅ | upsert 실패 → `loginError` 매핑 문구 + `unauthenticated` 유지. 폴백 문자열 2개 제거(grep 0) |
| T14 전체 회귀 | ✅ | 207/2213 green + tsc 통과 (동결 지문 일치, 본 worktree에서 재실행) |

## 3. TDD 품질 — 뮤테이션 표본 (자체 3건, dev-notes §4의 6건과 중복 없음)

| # | 뮤테이션 | 결과 | 의미 |
|---|---|---|---|
| M1 | `useStartLogFlow.ts:41` `code: inviteCode` → `code: ''` | ✕ **3 red** (훅 spec 1 + LogListScreen spec 2) | 경계면 #1이 생산자·소비자 양쪽 spec에서 잠김 |
| M2 | refresh ↔ navigate 순서 교환 | ✕ **2 red** (순서 단언 + refresh-reject 방어 단언) | "복귀 시 목록 최신" 계약이 실단언 |
| M3 | `JoinLogScreen.tsx:45` 완성 가드 제거(항상 dismiss) | ✕ **3 red** (5자/재완성/정규화-미달) | T9 경계 케이스가 전부 load-bearing |

전 건 원복 후 본 트리와 바이트 일치 확인(cmp/diff), 최종 207/2213 green + tsc 재통과. 신설 spec의 단언은 전부 exact `.toBe`/호출-인자 일치 — `toContain` 류 죽은 단언 없음. dev-notes §4의 6건은 기록과 대상·논리가 정합해 재실행하지 않고 자체 3건으로 대체 표본 확인.

## 4. D5 준수 — 기존 spec 수정 범위

git diff 전수 확인(worktree = 본 트리 스냅샷, base b46e8c4):

- `AuthProvider.spec.tsx` — 기존 케이스 수정은 **139행 단언 1건뿐**(`'연결 실패'` → `'잠시 후 다시 시도해 주세요.'`). 같은 테스트의 제목(135행)·주석도 함께 갱신됨 — 문자 그대로의 "한 줄"보다 넓지만 동일 케이스 내 서술 정합화라 **실질 준수**. 나머지는 신규 describe 추가.
- `LogListScreen.spec.tsx` — plan §5-1이 명시한 2건(273행 확장·382행 대체) + 신규 describe. 그 외 기존 단언 무수정.
- `JoinLogScreen.spec.tsx` — 기존 케이스 본문 무수정. 공용 beforeEach에 `setPlatform('ios')`·`Keyboard.dismiss` 스파이 **추가**(기존 케이스 통과에 영향 없음 확인).
- `PlusHeaderButton.spec.tsx`·`LoginScreen.spec.tsx`·`AuthGate.spec.tsx` — git 변경 목록에 부재(무수정). **판정: 준수.**

## 5. 회귀·컨벤션

- `npm test` 207/2213 green · `npx tsc --noEmit` 통과 (본 worktree 재실행, 동결 지문 일치).
- 회귀 grep: `'프로필 초기화에 실패했습니다.'`·`'알 수 없는 인증 오류'` 잔존 **0**.
- 컨벤션(신규/수정 파일 한정): `useCallback`/`useMemo` 0 · `export function` 0 · 인라인 `useEffect(() =>` 0 · named-object 인자(`{ error }`, `{ code }`) 준수(RN 콜백 `handleChangeCode(next)`는 외부 API 예외) · enum-style 상수(`NETWORK_ERROR_NAME`·`NETWORK_ERROR_HINTS` as const) · 파일명=심볼명 · raw hex 0(주석 속 색상값 1건뿐).

## 6. 보안·비용 가드레일

- `supabase/` 디렉터리 diff **0** — DB·RPC·Edge Function·RLS 변경 없음.
- 변경 파일에 `supabase.`/`fetch(` 직접 호출 0 — 네트워크 호출은 기존 훅(`useCreateRoom` RPC 1회 + `refresh` 1회) 경유로 횟수 불변. Kakao 호출 0, 폴링·Realtime 신설 0.
- `console.warn`은 로컬 로그(외부 전송 0). 시크릿(.env·키) 접촉 0. AWS 0.

## 7. 발견 이슈

| 심각도 | 내용 | 라우팅 |
|---|---|---|
| 정보 | **BootstrapFailed 문구("잠시 후 다시 시도해 주세요.")가 TokenExchangeFailed 문구의 부분 문자열.** 현 spec은 전부 exact 단언이라 무해하나, 향후 이 문구에 `toContain`/정규식 단언을 쓰면 두 토큰을 구분 못 하는 죽은 단언이 된다(메모 string-assertion-dead-locks). | 기록만(향후 spec 작성 시 주의) |
| 정보 | **문자열 throw는 네트워크로 분류 안 됨** — `isNetworkAuthError({ error: 'network request failed' })` → false(`errors.ts:66` 비객체 조기 false, plan §3-5 명세대로). 결과는 어차피 한국어 BootstrapFailed 문구라 U3 목표(원문 비노출)에는 영향 0. | 기록만 |
| 정보 | **백로그 U3 행의 "인터넷 연결을 확인해 주세요"와 구현 문구("네트워크 연결을…") 상이** — plan §9 D3의 의도된 결정(기존 문구 재사용, 리더 지시 시 저비용 변경). 계획-구현 불일치 아님. | 리더 확인 선택사항 |
| 정보 | **본 트리에 이번 스프린트 외 빈 디렉터리 잔재** — `src/features/notif/{NotifPermissionBanner,ensureNotificationSetup,notificationsModule,permissionBanner,resolveDeepLinkTarget,useNotificationPermission,usePushNotificationResponse}`, `src/navigation/useDeepLinkNavigation` (전부 빈 폴더, git 비추적·테스트 무영향). 이번 스프린트 산출물 아님. | 리더(정리 여부만) |
| 정보 | AddSheet "초대코드로 들어가기" 행은 `creating` 중에도 활성 — plan T6는 create 행만 요구하며 join 이동은 무해. 계약(`AddSheet.tsx` 불변) 준수. | 기록만 |

수정 요구 이슈 **0건** — developer 재작업 불필요.

## 8. 미검증 (사유와 함께 이월)

- **디바이스 스모크 4종** (plan §9 — 단위 테스트 경계 밖, jsdom으로 재현 불가): ① 키보드 노출 상태 "들어가기" 첫 탭 실기기 반응 ② iPhone SE급 화면 버튼 가림 ③ 6자 완성 후 셀 탭 재포커스가 `keyboardShouldPersistTaps="handled"`에 막히지 않는지 ④ 오프라인 콜드스타트 AuthErrorView 문구.
- U42·U14·U24·U41·U49 — plan §2 의도적 out-of-scope(백로그 별도 항목). 특히 U14(생성 성공+refresh 실패 시 복귀 목록 전체화면 error) 경로는 여전히 존재하나 navigate는 수행되므로 U1 목표는 달성됨을 확인.
