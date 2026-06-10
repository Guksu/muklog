# Dev Notes — multi-log-home

> 구현자: developer 에이전트. 입력: `plan.md`(이 폴더, **트리밍 최종본**), `docs/design/architecture.md`, `docs/code-convention.md`, `docs/testing-strategy.md`.
> 방식: TDD(Red→Green→Refactor), jest-expo + @testing-library/react-native. 컨벤션 100%(useCallback/useMemo 지양·화살표함수·named-args·useEffect 명명·enum-style 상수·원티드 토큰).
> **완료 기준 충족**: `npm test` 전체 통과(**23 suites / 147 tests**), `npx tsc --noEmit` **exit 0**.
> git 작업 없음(사용자 전담). 실 Supabase 적용도 사용자(아래 §2).
> **스코프 재확정 반영**: ★(1) join UI 트리밍(JoinLogScreen·"로그 입장" → 차기 log-invite), ★(2) leave_room **인자화 선반영**(UI wiring 없음), modes 정원2 동기화.

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용, plan §7)

| 계약 | 생산자 | 소비자 | 비고 |
|------|--------|--------|------|
| C1 | `list_my_rooms()` 반환 행(snake) | `useMyLogs`(`toMyLog` → camel `MyLog`) | 0행/`data:null` → `ready`+`logs:[]`(에러 아님). error → `error` |
| C2 | `list_my_rooms` `member_count`(DEFINER 전 멤버 집계) | `LogListScreen` `memberBadgeLabel`(2=둘이/그외=혼자) | `mode` 컬럼 아님, 수에서 파생 |
| C3 | `create_room`(ALREADY_IN_ROOM 가드 제거) | `useCreateRoom.createRoom()`(무인자) → `PlusHeaderButton` | 같은 유저 N회 생성 → N개 |
| C4 | `join_room`(SOLO 가드 제거) — **이번 SQL 스모크만**(UI 없음) | (차기 log-invite) | 솔로 로그 조인 성공→멤버2. RPC 선반영 |
| C5 | `join_room`(타방 ALREADY 제거 + 같은 로그 PK 멱등) — SQL 스모크 | (차기 log-invite) | 다른 로그 조인 허용 / 재조인 멱등 |
| C6 | `enforce_room_capacity`=2 + `join_room` count/`for update` + **`modes.ts ROOM_CAPACITY={solo:2,couple:2}`** | `JoinLogScreen`(차기) / 상수 | 3번째 `ROOM_FULL`, 동시 직렬화, **생산자↔상수 정원2 일치** |
| C7 | `AuthGate` authenticated → `MyLogsProvider`+`NavigationContainer`+`AppNavigator` | 진입 | 온보딩/멤버십 분기 없이 HomeTabs 직행 |
| C8 | `routes.ts`(HomeTabs/LogList/LogScreen{roomId}; Onboarding/RoomTabs/MuklogTab 제거, **JoinLog 미추가**) | AppNavigator/HomeTabs/ProfileHeaderButton/PlusHeaderButton/카드 | tsc 그린, dangling 참조 0(코드) |
| C9 | `useMyLogs` `ready`+`logs:[]` | `LogListScreen` 빈 상태 | 빈 목록=빈 상태(에러 아님) |
| C10 | 카드 `navigate(LogScreen,{roomId})` | `LogScreen` `route.params?.roomId` | 키 일치, 누락 시 "로그를 찾을 수 없어요" |
| C11 | create 성공 → `myLogs.refresh()` | `LogListScreen` 표시 | PlusHeaderButton에서 refresh(폴링 없음) |
| C12 | `ProfileScreen`에서 Onboarding reset·useMembershipContext·useLeaveRoom 제거 | Onboarding 부재 | 런타임 크래시 0, 닉네임/아바타 회귀 0 |
| C-LEAVE | `leave_room(p_room_id)`(무인자 drop) + `useLeaveRoom({roomId})` → `rpc('leave_room',{p_room_id})` | **호출부 부재(이번)** | 무인자 오버로드 잔존 0, spec `{p_room_id:'r1'}` 단언, for update·본인행 스코프 유지. ⚠️ **UI wiring 0**(차기 LogScreen) |
| C13 | additive 마이그레이션 + 삭제/의도된 변경 | plan §3.10 판정표 ↔ 기존 spec | 회귀 0(errors/code/useJoinRoom/profile 불변), 의도된 변경(modes 정원2·leave 인자화·게이트/온보딩/멤버십 삭제·Profile 나가기 제거) 1:1 |

---

## 2. 마이그레이션 (신규 파일, 기존 미수정)

**파일**: `supabase/migrations/20260610150000_multi_log_home.sql` (additive·idempotent, `create or replace`/`drop+create` + 권한 재선언).

1. `enforce_room_capacity()` — **정원 2 통일**(room_modes solo=1 분기 폐기). 트리거 본문만 교체.
2. `create_room(p_mode text default 'couple')` — **`ALREADY_IN_ROOM` 가드 블록만 삭제**(다중 로그 생성). 나머지 불변.
3. `join_room(p_code)` — **`SOLO_ROOM_NOT_JOINABLE`·타방 `ALREADY_IN_ROOM` 제거**, 같은 로그 PK 멱등. `INVALID_CODE`/`ROOM_FULL`/`for update`/정원2 유지. **이번엔 UI 없음 → 차기 log-invite가 사용(SQL 스모크만 검증)**.
4. `list_my_rooms()` — **신설 DEFINER**(`language sql`, `set search_path=public`). `where rm.user_id = auth.uid()`(C-RLS 필수), `member_count` 서브쿼리 집계, `order by joined_at desc`.
5. `leave_room(p_room_id uuid)` — **무인자 `leave_room()` `drop` 후 인자화 재생성**(오버로드 함정 회피). `for update` 잠금·본인 행 스코프(`user_id=auth.uid()`)·count 후 삭제·잔여≥1 보존 **모두 유지**, 대상만 `p_room_id` 스코프. 반환 `{room_deleted,room_id}` 불변. ⚠️ **이번 UI 호출부 없음**(차기 LogScreen 로그별 나가기용 선반영).

### 실 Supabase 적용법 (사용자 몫)
```bash
supabase db push   # 또는 Supabase 대시보드 SQL Editor에 본 파일 실행
```
스모크(사용자 환경): ① 같은 유저 `create_room` 2회 → 로그 2개 ② 솔로 로그 초대코드로 타 유저 `join_room` → 멤버2 ③ 3번째 `join_room` → `ROOM_FULL` ④ `list_my_rooms()` → 내 로그만, `member_count` 정확 ⑤ `leave_room(p_room_id)` → 멤버 해지 / 0명 시 로그 삭제. (무인자 `leave_room()` 호출은 더 이상 존재 안 함 — drop됨.)

---

## 3. 신규/변경/삭제 파일

### 신규
- `supabase/migrations/20260610150000_multi_log_home.sql`
- `src/features/room/useMyLogs.ts` (+`useMyLogs.spec.ts`), `MyLogsProvider.tsx` (+`MyLogsProvider.spec.tsx`).
- `src/navigation/AuthGate.spec.tsx`.
- `src/navigation/PlusHeaderButton.tsx` (+`PlusHeaderButton.spec.tsx`) — **로그 생성 단일 액션**(액션시트 없음).
- `src/navigation/HomeTabs.tsx` — was RoomTabs(헤더 우측 [+][프로필]).
- `src/navigation/screens/LogListScreen.tsx` (+`.spec.tsx`), `formatLogDate.ts` (+`.spec.ts`), `LogScreen.tsx` (+`.spec.tsx`).

### 변경
- `useCreateRoom.ts` — `createRoom({ mode }: { mode?: RoomMode } = {})`. 무인자 시 `rpc('create_room')`(p_mode 미전달). (+spec 무인자 케이스)
- `useLeaveRoom.ts` — **인자화** `leaveRoom({ roomId })` → `rpc('leave_room', { p_room_id: roomId })`. ⚠️ 반환 매핑의 지역변수명 `roomId`→`leftRoomId`로 변경(매개변수와 섀도잉 충돌 버그 수정). (+spec 단언 `{p_room_id:'r1'}`)
- `modes.ts` — `ROOM_CAPACITY = { solo: 2, couple: 2 }`(트리거 정원2 동기화, C6). (+spec)
- `index.ts` — `useMyLogs`/`MyLogsProvider`/`useMyLogsContext`/`MyLog`/`MyLogsState` 추가, Membership* 제거. `useLeaveRoom`/`LeaveRoomResult` 유지.
- `routes.ts` — `HomeTabs`/`LogList`/`LogScreen{roomId}` 추가, `Onboarding`/`RoomTabs`/`MuklogTab` 제거, `RoomTabParamList`→`HomeTabParamList`. **JoinLog 미추가**.
- `navigation/index.ts` — `HomeTabParamList` export.
- `AuthGate.tsx` — authenticated → MyLogsProvider+NavigationContainer+AppNavigator(게이트 제거).
- `AppNavigator.tsx` — HomeTabs/Profile/LogScreen 등록(Onboarding·JoinLog 미등록). initialRouteName prop 제거.
- `ProfileScreen.tsx` — 나가기 섹션·useLeaveRoom·useMembershipContext·useNavigation·Routes.Onboarding 제거. (+spec leave 케이스 삭제, 나가기-부재 가드)
- 주석 정확화: useJoinRoom(미사용·차기 log-invite), errors/useMyLogs/MyLogsProvider(소비자에서 JoinLogScreen 제거), modes(정원2), ProfileHeaderButton/ProfileScreen(RoomTabs→HomeTabs).

### 삭제 (의도된 변경 — plan §3.10)
- `screens/OnboardingScreen.tsx`(+spec), `MembershipGate.tsx`, `MembershipProvider.tsx`, `useMembership.ts`(+spec), `screens/MuklogTabScreen.tsx`.
- (한 차례 작성 후) `screens/JoinLogScreen.tsx`(+spec) — join UI 트리밍으로 제거(차기 log-invite).

### 보존(미사용)
- `useJoinRoom.ts`, `code.ts`(+`code.spec.ts`) — 본문 불변. 차기 log-invite의 로그 입장 UI가 사용.

---

## 4. 게이트/스코프 변경 회귀 메모 (의도된 변경 vs 회귀, plan §3.10)

- **의도된 변경**: 게이트·온보딩·멤버십 제거(useMembership→useMyLogs), create_room/join_room 가드 제거, enforce_room_capacity 정원2 + ROOM_CAPACITY 동기화, leave_room 인자화, ProfileScreen 나가기 제거. 관련 spec 갱신/삭제 정당.
- **회귀 금지(불변 확인)**: useCreateRoom/useJoinRoom 정상 매핑, `errors.ts`, `code.ts`/`code.spec`, ProfileScreen 닉네임/아바타 편집. → 기존 spec 전부 그린.
- **트리밍(이번 미구현, 차기)**: 로그 입장 UI(JoinLogScreen·액션시트 "로그 입장") → log-invite. `join_room` 마이그레이션·`useJoinRoom`·`code.ts`는 선반영/보존.
- **선반영(UI wiring 없음)**: `leave_room(p_room_id)`·`useLeaveRoom({roomId})`는 차기 LogScreen 로그별 나가기용. ⚠️ 이번에 어떤 화면에도 연결하지 않음(plan 함정5).
- **dormant/stale 잔존(무해)**: `errors.ts`의 `SOLO_ROOM_NOT_JOINABLE`/`ALREADY_IN_ROOM`(RPC 미raise). `rooms.mode` 컬럼(stale).

---

## 5. 컨벤션·비용 가드레일
- useCallback/useMemo 0건. 컴포넌트·훅 화살표 const. 우리 함수 named-object 인자. useEffect 콜백 명명. enum-style `Routes`/`ROOM_MODES`. 스타일 전부 토큰(raw hex 0).
- `list_my_rooms` 1 RPC로 내 로그+멤버수(N+1 회피). 마운트 1회 + 생성 성공 후 refresh 1회. 폴링·focus 조회 없음. Realtime·AWS 미사용.

---

## 6. 미완/후속 (OUT-OF-SCOPE)
- **로그 입장(join) UI** — `log-invite`(JoinLogScreen + 액션시트 "로그 입장" + 초대코드 표시·복사). `join_room` RPC·`useJoinRoom`·`code.ts` 준비됨.
- **로그별 나가기 UI** — 차기 LogScreen. `leave_room(p_room_id)`·`useLeaveRoom({roomId})` 선반영됨(wiring만 남음).
- 맛집 먹로그 엔트리, 지도 본구현, 로그 이름/대표 이미지(§7 미정), 다중 로그 Realtime.
