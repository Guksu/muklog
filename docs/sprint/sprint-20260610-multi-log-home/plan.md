# Sprint: 멀티 로그 전환 (multi-log-home)

> 입력: `docs/design/architecture.md`(§1 로그 멤버십 모델, §3 멀티 로그 멤버십·정원2·솔로조인 허용, §4 AuthGate→HomeTabs·+버튼 액션시트·LogScreen, §5 `multi-log-home` 행, §7 멀티 로그 전환 미정 사항).
> 기존 산출: `supabase/migrations/20260609120000_invite_room.sql`(rooms/room_members·RLS·정원 트리거·create_room/join_room), `20260610130000_room_modes.sql`(mode 컬럼·삭제 라이프사이클 컬럼·모드별 정원·솔로가드), `20260610140000_room_leave.sql`(leave_room), `src/features/room/*`(useMembership·useCreateRoom·useJoinRoom·useLeaveRoom·errors·modes·code·MembershipProvider), `src/navigation/*`(AuthGate·MembershipGate·AppNavigator·RoomTabs·routes·ProfileHeaderButton·OnboardingScreen·ProfileScreen·MapTabScreen·MuklogTabScreen).
> 산출물: 이 plan.md → developer 구현(dev-notes.md) → qa-inspector 검증(qa-report.md). **TDD 전제**(Red→Green→Refactor, `npm test` 통과가 완료 기준).

---

## 1. 기능 한줄 정의

앱을 **"1인 1방"에서 "1인 多로그"로 전환**한다. 인증 직후 온보딩/멤버십 게이트 없이 **HomeTabs로 직행**하고, 먹로그 탭은 **내가 속한 로그들의 카드 목록**(빈 상태 포함)을 보여주며, 헤더 **+버튼으로 로그 생성**, 카드 탭으로 **LogScreen(이번엔 최소 stub)**에 진입한다. 백엔드는 **로그 정원 2 통일 + 솔로 로그 조인 허용 + 다중 로그 멤버십**을 지원한다(`join_room` 변경은 선반영, **로그 입장 UI는 `log-invite`로 분리** — §2-결정 ★(1)).

> **용어**: "로그(log)" = 기존 "방(room)"의 UI 이름. DB 테이블명 `rooms`/`room_members`는 유지. "먹로그(muklog entry)" = 로그 안의 맛집 기록(이번 스프린트 미구현).

---

## 2. 범위

### In-scope
- **마이그레이션(신규 파일 `20260610150000_multi_log_home.sql`)**: ① `enforce_room_capacity` 정원 2 통일(모드별 solo=1 폐기). ② `create_room` **1인1방 가드(`ALREADY_IN_ROOM`) 제거** → 한 사용자가 여러 로그 생성 가능. ③ `join_room` **솔로 거부(`SOLO_ROOM_NOT_JOINABLE`) 제거 + 타방 `ALREADY_IN_ROOM` 제거**(같은 로그 재조인은 멱등 유지). ④ **`list_my_rooms()` DEFINER RPC 신설** — 내가 속한 로그 + 멤버 수 집계. 기존 마이그레이션 파일은 미수정(additive·idempotent).
- **데이터 훅**: `useMyLogs` + `MyLogsProvider`(목록 조회/refresh, context). `useMembership`(단일 maybeSingle) **대체**.
- **게이트 제거**: `AuthGate` 인증 후 곧바로 `NavigationContainer`+`AppNavigator`(HomeTabs 직행). `MembershipGate`/`MembershipProvider`/`useMembership` **삭제**. `OnboardingScreen` **삭제**.
- **네비게이션 재구성**: `RoomTabs`→`HomeTabs`(먹로그 탭=`LogListScreen`, 지도 탭=`MapTabScreen` 유지/stub). 스택에 `LogScreen`(파라미터 `{ roomId }`)·`JoinLogScreen` 추가. `Routes` 갱신(Onboarding 제거, HomeTabs/LogList/LogScreen/JoinLog 추가).
- **헤더 +버튼(액션시트)**: HomeTabs 헤더 우측에 `PlusHeaderButton`(액션시트 `Alert.alert`: "로그 생성"/"로그 입장"/"취소") + 기존 `ProfileHeaderButton` 공존.
- **로그 생성 흐름**: 액션시트 "로그 생성" → `create_room`(모드 선택 없음, 정원2 기본) → `myLogs.refresh()` → LogList 카드 +1. 실패 시 `Alert`로 메시지.
- **로그 입장 흐름(IN — as-built)**: 액션시트 "로그 입장" → `JoinLogScreen`(초대코드 입력, 기존 `normalizeInviteCodeInput` 재사용) → `join_room` → `myLogs.refresh()` → `goBack`. 실패 시 인라인 `joinError`·입력 보존.
- **LogListScreen**: 카드 목록 + **빈 상태(로그 0개 = 정상, 에러 아님)** + 카드 탭→`LogScreen`.
- **LogScreen(최소 stub)**: `roomId` 파라미터 표시 placeholder.
- **ProfileScreen 정리**: `Routes.Onboarding` reset 제거(라우트 삭제), `useMembershipContext`·`useLeaveRoom`·"방 나가기" 섹션 제거(멀티 로그에서 단일 나가기 의미 상실 — §2-결정 ★(2)). 닉네임/아바타 편집은 불변.
- **`leave_room` 多로그 호환 인자화 + wiring 0 (as-built 확정)**: `leave_room()`(무인자) → **`leave_room(p_room_id uuid)`**(`drop`+`create`). `useLeaveRoom({ roomId })`로 시그니처 갱신(+spec). **UI 호출부 없음**(Profile 나가기 제거 — 어느 화면도 `useLeaveRoom` 미연결, grep 0 확인). 차기 LogScreen 로그별 나가기가 사용. (developer가 코멘트에 쓴 "dormant"는 *미호출*을 뜻하며, **시그니처는 인자화됨** — §아래 결정 변경 이력.)

### Out-of-scope (as-built 수용 — team-lead 최종)
> **트리밍 철회**: developer가 컷라인 미적용으로 **로그 입장(join) UI까지 구현 완료**(24 suites/153 green). team-lead가 as-built 수용 결정 → **join UI = IN(검증 대상)**, log-invite는 "초대코드 표시·복사"만 남김.
- **초대코드 표시·복사 UI**(이 로그의 6자리 코드 표시 → 파트너 초대=커플화) — `log-invite` 스프린트(LogScreen 내부). (로그 입장/join은 이번 슬라이스에서 done.)
- **로그별 나가기 UI**(LogScreen 내 "로그 나가기" 배치) — 차기 슬라이스. `leave_room(p_room_id)`·`useLeaveRoom({roomId})`는 이번에 **인자화 선반영(as-built)**, **UI wiring은 차기**(§3.7-leave). ⚠️ 차기 전까지 화면 연결 금지.
- **초대코드 표시·복사 UI**(파트너 초대=커플화) — `log-invite`(LogScreen 내부).
- **맛집 먹로그 엔트리**(리스트/작성/상세) — `muklog-list`/`muklog-editor`/`muklog-detail`.
- **지도 본구현**(Kakao Map·핀·viewport 조회) — `map-tab`. 이번엔 기존 stub 유지.
- **로그 이름 편집·대표 이미지·로그 이름 자동생성 고도화** — §7 미정, 추후.
- **다중 로그 Realtime 구독** — 콘텐츠 스프린트 시 비용 검토(§7).
- `errors.ts` 본문 변경(불변·회귀 0). (`useJoinRoom`은 IN — JoinLogScreen이 사용. `modes.ts` 정원2·`leave_room`/`useLeaveRoom` 인자화 → In-scope.)

---

## 2-결정. 핵심 설계 결정 (team-lead 확인 요망 항목 ★)

### ★(1) 스코프 — as-built 수용(전체 스코프, join UI IN) (team-lead 최종)
**트리밍 철회.** developer가 컷라인 미적용으로 **로그 입장(join) UI 포함 전체 스코프**로 구현·테스트 완료(24 suites/153 green, tsc 0). team-lead가 **as-built 수용**(재작업 0) 최종 결정 → join UI를 검증 대상으로 복원. 근거: 이미 구현·green + 사용자 명시 의도("+버튼 → 로그 생성/로그 입장")와 일치.
- **이번 슬라이스 범위(IN)**: 게이트 제거 + 내 로그 목록(`list_my_rooms` DEFINER RPC) + 빈 상태 + **로그 생성** + **로그 입장(JoinLogScreen + 액션시트 입장 분기)** + `LogScreen` stub.
- **마이그레이션 전체 적용**: `join_room`(멤버십 room_id 스코프화·SOLO 거부 제거·정원2) + `create_room`(가드 제거) + `enforce_room_capacity`(2) + `modes.ts ROOM_CAPACITY`(2) + `leave_room(p_room_id)` 인자화 + `list_my_rooms`.
- **+버튼 = 액션시트**("로그 생성"/"로그 입장"/"취소"). join은 이번 **UI까지 검증**(C4/C5 UI 정합 포함).
- **백로그 갱신**: `multi-log-home` = "로그 입장 UI 포함"으로, `log-invite` = "초대코드 표시·복사만"으로 축소(join은 done). architecture.md §4/§5 정합(developer 일부 갱신 — 중복/모순만 정리).

### ★(2) ProfileScreen "방 나가기" 버튼 제거 + `leave_room(p_room_id)` 인자화 + wiring 0 (as-built 확정)
> **결정 변경 이력 / as-built 정합**: dormant↔인자화로 수차례 오갔으나, **실제 구현(as-built)을 정본으로 채택**한다. 코드 사실:
> - 마이그레이션 `20260610150000`: `drop function leave_room()` + `create leave_room(p_room_id uuid)` → **인자화됨**.
> - `useLeaveRoom.ts`: `leaveRoom({roomId})` → `rpc('leave_room', { p_room_id })`. `useLeaveRoom.spec`: `{p_room_id:'r1'}` 단언. **인자화됨**.
> - 화면 wiring: `useLeaveRoom` import는 `index.ts` export뿐 — **어느 화면도 미연결(wiring 0)**.
> ⚠️ team-lead 최종 메시지는 "leave dormant(인자화 철회)"를 지시했으나, 이는 developer 코멘트의 *"dormant=미호출"*을 *"시그니처 미변경"*으로 오해한 것이다. **실제 as-built는 인자화 시그니처 + 호출부 없음**. team-lead의 오버라이딩 원칙("as-built 수용·재작업 0·QA 불일치 방지")에 따라 **plan/QA를 as-built(인자화+wiring 0)로 유지**한다(dormant로 되돌리면 멀쩡한 코드를 되돌리는 재작업 발생). → team-lead에 사실관계 정정 보고함.
- 현재 `ProfileScreen`은 `leaveRoom()` 후 `navigation.reset(Routes.Onboarding)` 한다. 이번에 **Onboarding 라우트가 삭제**되므로 이 흐름은 **반드시 변경**된다(미변경 시 런타임 크래시).
- `leave_room()`(무인자) RPC는 `select room_id into v_room_id from room_members where user_id=v_uid`로 **단일 멤버십을 가정** → 多로그에서 깨짐. → **`leave_room(p_room_id uuid)`로 인자화**해 미리 호환(지뢰 제거).
- **결정**: ① **Profile "방 나가기" 버튼 제거** → Profile은 닉네임/아바타 편집 본래 역할로 환원. `useMembershipContext`·`useLeaveRoom` 의존(ProfileScreen.tsx:25,48,53,123-139)과 `navigation.reset(Onboarding)`(:127) 자연 해소. ② **`leave_room`→`leave_room(p_room_id)` + `useLeaveRoom({roomId})` 선반영**(§3.4-leave/§3.7-leave). **UI 호출부는 차기 LogScreen**(이번 wiring 금지).
- 근거: 멀티 로그에서 "로그를 빠져나가는 행위"는 본질적으로 **로그 컨텍스트(LogScreen)**에 속한다. Profile(계정 설정)에 단일 나가기를 두는 것은 모델과 충돌. 막힘 없음(로그 목록 이동·다른 로그 사용 가능).
- **이 변경은 "회귀"가 아니라 멀티 로그 전환에 따른 의도된 변경**(§3.10 판정표). ProfileScreen.spec의 leave 케이스는 대체/삭제 정당. 닉네임/아바타 편집·create/profile 로직은 불변.
- architecture.md §4·§7도 "나가기 진입점: Profile 하단 → LogScreen 내부(로그별)로 이전 검토"를 명시 → 본 결정과 정합.

### (3) `list_my_rooms()` RPC 채택 (vs 클라 직접 select) — 결정
- **RPC(SECURITY DEFINER) 채택.** 이유: 멤버 수 집계가 **클라 직접 select로 불가능**하다. `room_members` RLS는 `user_id = auth.uid()`(자기 행만) → 클라가 보는 멤버 행은 로그당 **항상 1행** → `count`가 언제나 1로 나와 솔로/커플 구분 불가. 파트너 멤버 행을 보려면 RLS 완화(자기참조 재귀 위험·invite_room.sql:73 주석)나 DEFINER가 필요.
- DEFINER RPC가 **단일 왕복**으로 "내 로그들 + 정확한 멤버 수"를 반환 → 비용·정합 모두 우수. create/join/leave와 동일 패턴.

### (4) 로그 카드 표시 항목 — 최소화 결정
- **로그 이름 없음(자동/생략).** 이번엔 사용자 지정 이름·대표 이미지 모두 **미도입**(§7 미정 → 추후). 근거: 이름 입력 UI·검증·스키마(rooms에 name 컬럼) 추가는 별도 슬라이스 분량. 대표 이미지는 먹로그 엔트리(muklog-list)에 의존.
- **카드 표시**: ① **멤버 배지**("혼자" = 멤버 1 / "둘이" = 멤버 2) — **멤버 수에서 파생**(architecture §1·§3, `mode` 컬럼 아님). ② **생성일**(`created_at`, 예 `2026.06.10`). ③ chevron(탭 가능 암시).
- **한계(문서화)**: 이름이 없어 같은 날 만든 동종 로그는 외형이 유사할 수 있음 → MVP 허용. 추후 "로그 이름" 슬라이스에서 해소. (필요 시 dev가 `room_id` 축약/순번 표기 추가 가능하나 기본은 배지+날짜.)

### (5) 목록 갱신 방식 — 결정
- `useMyLogs`는 **Provider 마운트 시 1회 조회 + 명시적 `refresh()`**(생성/입장 성공 후). **폴링·focus 주기조회 없음**(비용 가드레일, 기존 useMembership "진입 1회 + 성공 후 refresh" 정책 계승).
- 생성은 LogList 헤더(+버튼)에서 일어나 화면 전환이 없으므로 **`refresh()` 직접 호출**로 카드 즉시 반영. 입장은 `JoinLogScreen`에서 `refresh()` 후 `goBack` → 복귀 시 최신.

---

## 3. 데이터 · API 계약

> 마이그레이션은 **신규 파일** `supabase/migrations/20260610150000_multi_log_home.sql`(기존 invite_room/room_modes/room_leave 미수정 — 이미 적용된 환경 고려, additive). 재실행 가능(idempotent: `create or replace`). 실 Supabase 적용은 **사용자 환경 의존**(dev-notes 명시). SQL/RPC/트리거는 단위 대상 아님 → 클라는 모킹 응답으로 계약 검증, 실DB는 사용자 스모크.

### 3.0 현재 DB 사실 (계약 전제)
- 존재 테이블: `profiles`, `rooms`(+`mode`/`delete_scheduled_at`/`delete_requested_by`), `room_members`. `muklogs`/`muklog_photos`는 아직 없음.
- `room_members.room_id → rooms ON DELETE CASCADE`. PK `(room_id, user_id)` → 동일인 동일 로그 중복 INSERT 차단.
- RLS: `rooms` select=본인 멤버 로그만 / `room_members` select=자기 행만(`user_id=auth.uid()`). insert/delete 정책 없음 → DEFINER RPC만 쓰기.
- 트리거 `trg_room_capacity`(before insert on room_members) → `enforce_room_capacity()`.

### 3.1 `enforce_room_capacity()` — 정원 2 통일 (replace)
모드 분기 제거, 모든 로그 정원 2 고정.
```sql
create or replace function public.enforce_room_capacity()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.room_members where room_id = new.room_id) >= 2 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
```
> 트리거 자체(`trg_room_capacity`)는 재생성 불필요(본문만 교체). 결과적으로 invite_room.sql의 정원2 의미로 환원(room_modes의 solo=1 폐기).

### 3.2 `create_room(p_mode text default 'couple')` — 1인1방 가드 제거 (replace)
room_modes 버전에서 **다음 블록만 삭제**:
```sql
-- 삭제 대상(멀티 로그: 여러 로그 생성 허용)
if exists (select 1 from public.room_members where user_id = v_uid) then
  raise exception 'ALREADY_IN_ROOM';
end if;
```
나머지(NOT_AUTHENTICATED 검사·profiles 안전망·코드생성 루프·rooms/room_members INSERT·반환)는 유지. 기본 `p_mode='couple'` → 정원 2.
- 반환: `{ "room_id": uuid, "invite_code": text, "mode": text }`(불변).
- 에러토큰: `NOT_AUTHENTICATED` / `INVALID_MODE` / `CODE_GENERATION_FAILED`. (**`ALREADY_IN_ROOM` 더 이상 raise 안 함**.)
- 권한 재선언: `revoke ... from public, anon; grant execute ... to authenticated;`(시그니처 `(text)` 동일).

### 3.3 `join_room(p_code text)` — 솔로거부·타방 가드 제거 (replace)
멀티 로그 조인 규칙으로 재작성:
```sql
create or replace function public.join_room(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text; v_room_id uuid; v_count int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  v_code := upper(trim(p_code));

  select id into v_room_id from public.rooms where invite_code = v_code;
  if v_room_id is null then raise exception 'INVALID_CODE'; end if;

  -- 같은 로그 재조인 → 멱등 성공(PK 중복 INSERT 방지·중복 탭 안전).
  if exists (select 1 from public.room_members where room_id = v_room_id and user_id = v_uid) then
    return jsonb_build_object('room_id', v_room_id);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 1자리 동시 조인 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 2 then raise exception 'ROOM_FULL'; end if;

  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);
  return jsonb_build_object('room_id', v_room_id);
end;
$$;
```
- **제거된 것**: `SOLO_ROOM_NOT_JOINABLE` 가드(솔로 로그도 조인→커플화), **타방 `ALREADY_IN_ROOM`**(여러 로그 동시 소속 허용).
- **유지**: `INVALID_CODE`·`ROOM_FULL`·`NOT_AUTHENTICATED`·`for update` 잠금·같은 로그 멱등(이제 **로그별 멤버십 PK 존재 검사**로 판정).
- 반환: `{ "room_id": uuid }`(불변). 권한 재선언 동일.

### 3.4 `list_my_rooms()` — 내 로그 목록 RPC (신설, SECURITY DEFINER)
```sql
create or replace function public.list_my_rooms()
returns table (
  room_id      uuid,
  mode         text,
  member_count int,
  created_at   timestamptz,
  joined_at    timestamptz
)
language sql security definer set search_path = public as $$
  select r.id, r.mode,
         (select count(*)::int from public.room_members m2 where m2.room_id = r.id) as member_count,
         r.created_at, rm.joined_at
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;
revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;
```
- **반환 행 집합**(0행 = 빈 목록 = 정상). `member_count`는 **DEFINER로 전 멤버 집계**(RLS 우회) → 솔로/커플 파생 가능.
- 정렬: `joined_at desc`(최근 합류 로그 상단). `created_at`도 반환(표시·정렬 보조).
- **스코프 안전**: `where rm.user_id = auth.uid()` → **내 로그만**(DEFINER이므로 스코프 명시 필수, C-RLS).
- 에러: 정상 시 raise 없음. 세션 없음 시 `auth.uid()` null → 0행(클라는 빈 목록으로 처리). DB/네트워크 예외만 error 상태.

### 3.4-leave `leave_room(p_room_id uuid)` — 多로그 호환 인자화 (replace + drop, 백엔드 선반영)
**문제**: 기존 `leave_room()`(무인자)는 `select room_id into v_room_id from room_members where user_id=v_uid`로 **단일 멤버십을 가정**. 多로그에서 여러 멤버십 행 → "어느 로그?" 모호·깨짐. 지뢰로 두지 않고 인자화한다(UI 호출부는 차기).
```sql
-- 무인자 버전 제거(오버로드 함정 회피 — create_room 교훈).
drop function if exists public.leave_room();

create or replace function public.leave_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_member boolean;
  v_remaining int;
  v_deleted boolean := false;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- 해당 로그 멤버 여부(멱등: 멤버 아니면 성공으로 흡수).
  select exists(select 1 from public.room_members
                where room_id = p_room_id and user_id = v_uid) into v_member;
  if not v_member then
    return jsonb_build_object('room_deleted', false, 'room_id', null);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 두 멤버 동시 나가기 → 고아 빈 로그 방지).
  perform 1 from public.rooms where id = p_room_id for update;

  -- 본인 행만 삭제(DEFINER RLS 우회 → 스코프 명시 필수, C-RLS).
  delete from public.room_members where room_id = p_room_id and user_id = v_uid;

  select count(*) into v_remaining from public.room_members where room_id = p_room_id;
  if v_remaining = 0 then
    delete from public.rooms where id = p_room_id;  -- FK CASCADE로 하위 정리
    v_deleted := true;
  end if;

  return jsonb_build_object('room_deleted', v_deleted, 'room_id', p_room_id);
end;
$$;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;
```
- room-leave 스프린트의 안전장치(`for update` 잠금·본인 행 스코프·count 후 삭제·잔여≥1 보존) **모두 유지**, 대상만 `p_room_id`로 스코프.
- 반환 `{ room_deleted, room_id }` 형태 불변(멱등 시 `room_id: null`).
- **이번 슬라이스엔 UI 호출부 없음**(Profile 나가기 제거) → 차기 LogScreen이 사용. RPC/훅 계약만 미리 정합(⚠️ 이번 wiring 금지).

### 3.5 프론트 훅 — `useMyLogs` / `MyLogsProvider` (`src/features/room/`)
```ts
export type MyLog = {
  roomId: string;
  mode: RoomMode;        // 레거시(표시는 memberCount 파생). 'solo'|'couple'
  memberCount: number;   // 1 | 2
  createdAt: string;     // ISO
  joinedAt: string;      // ISO
};
export type MyLogsState =
  | { status: 'loading' }
  | { status: 'ready'; logs: MyLog[] }   // logs:[] = 빈 상태(정상, 에러 아님)
  | { status: 'error'; message: string };

export const useMyLogs = ({ userId }: { userId: string }) => {
  // 내부: supabase.rpc('list_my_rooms') (인자 없음)
  //   → rows(snake) → MyLog[](camel) 매핑. room_id→roomId, member_count→memberCount, created_at→createdAt, joined_at→joinedAt
  //   → error → { status:'error', message:'로그 목록을 불러오지 못했어요. 다시 시도해 주세요.' }
  //   → 마운트 1회 조회([userId] 의존) + refresh()(폴링 금지, useMembership 정책 계승)
  return { state: MyLogsState, refresh: () => Promise<void> };
};
```
- `MyLogsProvider`(`useMyLogs` 래핑) + `useMyLogsContext()` → `{ state, refresh }`. **`MembershipProvider`/`useMembershipContext` 대체**.
- `index.ts` 공개표면: `useMyLogs`, `MyLogsProvider`, `useMyLogsContext`, `type MyLog`, `type MyLogsState` 추가. `useMembership`/`MembershipProvider`/`useMembershipContext`/`MembershipState` **제거**.

### 3.6 `useCreateRoom` — 모드 선택 제거(인자 옵션화)
- `createRoom({ mode }: { mode?: RoomMode } = {})` — **mode 옵션화**. 미지정 시 `rpc('create_room')`를 **p_mode 없이 호출**(RPC default 'couple' → 정원2). 지정 시 기존대로 전달(호환).
- 반환 `CreateRoomResult`(불변). 신규 생성 UI는 `createRoom()`(무인자) 호출.
- 기존 `useCreateRoom.spec`는 mode 명시 케이스 → 통과 유지. 무인자 케이스 1건 추가.

### 3.7-leave `useLeaveRoom` — 인자화(roomId) 선반영
- `leaveRoom({ roomId }: { roomId: string })` → `supabase.rpc('leave_room', { p_room_id: roomId })`. 반환 `LeaveRoomResult = { roomDeleted, roomId }` 불변(매핑·BAD_RESPONSE 가드 동일).
- **spec 갱신**: `useLeaveRoom.spec.ts`의 `toHaveBeenCalledWith('leave_room')`(무인자) → `toHaveBeenCalledWith('leave_room', { p_room_id: 'r1' })`, 호출도 `leaveRoom({ roomId: 'r1' })`로. 나머지 케이스(멱등/에러/BAD_RESPONSE/loading) 그대로.
- `index.ts`의 `useLeaveRoom` export 유지. ⚠️ **이번 슬라이스 wiring 금지**(화면 연결 없음 — Profile 나가기 제거). 차기 LogScreen 나가기가 사용.

### 3.8 에러 매핑 — 변경 없음
- `errors.ts` **본문 미변경**(회귀 0). `SOLO_ROOM_NOT_JOINABLE`·`ALREADY_IN_ROOM` 항목은 이제 **dormant**(RPC가 더는 raise 안 함)이나 매핑에 남겨도 무해 → 유지. 신규 토큰 불필요. join 실패는 `INVALID_CODE`/`ROOM_FULL`/기본 메시지로 충분.

### 3.9 `modes.ts` `ROOM_CAPACITY` 정원2 동기화 (QA 충돌 #2 — 생산자↔상수 일치)
- `enforce_room_capacity`가 모드 무관 정원2로 통일되므로 `ROOM_CAPACITY = { solo:1, couple:2 }`의 **`solo:1`은 stale·생산자와 불일치**. → **`ROOM_CAPACITY = { solo: 2, couple: 2 }`로 동기화**(트리거 정원식과 단일 출처 유지, C6).
- **spec 갱신**: `modes.spec.ts`의 "solo 정원은 1" 케이스 → `expect(ROOM_CAPACITY.solo).toBe(2)`로 수정(의도된 변경). `ROOM_MODES` 케이스는 불변.
- (선택) dev가 모드-독립 단일 상수(`ROOM_CAPACITY_MAX = 2`)로 단순화해도 무방하나, 다른 소비처 영향 점검 후. 기본은 map 값만 동기화.

### 3.10 의도된 변경 vs 회귀 판정 (QA 1:1 매핑용)
| 항목 | 판정 | 근거 |
|------|------|------|
| `create_room` `ALREADY_IN_ROOM` 가드 제거 | **의도된 변경** | 多로그: 2번째 로그 생성 허용(QA #1). 안 고치면 +버튼 생성 막힘 |
| `join_room` 타방 `ALREADY_IN_ROOM` 제거·로그별 멤버십 스코프 | **의도된 변경** | 多로그: 2번째 로그 조인 허용(QA #2) |
| `join_room` `SOLO_ROOM_NOT_JOINABLE` 제거 | **의도된 변경** | 솔로 로그 조인→커플화(architecture §1·§3) |
| `enforce_room_capacity` solo=1 폐기→2 통일 + `ROOM_CAPACITY.solo`=2 | **의도된 변경** | 정원2 통일, 생산자↔상수 동기화(QA #2) |
| `leave_room()`→`leave_room(p_room_id)` + `useLeaveRoom({roomId})` (선반영) | **의도된 변경** | 多로그 단일행 가정 충돌 제거. ⚠️ 이번 UI wiring 없음(차기 LogScreen) |
| `useMembership`/`MembershipProvider`/`MembershipGate`/`OnboardingScreen` 삭제 | **의도된 변경** | 게이트 폐기(architecture §1·§4). 관련 spec 삭제 정당 |
| ProfileScreen 나가기 제거·`Onboarding` reset 제거 | **의도된 변경** | §2-결정 ★(2). ProfileScreen.spec leave 케이스 대체/삭제 |
| `create_room`/`join_room` 정상 매핑·`errors.ts`·`code.ts`·닉네임/아바타 편집 | **불변(회귀 0)** | 기존 동작·spec 유지 |

---

## 4. 화면 · UX · 네비게이션

### 4.1 라우트 (`routes.ts`)
```ts
export const Routes = {
  HomeTabs: 'HomeTabs',     // was RoomTabs
  LogList: 'LogList',       // was MuklogTab (탭1)
  MapTab: 'MapTab',         // 유지(stub)
  Profile: 'Profile',       // 유지
  LogScreen: 'LogScreen',   // 신규(스택)
  JoinLog: 'JoinLog',       // 신규(스택, 초대코드 입력 — as-built IN)
} as const;
// 제거: Onboarding, RoomTabs, MuklogTab.
export type AppStackParamList = {
  [Routes.HomeTabs]: undefined;
  [Routes.Profile]: undefined;
  [Routes.LogScreen]: { roomId: string };
  [Routes.JoinLog]: undefined;
};
export type HomeTabParamList = { [Routes.LogList]: undefined; [Routes.MapTab]: undefined };
```

### 4.2 게이트 제거 (`AuthGate` 재작성)
```
AuthGate
  loading       → SplashView
  error         → AuthErrorView(retry)
  authenticated → <MyLogsProvider userId>
                    <NavigationContainer>
                      <AppNavigator />   // initialRoute 고정 = HomeTabs
                    </NavigationContainer>
                  </MyLogsProvider>
```
- `MembershipGate`·`MembershipProvider`·`useMembership` 삭제. `AppNavigator`는 `initialRouteName` prop 불필요(항상 HomeTabs).
- `AppNavigator` 등록: `HomeTabs`(stack 첫 화면, headerShown false) / `Profile`(header 표시, 기존) / `LogScreen`(header 표시, title "로그") / `JoinLog`(header 표시, title "로그 입장"). **Onboarding 제거**.

### 4.3 HomeTabs (`RoomTabs`→`HomeTabs`)
- 탭1 `LogList` = `LogListScreen`(title "먹로그", 디폴트). 탭2 `MapTab` = `MapTabScreen`(title "지도", 기존 stub 유지).
- 헤더 우측: **`headerRight`에 [+버튼][프로필버튼]을 가로로** 렌더(`<View row>` 안에 `PlusHeaderButton`+`ProfileHeaderButton`). 토큰 spacing 사용.

### 4.4 +버튼 액션시트 (`PlusHeaderButton`) — as-built
- `accessibilityLabel="로그 추가"`. 누르면 액션시트(`Alert.alert`): 제목 "로그 추가" / 버튼 **"로그 생성"**, **"로그 입장"**, "취소".
  - "로그 생성" → `handleCreate`: `await createRoom()`(무인자) → `myLogs.refresh()`. 화면전환 없음 → 카드 즉시 반영. 실패 시 `Alert.alert('로그 생성 실패', mapRoomError(...))`(헤더엔 인라인 영역 없음).
  - "로그 입장" → `navigation.navigate(Routes.JoinLog)`.
- 의존: `useCreateRoom` + `useMyLogsContext` + `useNavigation`. (MyLogsProvider 하위라 컨텍스트 접근 가능.)
- 스펙: `useCreateRoom`/`useMyLogsContext`/`useNavigation`/`Alert` 모킹 — 액션시트 버튼 콜백 직접 호출로 생성→refresh / 입장→navigate / 실패→Alert 검증.

### 4.5 LogListScreen (탭1, 신규)
- `useMyLogsContext()` 소비.
  - `loading` → 중앙 `ActivityIndicator`(testID `loglist-loading`).
  - `error` → 메시지 + "다시 시도"(→ `refresh()`).
  - `ready` & `logs.length === 0` → **빈 상태**: "아직 로그가 없어요" + 가이드("오른쪽 위 + 버튼으로 로그를 만들어 보세요"). (에러 아님.)
  - `ready` & `logs.length > 0` → 카드 리스트(`FlatList` 또는 `map`).
- **카드**(`LogCard`): 멤버 배지("혼자"/"둘이" — `memberCount===2 ? '둘이' : '혼자'`) + 생성일(`createdAt` → `YYYY.MM.DD`) + chevron. `accessibilityRole="button"`. 탭 → `navigation.navigate(Routes.LogScreen, { roomId })`.
- 스타일 원티드 토큰만(raw hex 0).

### 4.6 JoinLogScreen (신규, IN — as-built)
- `useJoinRoom` + `useMyLogsContext` + `useNavigation`.
- UI: 안내문 + `TextInput`(`onChangeText`=`normalizeInviteCodeInput`, `autoCapitalize="characters"`, `maxLength=INVITE_CODE_LENGTH`) + "입장"(`disabled=!isInviteCodeComplete`, `loading=joining`) + 인라인 `joinError`.
- `handleJoin`: `await joinRoom({ code })` → `await myLogs.refresh()` → `navigation.goBack()`. 실패 → `joinError` 인라인, 화면 유지(입력 보존).

### 4.7 LogScreen (신규, 최소 stub)
- `route.params.roomId` 수신. placeholder: "로그 화면 (준비 중)" + 작게 roomId. (초대코드 표시·먹로그 리스트는 OUT-OF-SCOPE.)
- `roomId` 누락 방어: 없으면 "로그를 찾을 수 없어요" 표시(크래시 방지).

### 4.8 ProfileScreen 정리
- `useMembershipContext`·`useLeaveRoom`·"방 나가기" 섹션·`confirmLeave`/`handleLeave` **제거**. `Routes.Onboarding` 참조 제거(라우트 삭제).
- 닉네임/아바타 편집(useProfile/useUpdateProfile)은 **불변**(회귀 0). `useAuth` 분기·진입 경로(헤더 ProfileHeaderButton) 유지.

### 4.9 전이 다이어그램
```
AuthGate(authenticated) → HomeTabs(LogList 디폴트)
  [+] → 액션시트
        ├ 로그 생성 → createRoom() → myLogs.refresh() → LogList 카드 +1
        └ 로그 입장 → JoinLog → joinRoom(code) → refresh() → goBack → LogList 갱신
  카드 탭 → LogScreen(roomId)
  [프로필] → Profile (나가기 버튼 없음 — 로그별 나가기는 차기 LogScreen)
빈 상태: ready & logs:[] → "아직 로그가 없어요" + + 버튼 안내
```

---

## 5. 작업 목록 (모듈 단위, TDD 순서)

> 각 모듈 **Red(스펙)→Green(구현)→Refactor**. SQL/RPC/트리거는 단위 대상 아님 → 모킹 응답/에러로 클라 계약 검증 + 실DB는 사용자 스모크(testing-strategy). 컨벤션 100% 준수(useCallback/useMemo 지양·화살표함수·named-args·useEffect 명명·enum-style 상수·원티드 토큰).

- [ ] **T1. 마이그레이션 `20260610150000_multi_log_home.sql`** (SQL 스모크) — 인수: ① `enforce_room_capacity` 정원2 통일. ② `create_room` `ALREADY_IN_ROOM` 가드 제거(다중 생성 가능, 나머지 불변). ③ `join_room` `SOLO_ROOM_NOT_JOINABLE`·타방 `ALREADY_IN_ROOM` 제거 + 같은 로그 멤버십 PK 멱등 + 정원2 + `for update` 유지. ④ `list_my_rooms()`(DEFINER, `set search_path=public`, `where user_id=auth.uid()`, member_count 집계, joined_at desc) 신설 + grant/revoke. ⑤ **`leave_room` 인자화**: `drop function leave_room()` → `leave_room(p_room_id uuid)`(for update·본인행 스코프·count 후 삭제·잔여≥1 보존 유지) + grant/revoke(uuid). idempotent(`create or replace`). 기존 파일 미변경. join_room 변경은 log-invite가 쓰도록 선반영하되 join은 이번 SQL 스모크만.
- [ ] **T2. `useMyLogs` + `MyLogsProvider`** (스펙 먼저 Red) — 인수: `rpc('list_my_rooms')` 인자없이 호출, rows snake→`MyLog[]` camel 매핑, **빈 배열→`ready`(에러 아님)**, error→`error` 상태, 마운트 1회 조회 + `refresh()`(폴링 없음). `useMyLogsContext` Provider 밖 호출 시 throw. supabase 모킹.
- [ ] **T3. `useCreateRoom` 인자 옵션화** (스펙 보강) — 인수: 무인자 `createRoom()` → `rpc('create_room')`를 **p_mode 없이** 호출. mode 명시 시 기존대로 전달. 반환 매핑 불변. 기존 스펙 그린 + 무인자 케이스 추가.
- [ ] **T3b. `modes.ts` 정원2 동기화** (스펙 갱신) — 인수: `ROOM_CAPACITY = { solo:2, couple:2 }`(트리거 정원식 일치, C6). `modes.spec`의 "solo 정원은 1"→2 수정. `ROOM_MODES` 불변.
- [ ] **T3c. `useLeaveRoom` 인자화** (스펙 갱신) — 인수: `leaveRoom({ roomId })` → `rpc('leave_room', { p_room_id: roomId })`. `useLeaveRoom.spec` 호출/단언 갱신(나머지 케이스 유지). 반환 매핑 불변. ⚠️ **이번 화면 wiring 없음**(차기 LogScreen).
- [ ] **T4. `index.ts` 공개표면 교체** — 인수: `useMyLogs`/`MyLogsProvider`/`useMyLogsContext`/`MyLog`/`MyLogsState` export 추가, `useMembership`/`MembershipProvider`/`useMembershipContext`/`MembershipState` export 제거. `useLeaveRoom`/`LeaveRoomResult` 유지. tsc 통과.
- [ ] **T5. `routes.ts` 갱신** — 인수: `HomeTabs`/`LogList`/`LogScreen`(param `{roomId}`)/`JoinLog` 추가, `Onboarding`/`RoomTabs`/`MuklogTab` 제거. 파라미터 타입 갱신. tsc 통과(소비처 동반 수정).
- [ ] **T6. `AuthGate` 재작성 + `AppNavigator` 갱신** (스펙 먼저 Red) — 인수: authenticated → `MyLogsProvider`+`NavigationContainer`+`AppNavigator`(HomeTabs 직행, 게이트 없음). loading/error 분기 유지. `AppNavigator`에 HomeTabs/Profile/LogScreen/JoinLog 등록, Onboarding 제거. `MembershipGate`/`MembershipProvider`/`useMembership`(+spec) 삭제. NavigationContainer 모킹.
- [ ] **T7. `HomeTabs`(RoomTabs 리네임) + `PlusHeaderButton`** (스펙 먼저 Red) — 인수: 탭 LogList/MapTab, 헤더 우측 [+][프로필] 공존. +버튼 누르면 액션시트(로그생성/로그입장/취소). "로그 생성"→`createRoom()`+`refresh()`, "로그 입장"→`navigate(JoinLog)`. 실패 시 `Alert.alert`. `Alert.alert`·`useCreateRoom`·`useMyLogsContext`·`useNavigation` 모킹. 토큰만(raw hex 0).
- [ ] **T8. `LogListScreen`** (스펙 먼저 Red) — 인수: loading/error/empty/list 4분기. **빈 상태(ready+[])→"아직 로그가 없어요"+가이드**(에러 아님). 카드=멤버배지(혼자/둘이)+생성일+chevron, 탭→`navigate(LogScreen,{roomId})`. error→"다시 시도"=`refresh()`. `useMyLogsContext`·`useNavigation` 모킹.
- [ ] **T9. `JoinLogScreen`** (스펙 먼저 Red, IN — as-built) — 인수: 코드 입력 정규화(`normalizeInviteCodeInput`), 입장 버튼 활성=`isInviteCodeComplete`, 성공→`joinRoom`+`myLogs.refresh()`+`goBack`, 실패→인라인 `joinError`·입력 보존. `useJoinRoom`·`useMyLogsContext`·`useNavigation` 모킹.
- [ ] **T10. `LogScreen` stub** (스펙 먼저 Red) — 인수: `route.params.roomId` 표시 placeholder. roomId 누락 시 안전 메시지. 토큰만.
- [ ] **T11. `ProfileScreen` 정리** (스펙 갱신) — 인수: "방 나가기" 섹션·`useLeaveRoom`·`useMembershipContext`·`Routes.Onboarding` 참조 제거. 닉네임/아바타 편집 동작·스펙 불변. (leave 관련 스펙 케이스 삭제.)
- [ ] **T12. 정리 삭제** — `OnboardingScreen`(+spec), `MembershipGate`, `MembershipProvider`, `useMembership`(+spec), `MuklogTabScreen` 제거. (의도된 변경 — useMembership.spec/OnboardingScreen.spec 삭제 허용.)
- [ ] **T13. 회귀 가드** — 인수: `npm test` 전체 그린, `tsc --noEmit` 통과. **불변(회귀 0)**: create_room/join_room 매핑(useCreateRoom/useJoinRoom)·`errors.ts`·`code.ts`/`code.spec`·`useJoinRoom`·profile(닉네임/아바타) 동작. **의도된 변경(§3.10)**: modes.ts(정원2)·`leave_room(p_room_id)`·`useLeaveRoom({roomId})`(선반영, UI wiring 없음)·게이트/온보딩/멤버십 삭제·ProfileScreen 나가기 제거 — 각 spec 갱신/삭제 정당. 의도된 변경이 §3.10 판정과 1:1 일치하는지 점검.

> **TDD 권장 순서**: T2(데이터) → T3 → T3b → T3c → T6(게이트) → T7/T8(목록·생성) → T9(입장) → T10 → T11 → T12 정리 → T13. 화면 스펙은 `Alert.alert`/`navigation` 모킹으로 콜백 직접 호출하여 전이 검증(네이티브 다이얼로그·실네비는 스모크).
> ※ as-built 정렬: 위 작업은 이미 구현 완료(24 suites/153 green). 이 목록은 **인수조건↔as-built 1:1 검증 체크리스트**로 사용(재구현 아님).

---

## 6. 엣지케이스

**빈/초기 상태**
- 신규 사용자 진입 → 게이트 없이 HomeTabs → LogList **빈 상태**("아직 로그가 없어요"), 에러 아님. + 버튼으로 탈출 가능.
- `list_my_rooms` 0행 → `ready`+`logs:[]`. (세션 만료로 `auth.uid()` null → 0행 → 빈 상태로 흡수; 인증은 AuthGate가 이미 보장.)

**생성**
- "로그 생성" 다중 호출 → 매번 새 로그(create의 `ALREADY_IN_ROOM` 가드 제거) → 카드 N개.
- 생성 중 빠른 더블탭 → 두 번째도 새 로그 생성될 수 있음(서버는 허용). `creating`(loading) 가드로 1차 차단(중복 로그는 카드로 가시·추후 정리 가능).
- 생성 실패(네트워크/CODE_GENERATION_FAILED) → `Alert`로 메시지, 목록 불변.

**입장(조인) — IN(as-built): JoinLogScreen UI + `join_room` RPC 모두 검증 대상**
- **솔로 로그(멤버1) 조인** → SOLO 가드 제거 → 성공, 멤버2(커플화). (핵심: 거부 제거 검증.)
- **정원 2 초과 조인**(이미 2명) → `ROOM_FULL`.
- **동일 로그 중복 조인**(이미 멤버) → 멱등 성공(PK 존재 검사) → 중복 없음.
- **잘못된 코드** → `INVALID_CODE`.
- **이미 다른 로그 멤버인데 새 로그 조인** → 허용(타방 `ALREADY_IN_ROOM` 제거).
- **동시성**: 마지막 1자리 동시 조인 → `for update` 직렬화 → 한 명 성공·다른 `ROOM_FULL`(고아/3인 방지).

**조회/RLS**
- **내 로그만 보임**: `list_my_rooms`가 `where user_id=auth.uid()` → 타인 로그 비노출(DEFINER 스코프 필수). 멤버 수는 정확 집계(파트너 행 포함).
- 멤버 배지 파생: memberCount 2→"둘이", 1→"혼자". (`mode` 컬럼이 아니라 수에서 파생 — 솔로 로그가 조인으로 커플화돼도 배지 자동 갱신.)
- 목록 조회 실패(네트워크) → `error` 상태 + "다시 시도"(refresh).

**네비/전이**
- 카드 탭 → LogScreen에 `roomId` 전달. 파라미터 누락(직접 진입 등) → 안전 메시지.
- JoinLog 성공 후 goBack → LogList refresh 반영. 실패 후 뒤로가기 → 목록 불변.
- ProfileScreen에 나가기 없음(이번) → 로그를 빠져나가려면 차기 LogScreen 로그별 나가기. 막힘 아님(다른 로그 사용·목록 이동 가능).

**회귀/잔존**
- `leave_room`은 `p_room_id` 인자화로 **多로그 호환 선반영**(단일행 가정 충돌 제거). `useLeaveRoom({roomId})` 계약 정합. ⚠️ **이번 UI 호출부 없음**(차기 LogScreen) → wiring 금지.
- `useJoinRoom`/`code.ts`는 보존(미호출) — log-invite가 사용.
- `errors.ts`의 `SOLO_ROOM_NOT_JOINABLE`/`ALREADY_IN_ROOM`은 dormant(매핑만 잔존, 무해).
- `modes.ts` `ROOM_CAPACITY`는 `{solo:2,couple:2}`로 동기화(서버 정원2 일치, C6). modes.spec 동반 갱신.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| **C1** | `list_my_rooms` 반환 컬럼(`room_id`,`mode`,`member_count`,`created_at`,`joined_at` snake) | `useMyLogs` 매핑(camel `MyLog`) | 컬럼명·타입 일치, 누락 없이 매핑, 0행→`ready+[]` |
| **C2** | `list_my_rooms` member_count(DEFINER 전 멤버 집계) | LogCard 배지(2=둘이/1=혼자) | 멤버 수 파생 정확(파트너 행 포함, RLS 우회 집계) |
| **C3** | `create_room` `ALREADY_IN_ROOM` 가드 제거 | "다중 로그 생성" 인수 | 같은 사용자 N회 생성 → N개 로그 |
| **C4** | `join_room` `SOLO_ROOM_NOT_JOINABLE` 제거 (RPC + JoinLogScreen UI) | "솔로 로그 조인" 인수 | 멤버1 로그 조인 성공→멤버2. UI: 코드 입력→입장→목록 추가 |
| **C5** | `join_room` 타방 `ALREADY_IN_ROOM` 제거 + 같은 로그 PK 멱등 | 다중 멤버십/중복 조인 | 다른 로그 조인 허용 / 같은 로그 재조인 멱등(중복 없음) |
| **C6** | `enforce_room_capacity`=2 + `join_room` count/for update + `modes.ts ROOM_CAPACITY={solo:2,couple:2}` | 정원초과·동시조인·상수 동기화 | 3번째 조인 `ROOM_FULL`, 동시조인 직렬화, **생산자(트리거) ↔ 상수 정원2 일치**(QA #2) |
| **C7** | `AuthGate` authenticated→NavigationContainer/HomeTabs(게이트 없음) | 진입 인수 | 온보딩/멤버십 분기 없이 HomeTabs |
| **C8** | `routes.ts`(HomeTabs/LogList/LogScreen{roomId}/JoinLog, Onboarding/RoomTabs/MuklogTab 제거) | AppNavigator/HomeTabs/PlusHeaderButton/카드·입장 nav 타입 | tsc 그린, dangling Onboarding/RoomTabs/MuklogTab 참조 0 |
| **C9** | `useMyLogs` `ready`+`logs:[]` | LogListScreen 빈 상태 | 빈 목록=빈 상태 UI(에러 아님) |
| **C10** | 카드 `navigate(LogScreen,{roomId})` | LogScreen `route.params.roomId` | 파라미터 키·전달 일치, 누락 방어 |
| **C11** | create/join 성공→`myLogs.refresh()` | LogList 표시 | 생성·입장 후 목록 즉시 갱신(폴링 없음) |
| **C-JOIN** | `PlusHeaderButton` 액션시트 "로그 입장"→`navigate(JoinLog)` / `JoinLogScreen` `joinRoom`→refresh→goBack | join UI 흐름 | 코드 정규화·입장 활성조건·성공 전이·실패 인라인 |
| **C12** | ProfileScreen에서 `Onboarding` reset·`useMembershipContext`·`useLeaveRoom` 제거 | Onboarding 라우트 부재 | 런타임 크래시 0, 닉네임/아바타 회귀 0 |
| **C-LEAVE** | `leave_room(p_room_id)` 시그니처(`drop` 무인자) + `useLeaveRoom({roomId})` → `rpc('leave_room',{p_room_id})` (선반영) | 호출부 부재 | 무인자 오버로드 잔존 0, `useLeaveRoom.spec` `{p_room_id:'r1'}` 단언, for update·본인행 스코프·count후삭제 유지. ⚠️ 이번 UI **wiring 0** 확인(화면 연결 없음) |
| **C13** | 신규/교체(additive+삭제+의도된 변경) | §3.10 판정표 ↔ 기존 spec | 의도된 변경/회귀 1:1 매핑, `npm test` 그린, errors.ts·code.ts·useJoinRoom 불변(leave_room/modes는 의도된 변경) |

---

## 8. 비용 가드레일 체크

- **AWS 미사용.** Supabase 무료 티어(Postgres + 익명 Auth)만. Storage/Edge/Kakao **이번 범위 없음**.
- **조회 최소화**: `list_my_rooms` = **1 RPC(왕복 1회)**로 내 로그+멤버수 동시 반환(N+1 회피). 마운트 1회 + 생성/입장 성공 후 `refresh` 1회. **폴링·focus 주기조회 없음**(useMembership 정책 계승).
- **Realtime 미사용**(다중 로그 동시 구독 비용은 §7 추후 검토). 이번엔 명시적 refresh만.
- **이미지/Kakao 디바운스/viewport** → 이번 기능 **해당 없음**(LogScreen·지도 stub).
- 멤버 수는 서버 집계로 클라 추가 왕복 0.

---

## 부록-architecture-diff. architecture.md 갱신 (구현 시 반영 권고)
- **§5 백로그 표**: `multi-log-home` 행 상태 "진행(다음)"→"진행/완료"로 갱신(스프린트 종료 시). ★(2) 결정 반영: "로그별 나가기는 LogScreen으로 이전(차기), Profile 나가기 버튼 제거".
- **§7 미정 사항**: "로그 식별/이름=이번엔 미도입(자동/생략), 배지+생성일 표시로 결정" 부기. "나가기 진입점: Profile 제거 → LogScreen 로그별(차기 슬라이스)" 확정 부기. `room_modes`의 정원·솔로조인 마이그레이션을 `multi_log_home`에서 처리 완료 표기.

## 부록. developer 핸드오프 메모
- **마이그레이션 신규 파일**(`20260610150000_multi_log_home.sql`, 기존 미수정·idempotent): enforce_room_capacity(2 통일)/create_room(가드 제거)/join_room(솔로·타방 가드 제거, 같은 로그 PK 멱등 유지 — log-invite용 선반영)/`list_my_rooms()`(DEFINER, `where user_id=auth.uid()`, member_count 집계)/`leave_room(p_room_id)`(무인자 drop 후 인자화 — 차기 LogScreen용 선반영). 실 Supabase 적용·스모크는 사용자.
- **함정 1**: `list_my_rooms`는 DEFINER → **`where rm.user_id = auth.uid()` 필수**(누락 시 전체 로그 노출, C-RLS).
- **함정 2**: create_room/join_room의 `ALREADY_IN_ROOM` 제거 시 **다른 로직(코드생성·for update·트리거)은 보존**. join은 "같은 로그 멤버십 PK 존재 검사"로 멱등 유지(타방 가드만 제거).
- **함정 3**: 멤버 배지는 **`memberCount`에서 파생**(1=혼자/2=둘이). `mode` 컬럼으로 판단 금지(솔로→커플화 시 mode는 그대로 'couple'이거나 stale).
- **함정 4(네비 리네임)**: `RoomTabs`→`HomeTabs`, `MuklogTab`→`LogList` 리네임 + `Onboarding`/`RoomTabs` 라우트 제거(`JoinLog` 미추가) → 모든 소비처(AppNavigator/HomeTabs/ProfileHeaderButton/ProfileScreen) 동반 수정, tsc로 dangling 참조 0 확인.
- **함정 5(leave 인자화·wiring 금지·⚠️ 중요)**: ProfileScreen이 `Routes.Onboarding`으로 reset → 라우트 삭제 시 크래시 → **나가기 섹션 통째 제거**(★(2)). `leave_room`은 **`p_room_id` 인자화**(무인자 `drop` 후 재생성 — 오버로드 함정 회피), `useLeaveRoom({roomId})` + spec 갱신(백엔드 선반영). ⚠️ **단 이번 슬라이스에 UI 호출부는 만들지 말 것**(화면 wiring 금지) — 차기 LogScreen 나가기가 사용.
- **함정 6(join UI IN — as-built)**: 로그 입장은 이번 슬라이스 포함. `+버튼` 액션시트(생성/입장), `JoinLogScreen`(코드 정규화·`joinRoom`→refresh→goBack), `join_room` RPC 변경 모두 검증 대상. `useJoinRoom`·`code.ts` 사용됨.
- **modes.ts**: `ROOM_CAPACITY`를 `{solo:2,couple:2}`로 동기화(트리거 정원2 일치, C6) + modes.spec 갱신.
- **상태/컨텍스트**: `MembershipProvider`→`MyLogsProvider`로 교체. `useMyLogsContext().refresh`를 +버튼 생성 성공 후 호출.
- **TDD**: `useMyLogs.spec`(매핑·빈/에러/refresh) → `AuthGate.spec`(authenticated→HomeTabs) → `LogListScreen.spec`(빈/리스트/카드탭) → `PlusHeaderButton.spec`(생성→refresh/실패→Alert) → `LogScreen.spec` → `ProfileScreen.spec` 갱신. `Alert.alert`·`navigation` 모킹으로 콜백 직접 호출.
- **컨벤션**: useCallback/useMemo 지양, 화살표 함수, named-object 인자, useEffect 명명 함수, enum-style 상수, 원티드 토큰(raw hex 0).
- git 작업 금지(사용자 전담). 실 Supabase 적용도 사용자.
