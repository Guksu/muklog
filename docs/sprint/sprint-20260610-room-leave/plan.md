# Sprint: 방 나가기(즉시) — 경량판 (room-leave)

> 입력: `docs/design/architecture.md`(§3 rooms/room_members·삭제 라이프사이클 컬럼·RLS, §4 게이트 흐름·Room 헤더 나가기, §5 백로그, §7 나가기 결정).
> 기존 산출: `supabase/migrations/20260609120000_invite_room.sql`(rooms/room_members 스키마·CASCADE·RLS·정원 트리거·create_room/join_room), `supabase/migrations/20260610130000_room_modes.sql`(mode·삭제 라이프사이클 컬럼·모드별 정원·솔로가드), `src/features/room/*`(useMembership·useCreateRoom·useJoinRoom·errors), `src/navigation/*`(MembershipGate·AppNavigator·RoomTabs·ProfileHeaderButton·OnboardingScreen·ProfileScreen).
> 산출물: 이 plan.md → developer 구현(dev-notes.md) → qa-inspector 검증(qa-report.md). **TDD 전제**(Red→Green→Refactor, `npm test` 통과가 완료 기준).

---

## 1. 기능 한줄 정의

방에 속한 사용자가 **즉시 그 방을 나가** 멤버십이 제거되고 Onboarding(방 생성/입장)으로 복귀한다. 나간 뒤 **방에 멤버가 0명이면 `rooms` 행을 삭제**하고(→ FK CASCADE로 `room_members` 정리), **1명이 남으면 방을 보존**한다(남은 사람 데이터 손실 0). 예약/유예/취소/자동삭제 cron 없이 **호출 즉시 확정**된다.

> ⚠️ **인수조건 범위(QA baseline 보정)**: 현재 DB에 `muklogs`/`muklog_photos` 테이블이 **없으므로**, 빈 방 정리의 검증 가능한 인수조건은 **"멤버 0 → `rooms` 행 DELETE(그리고 `room_members` CASCADE 정리)"까지만**이다. 먹로그·사진의 cascade 정리는 **차후 테이블 추가 시 FK를 `ON DELETE CASCADE`로 설계하도록 권고(§3.3)** 수준의 메모이며, 본 스프린트 인수조건에 넣지 않는다(오버스펙·검증불가 회피).

---

## 2. 범위

### In-scope
- **마이그레이션 신규 파일**(`supabase/migrations/20260610140000_room_leave.sql`):
  - `leave_room()` RPC(SECURITY DEFINER, 무인자) — 호출자(`auth.uid()`) 자신의 `room_members` 행만 제거. 제거 후 방 멤버 0명이면 방 삭제(→ CASCADE로 하위 정리), 1명 이상이면 방 보존.
  - `authenticated`에 `execute` grant(`public`/`anon` revoke) — create/join과 동일 패턴.
- **프론트 훅**: `useLeaveRoom()` — `leaveRoom()` 액션 + loading/error. `rpc('leave_room')` 호출, 반환 매핑(snake→camel).
- **에러 매핑 재사용**: `mapRoomError`/`ROOM_ERROR_MESSAGES`(기존). 신규 토큰은 **불필요**(아래 §3.4 결정). `NOT_AUTHENTICATED`만 재사용.
- **나가기 진입점 UI**: **Profile 화면 하단**에 "방 나가기"(파괴적 액션) + **확인 다이얼로그(`Alert.alert`)**. 확인 시 `leaveRoom()` → 성공 시 상태/네비 전이.
- **상태 전이**: 성공 → `useMembershipContext.refresh()`(in-room→no-room) + `navigation.reset({ index:0, routes:[{ name: Onboarding }] })`(MembershipGate 동일 노드 유지로 reset 보존, §4).
- **회귀 보장**: 기존 create_room/join_room/정원 트리거/profile 동작·테스트 불변.

### Out-of-scope (room-lifecycle 스프린트로 보류 — 사용자 승인된 divergence)
- **24h 나가기 유예 + 취소**(`delete_scheduled_at`/`delete_requested_by` 활용): 컬럼은 이미 선반영(room-modes)되어 있으나 **이번 스프린트는 건드리지 않는다**(항상 NULL 유지). 즉시 나가기로 대체.
- **자동삭제 cron**(pg_cron/스케줄 Edge Function): 커플방 24h 미입장 자동삭제(#2), 나가기 24h 미취소 삭제(#5) — 전부 `room-lifecycle`.
- **솔로→커플 전환(`room-promote`)**, **Room 헤더 나가기 배너/안내**(유예 모델 전용).
- 먹로그/지도/Storage/Kakao/Realtime/프로필 편집 자체.

---

## 2-결정. 합의 설계(24h 유예)와의 divergence (명시 — 사용자 승인됨)

architecture.md §3·§5·§7의 합의 설계는 "커플방 나가기 → `delete_scheduled_at=now()+24h` 예약 → 나간 사람이 24h 내 미취소 시 cron이 방+데이터 삭제"다. 본 스프린트는 이를 **즉시 나가기로 단순화**한다. 근거(team-lead·사용자 승인):
1. **막힘 해소가 우선**: 현재 방에 들어가면 빠져나올 경로가 전혀 없어 Onboarding 복귀 불가. 즉시 나가기 하나로 막힘이 풀린다.
2. **유예/취소/cron은 무겁다**: 인프라(pg_cron vs 스케줄 함수) 선택·Storage 정리·취소 UI·배너 상태기계가 모두 딸려 와 1 스프린트 단일 기능을 초과한다 → `room-lifecycle`로 분리 유지.
3. **스키마는 이미 미래 호환**: `delete_scheduled_at`/`delete_requested_by` 컬럼이 선반영돼 있어, 추후 유예 모델 도입 시 `leave_room` 본문만 교체하면 된다(컬럼 추가 마이그레이션 불필요).

→ 이 divergence를 반영해 **architecture.md §3·§4·§5·§7을 직접 갱신**한다(§부록-architecture-diff). 핵심 결정에 이견 있으면 team-lead가 알려주세요.

---

## 3. 데이터 · API 계약

> 마이그레이션은 **신규 파일** `supabase/migrations/20260610140000_room_leave.sql`(기존 invite_room/room_modes는 수정하지 않음 — 이미 적용된 환경 고려, additive). 재실행 가능(idempotent: `create or replace function`). 실 Supabase 적용은 **사용자 환경 의존**(dev-notes 명시).

### 3.0 현재 DB 사실 (계약 전제)
- 존재 테이블: `profiles`, `rooms`, `room_members`. **`muklogs`/`muklog_photos`는 아직 DB에 없음**(architecture 설계에만 존재, 차기 스프린트 생성).
- `room_members.room_id → rooms(id) ON DELETE CASCADE`(invite_room.sql:35) — 방 삭제 시 멤버 행 자동 정리됨.
- `rooms` RLS: insert/update/**delete 정책 없음** → 직접 삭제 거부. `room_members`도 delete 정책 없음 → **DEFINER RPC만** 멤버/방을 제거 가능.

### 3.1 `leave_room()` RPC (SECURITY DEFINER, 무인자)

반환: `{ "room_deleted": <bool>, "room_id": <uuid|null> }`
- `room_id`: 호출자가 나간 방의 id(멤버였던 경우). 멤버가 아니었으면 `null`.
- `room_deleted`: 그 방이 이번 호출로 삭제되었는지(0명 → true / 1명 이상 잔존 → false / 멤버 아니었음 → false).

동작 순서(**동시성·정리 순서가 핵심**):
1. `v_uid := auth.uid()`; null → `raise 'NOT_AUTHENTICATED'`.
2. 호출자의 멤버십 방 조회: `select room_id into v_room_id from room_members where user_id = v_uid;`
   - 없음(`v_room_id is null`) → **멱등 성공**: `return jsonb_build_object('room_deleted', false, 'room_id', null);` (이미 나간 상태 재호출 안전).
3. **방 행 잠금(동시성 직렬화)**: `perform 1 from rooms where id = v_room_id for update;`
   - 마지막 두 멤버가 동시에 나갈 때 "둘 다 잔존으로 오판 → 방 미삭제(고아 빈 방)"를 막는다(§6 동시성).
4. **호출자 본인 행만 삭제**: `delete from room_members where room_id = v_room_id and user_id = v_uid;`
   - ⚠️ DEFINER는 RLS 우회 → `user_id = v_uid` 스코프를 **명시**해야 타인 행 무영향(C-RLS).
5. 잔여 멤버 수 확인: `select count(*) into v_remaining from room_members where room_id = v_room_id;`
6. `v_remaining = 0`이면 **명시적으로 방 삭제**: `delete from rooms where id = v_room_id;`
   - ⚠️ FK 방향은 `room_members.room_id → rooms ON DELETE CASCADE`(방→멤버)다. 멤버 1행 삭제만으론 방이 안 지워지므로 **`rooms` DELETE를 직접 실행**해야 한다(이 DELETE가 잔여 `room_members`를 cascade 정리; `muklogs`/`muklog_photos`는 생기면 자동, 현재 부재). `v_deleted := true`.
   - `v_remaining ≥ 1`이면 방 보존(`v_deleted := false`) — 남은 멤버 데이터 손실 0.
7. `return jsonb_build_object('room_deleted', v_deleted, 'room_id', v_room_id);`

| 에러 토큰 | 조건 |
|-----------|------|
| `NOT_AUTHENTICATED` | 세션 없음(`auth.uid()` null) |
| (그 외) | 멤버 아니면 에러 아님 → 멱등 성공. DB 예외는 매핑 기본 메시지로 표시 |

권한:
```sql
revoke all on function public.leave_room() from public, anon;
grant execute on function public.leave_room() to authenticated;
```

### 3.2 커플방 한 명만 나갈 때의 즉시 시맨틱 (결정)

- **남은 멤버 1명 → 방 보존.** 근거:
  - 남은 사람의 먹로그/사진 데이터 손실 0(즉시 삭제는 과격).
  - `rooms.invite_code`가 유지되고 커플 정원이 2이므로, 나간 사람이나 새 파트너가 **다시 입장 가능**(join_room).
  - 유예(24h) 없이도 안전: "나가기 = 내 멤버십만 해지". 방은 남은 사람의 것으로 계속 산다.
- **0명 → 방 삭제.** 근거: 주인이 없는 방은 의미가 없고 Storage/행 누수가 된다. 즉시 정리.
- 이는 합의 모델(나가기 → 24h 뒤 **방+남은 멤버 데이터까지** 삭제)과 **다르다**: 이번은 남은 멤버를 **보존**한다. divergence 명시(§2-결정).

### 3.3 미래 호환 — CASCADE 선결 요구 (handoff)
- 현재 방 삭제는 `room_members`만 CASCADE된다(테이블이 그것뿐).
- **차기 `muklog-editor` 스프린트가 `muklogs` 테이블을 만들 때, `muklogs.room_id → rooms(id)`를 반드시 `ON DELETE CASCADE`로 선언**해야 `leave_room`의 방 삭제가 먹로그·사진까지 완전 정리한다(`muklog_photos.muklog_id → muklogs ON DELETE CASCADE`는 architecture §3에 이미 명시).
- 본 스프린트는 이 요구를 **문서화만** 한다(테이블 부재로 지금 강제 불가). QA 경계 C-FUTURE.

### 3.4 에러 토큰 — 신규 불필요 (결정)
- "이미 나간 상태"는 에러가 아니라 **멱등 성공**으로 처리(§3.1 step2) → `NOT_IN_ROOM` 류 토큰 불필요.
- 나가기 실패(네트워크/DB)는 `mapRoomError` **기본 메시지**(`DEFAULT_ROOM_ERROR_MESSAGE`)로 충분.
- 세션 없음만 기존 `NOT_AUTHENTICATED` 재사용. **`errors.ts` 변경 없음**(회귀 0).

### 3.5 프론트 훅 시그니처 (`src/features/room/useLeaveRoom.ts`)

```ts
export type LeaveRoomResult = { roomDeleted: boolean; roomId: string | null };

export const useLeaveRoom = () => {
  // 내부: supabase.rpc('leave_room')  (인자 없음 — auth.uid 기준 동작)
  //   → data.room_deleted / data.room_id 매핑(snake→camel)
  //   → 응답이 객체가 아니거나 room_deleted 누락 시 'LEAVE_ROOM_BAD_RESPONSE'(throw, 기본 메시지)
  //   → 실패 시 error에 mapRoomError 메시지 세팅 + 원본 throw (create/join 훅과 동일 형태)
  return {
    leaveRoom: () => Promise<LeaveRoomResult>,
    loading: boolean,
    error: string | null,
  };
};
```
- `index.ts`에 `useLeaveRoom`, `LeaveRoomResult` 재노출(공개 표면).
- 멱등 성공(`room_id: null`)도 정상 반환 → 화면은 동일하게 Onboarding 전이.

---

## 4. 화면 · UX

### 4.1 진입점 결정 — Profile 화면 (Room 헤더 아님)

architecture §4는 나가기를 "Room 헤더(커플방 한정)"에 두지만, 본 스프린트는 **Profile 화면 하단**에 배치한다. 근거:
1. **ProfileScreen은 이미 완성·도달 가능**(RoomTabs 헤더 → ProfileHeaderButton → Profile). 반면 RoomTabs의 탭 화면(MuklogTab/MapTab)과 헤더는 stub 수준이라 나가기 UI를 둘 안정적 자리가 없다.
2. **Room 헤더 우측 슬롯은 ProfileHeaderButton이 점유** — 파괴적 버튼을 헤더에 추가로 욱여넣는 건 UX·구현 모두 부담. 합의 모델의 "나가기 배너(24h)"는 보류되었으므로 헤더 배치 근거도 약해졌다.
3. **모드 무관 일관**: 즉시 나가기는 솔로·커플 모두 필요(막힘 해소 목적). Profile은 모드와 무관한 "계정/방 설정" 성격의 화면이라 두 모드 공통 진입점으로 적합.
4. 이는 architecture §4와의 **divergence** → §부록-architecture-diff에서 문서 갱신. (team-lead: 헤더 배치를 고수해야 하면 알려주세요. 기본은 Profile 배치로 진행.)

### 4.2 Profile 화면 나가기 UX

- 위치: ProfileScreen 본문 **하단**(닉네임/아바타 편집 영역 아래, 시각적으로 분리).
- 버튼: "방 나가기" — 파괴적 톤(원티드 토큰; `Text color="error"` 또는 `Button` secondary + error 색. raw hex 금지).
- 누르면 **확인 다이얼로그**(`Alert.alert`):
  - 제목: "방을 나갈까요?"
  - 메시지(모드/문맥 무관 안전 카피): "이 방에서 나가면 다시 입장하려면 초대코드가 필요해요." (※ 솔로방 즉시 삭제 뉘앙스까지 카피로 강제하지 않음 — 남은 멤버 유무를 클라가 미리 모르므로 일반 카피 사용)
  - 버튼: "취소"(cancel) / "나가기"(destructive) → 확인 시 `handleLeave()`.
- `handleLeave()`:
  1. `await leaveRoom()` (loading 표시 — 버튼 `loading` 또는 화면 인디케이터).
  2. 성공 → `void membership.refresh()` + `navigation.reset({ index:0, routes:[{ name: Routes.Onboarding }] })`.
  3. 실패 → `useLeaveRoom.error` 인라인 표시(기존 ProfileScreen `error` 표시 패턴 재사용), 화면 유지(전이 없음).
- ProfileScreen은 `useMembershipContext`를 사용해야 함(현재 미사용) → import 추가. ProfileScreen은 MembershipGate(=MembershipProvider) 트리 하위이므로 컨텍스트 접근 가능.

### 4.3 상태 전이 다이어그램

```
[Profile] "방 나가기" → Alert 확인
   → leaveRoom() 성공
      → membership.refresh()   (백그라운드: in-room → no-room)
      → navigation.reset(Onboarding)   (스택 [RoomTabs, Profile] → [Onboarding])
   → MembershipGate: no-room/in-room 동일 NavigationContainer 노드 →
      언마운트 없음 → reset된 Onboarding 유지 (C8 패턴, OnboardingScreen의 goToRoom 대칭)
```
- **reset 필요성**: MembershipGate가 no-room/in-room을 동일 JSX 노드로 렌더하므로 `initialRouteName` 변경만으로는 재이동이 일어나지 않는다(첫 마운트에만 적용). 따라서 `navigation.reset`이 실제 이동을 담당하고 `refresh`는 게이트 상태 정합만 맞춘다 — OnboardingScreen→RoomTabs 전이의 **거울 패턴**.
- **refresh 실패 시**: 게이트가 error 뷰로 전환(다른 노드 → NavigationContainer 언마운트) → 재시도 시 refresh→no-room→Onboarding. 나가기는 이미 서버에서 확정됐으므로 데이터 일관성 문제 없음(§6).

---

## 5. 작업 목록 (모듈 단위, TDD 순서)

> 각 모듈: **Red(스펙)** → **Green(구현)** → **Refactor**. SQL/RPC/RLS/트리거는 단위 대상 아님 → 모킹된 응답/에러로 클라 계약만 검증 + 실DB는 사용자 스모크(testing-strategy). 모듈 완성 시 qa-inspector에 생산자↔소비자 경로 명시.

- [ ] **T1. 마이그레이션 `20260610140000_room_leave.sql`** — 인수: `leave_room()`(SECURITY DEFINER, `set search_path=public`) 생성. 호출자 멤버십 방 조회 → `for update` 잠금 → 본인 행만 삭제(`user_id=auth.uid()`) → 잔여 count → **0이면 명시적 `delete from rooms`(인수조건: `rooms` 행 삭제 + `room_members` CASCADE 정리까지만 — muklogs/photos는 범위 외)**, ≥1이면 보존 → `{room_deleted, room_id}` 반환. 멤버 아니면 멱등 `{false,null}`. 세션 없음 `NOT_AUTHENTICATED`. `authenticated`에 grant, `public/anon` revoke. idempotent(`create or replace`). 기존 마이그레이션 미변경. (SQL은 스모크 — 사용자 실DB 적용·검증.)
- [ ] **T2. `useLeaveRoom` 훅** (스펙 먼저 Red) — 인수: `leaveRoom()` 성공 시 `rpc('leave_room')` **인자 없이** 호출, `{room_deleted, room_id}` → `{roomDeleted, roomId}` 매핑. `room_deleted` 누락/비객체 응답 → `LEAVE_ROOM_BAD_RESPONSE` throw + error에 기본 메시지. rpcError → error에 `mapRoomError` 메시지 + throw. loading true→false 전이. supabase 모킹(testing-strategy §모킹).
- [ ] **T3. `index.ts` 재노출** — 인수: `useLeaveRoom`/`LeaveRoomResult` export. tsc 통과.
- [ ] **T4. ProfileScreen 나가기 UI** (스펙 먼저 Red) — 인수: 하단 "방 나가기" 버튼 렌더. 누르면 `Alert.alert` 호출(확인/취소). 확인 콜백에서 `leaveRoom()` 호출 → 성공 시 `membership.refresh()` + `navigation.reset(Onboarding)`. 실패 시 인라인 에러 표시·전이 없음. 토큰만 사용(raw hex 0). `Alert`·`navigation`·`useMembershipContext`·`useLeaveRoom` 모킹.
- [ ] **T5. 회귀 가드** — 인수: `npm test` 전체 그린(invite-room/room-modes/profile 스펙 포함). `tsc --noEmit` 통과. create_room/join_room/정원 트리거/ProfileScreen 기존 동작(닉네임/아바타) 불변. errors.ts·modes.ts 미변경 확인.

> **TDD 순서 권장**: T2(훅) Red→Green → T4(화면) Red→Green → T1(SQL, 스모크) 병행 → T3/T5 정리. 화면 스펙은 `Alert.alert`를 모킹해 "확인" 버튼 콜백을 직접 호출하는 형태로 전이를 검증(네이티브 다이얼로그 자체는 스모크).

---

## 6. 엣지케이스

**멱등/재호출**
- 멤버 아닌 사용자가 `leave_room()` 호출(이미 나감/세션은 살아있음) → 에러 아님, `{room_deleted:false, room_id:null}` 멱등 성공 → 화면은 그대로 Onboarding 전이.
- 같은 사용자가 빠르게 두 번 탭 → 첫 호출 성공(행 삭제), 두 번째는 멱등 성공. 버튼 `loading`으로 1차 차단.

**동시성 (커플방 마지막 두 멤버 동시 나가기 — 핵심)**
- A·B가 거의 동시에 `leave_room()` 호출. `for update` 방 행 잠금으로 **직렬화**: 먼저 잡은 트랜잭션이 본인 행 삭제→잔여 1명 확인→방 보존; 나중 트랜잭션이 본인 행 삭제→잔여 0→방 삭제.
- **잠금 없으면 버그**: READ COMMITTED에서 두 트랜잭션이 각각 "상대가 아직 있다"(미커밋)고 보고 둘 다 방 보존 → 멤버 0인 **고아 빈 방** 잔존. `for update`가 이를 방지(C-CONC).
- 0명 삭제 경로에서 `delete from rooms`가 두 번 시도돼도(이론상) 두 번째는 0행 — 무해.

**정리 순서**
- 항상 "본인 멤버십 행 삭제 → 잔여 count → 0이면 방 삭제" 순. 방을 먼저 지우면 CASCADE로 상대 멤버까지 날아갈 수 있으므로 **count 확인 후에만** 방 삭제(남은 멤버 보존 보장).

**RLS/권한**
- DEFINER 우회 상태에서 삭제 스코프 `user_id = auth.uid()` 누락 시 타인 행까지 삭제 위험 → **반드시 스코프 명시**(C-RLS). 호출자 본인 외 행 무영향이 인수조건.
- `rooms`/`room_members`에 client 직접 delete 정책 없음 → RPC 외 경로로는 나가기 불가(설계대로).

**네트워크/상태**
- `leaveRoom()` 중 끊김 → 훅 error + 인라인 표시, 화면 유지(전이 없음). 재시도 가능(멱등이라 안전).
- 나가기 성공 후 `refresh()` 실패(네트워크) → 게이트 error 뷰 → 재시도 → no-room → Onboarding. 서버 상태는 이미 나간 상태로 일관.
- 나가기 성공 직후 reset 전 사용자가 뒤로가기 시도 → reset이 스택을 [Onboarding] 단일로 만들어 복귀 불가(의도된 동작, C8 패턴).

**모드별**
- 솔로방 나가기 → 항상 잔여 0 → 방+(미래)하위 삭제 → Onboarding.
- 커플방 1인 잔존 시 나가기 → 방 보존(남은 사람은 그대로 in-room, 영향 없음).
- 커플방 혼자(파트너 미입장) 나가기 → 잔여 0 → 방 삭제.

**데이터 부재(현재)**
- `muklogs`/`muklog_photos` 테이블 부재로 방 삭제 시 cascade 대상은 `room_members`뿐 → 정상. 미래 테이블 CASCADE는 §3.3 handoff.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| **C1** | `leave_room` 반환 jsonb(`room_deleted`,`room_id` snake) | `useLeaveRoom` 파싱(`roomDeleted`,`roomId` camel) | 매핑 정확·누락 시 `LEAVE_ROOM_BAD_RESPONSE` |
| **C2** | `rpc('leave_room')` 호출(인자 없음) | RPC 시그니처(무인자) | 인자 전달 안 함·오버로드 없음(create_room 무인자 함정 교훈) |
| **C-RLS** | `leave_room` DEFINER 삭제 스코프 `user_id=auth.uid()` | "본인 외 행 무영향" 인수 | 타인 `room_members` 행 삭제되지 않음(스코프 누락 시 치명) |
| **C-CONC** | `for update` 방 행 잠금 | 마지막 두 멤버 동시 나가기 | 고아 빈 방 미발생(둘 중 나중 호출이 방 삭제) |
| **C-DEL** | 잔여 0 → 명시적 `delete rooms`(FK 방→멤버 CASCADE) | 솔로/혼자 커플 나가기 | `rooms` 행 삭제 + `room_members` CASCADE 정리(인수조건 범위). 잔여≥1은 보존. ※멤버 1행 삭제만으론 방 미삭제 |
| **C-NAV** | 성공 시 `refresh()`+`reset(Onboarding)` | MembershipGate 동일 노드(no-room/in-room) | NavigationContainer 언마운트 없이 Onboarding 유지(전이 결정성) |
| **C-IDEM** | 멤버 아님 → 멱등 `{false,null}` | 재호출/이미 나감 | 에러 없이 성공·Onboarding 전이 |
| **C-FUTURE** | `leave_room`의 `delete rooms` CASCADE 가정 | 차기 `muklogs.room_id` FK | (문서) muklog-editor가 `ON DELETE CASCADE`로 생성해야 완전 정리 |
| **C-REG** | 신규 RPC/훅/화면(additive) | 기존 create/join/정원/profile 스펙·tsc | 회귀 0(`npm test` 그린, errors.ts·modes.ts 미변경) |

---

## 8. 비용 가드레일 체크

- **AWS 미사용.** Supabase 무료 티어(Postgres + 익명 Auth)만. Storage/Edge/Kakao **이번 범위 없음**.
- **왕복 최소화**: 나가기는 **1회 RPC**로 완결(멤버 삭제·방 정리·잔여 판정 서버 1회). 클라 추가 조회 없음.
- **빈 방 즉시 정리**로 행 누수 방지(무료 티어 보호) — cron 없이 나가는 순간 정리.
- 멤버십 재조회는 성공 후 `refresh` 1회만(폴링 금지, 기존 정책 유지).
- 이미지 압축/Kakao 디바운스/viewport 조회 → 이번 기능 **해당 없음**.

---

## 부록-architecture-diff. architecture.md 갱신 (직접 반영)

본 plan과 함께 `docs/design/architecture.md`를 다음과 같이 갱신한다(즉시 나가기 출시 / 유예·cron 보류 정합):
- **§3 삭제 라이프사이클 주석**: "나가기 유예(#5)" 항목에 "**즉시 나가기는 `room-leave` 스프린트에서 우선 출시**(예약/유예/cron 없이 멤버십 즉시 해지 + 0명 시 방 삭제). 24h 유예·취소·자동삭제는 `room-lifecycle` 보류" 명시.
- **§4 Room 헤더 나가기 줄**: "방 나가기 → 24h 후 삭제 예약 …(추후)"를 "**즉시 나가기는 `room-leave`에서 Profile 화면에 우선 배치**(멤버십 해지 + 0명 시 방 삭제 → Onboarding 복귀). 24h 유예 배너/취소는 `room-lifecycle`"로 갱신.
- **§5 백로그 표**: `room-leave (경량)` 행 추가 — 기능 "방 나가기(즉시): leave_room RPC + Profile 진입 + 0명 방 삭제", 대응 "#5 일부(즉시판)", 상태 "진행". `room-lifecycle` 행 비고에 "(즉시 나가기는 room-leave로 분리 출시)" 부기.
- **§7 미해결**: "방 나가기 결정됨" 항목에 "**즉시판은 room-leave로 출시**, 유예/cron만 room-lifecycle 보류" 부기.

## 부록. developer 핸드오프 메모

- 마이그레이션은 **신규 파일**(`20260610140000_room_leave.sql`, 기존 미수정). `create or replace function public.leave_room()` + `for update` 잠금 + 본인 행 스코프 삭제 + 잔여 count 분기 + 권한 재grant. SECURITY DEFINER·`set search_path=public`(create/join 패턴 준수).
- **함정 1**: DEFINER 삭제는 RLS 우회 → `where user_id = v_uid` **반드시** 포함(타인 행 보호, C-RLS).
- **함정 2**: 동시 나가기 → `for update` 누락 시 고아 빈 방(C-CONC). 멤버십 삭제 **전에** 방 행 잠금.
- **함정 3**: 방 삭제는 **잔여 count 0 확인 후에만**(먼저 지우면 CASCADE로 상대 멤버까지 삭제).
- **상태 전이**: `goToRoom`(OnboardingScreen)의 거울 — `void refresh(); navigation.reset({index:0, routes:[{name: Onboarding}]})`. ProfileScreen에 `useMembershipContext` import 추가.
- **에러 매핑**: 신규 토큰 없음. `mapRoomError` 재사용(`NOT_AUTHENTICATED`/기본). `LEAVE_ROOM_BAD_RESPONSE`는 훅 내부 가드용(매핑은 기본 메시지로 흡수).
- **TDD**: `useLeaveRoom.spec.ts`(성공/멱등/에러/BAD_RESPONSE) → `ProfileScreen.spec.tsx`(나가기 버튼·Alert 확인 콜백 전이) 순. `Alert.alert` 모킹해 confirm 콜백 직접 호출.
- git 작업 금지(사용자 전담). 실 Supabase 적용도 사용자.
