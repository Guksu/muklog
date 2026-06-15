-- 20260615120000_log_name.sql
-- log-name 스프린트: 로그(방)에 사용자 지정 이름(최대 20자) 부여·수정.
-- 산출: ① rooms.name 컬럼(nullable) ② rename_room(p_room_id, p_name) RPC(DEFINER + 멤버검증, name만 갱신)
--       ③ list_my_rooms() returns table에 name 투영 추가(drop+recreate) ④ get_room() jsonb에 name 키 추가(replace).
-- 설계 출처: docs/sprint/sprint-20260615-log-name/plan.md §3, docs/design/architecture.md §3·§7.
--
-- ⚠️ 기존 마이그레이션(invite_room/room_modes/room_leave/multi_log_home/log_invite)은 수정하지 않는다.
--    이 파일은 additive(컬럼 1개 추가 + 함수 본문 교체·신규). 재실행 가능(idempotent):
--      add column if not exists / create or replace / drop function if exists 후 재생성 / 권한 재선언.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
--
-- ┌───────────────────────── 보안 핵심 (C4-RLS) ─────────────────────────┐
-- │ rename_room 은 SECURITY DEFINER → RLS 를 우회한다. 본문에서 호출자(auth.uid())가     │
-- │ p_room_id 의 멤버인지 명시 검사하지 않으면 누구나 임의 로그의 이름을 바꿀 수 있다.        │
-- │ 따라서 멤버십 검사 → 없으면 NOT_A_MEMBER raise 가 필수(get_room §보안핵심과 동일).      │
-- │ rooms 에는 update RLS 정책이 없다(직접 쓰기 거부) → 모든 쓰기는 이 DEFINER RPC 만.       │
-- │ created_by 검사는 하지 않는다 — 커플 공용 라벨이므로 멤버 누구나 수정 가능(plan §결정1).  │
-- └──────────────────────────────────────────────────────────────────────┘

-- =====================================================================
-- 1. rooms.name 컬럼 추가 (plan §3.1)
--    nullable text. NULL = 이름 미지정(클라가 폴백 표기). 기존 모든 행은 NULL로 시작 → 깨짐 없이 폴백.
--    RLS 변경 없음 — rooms_select_member(select)만 존재, update 정책 신설 안 함(쓰기는 RPC-only).
-- =====================================================================
alter table public.rooms add column if not exists name text;

-- =====================================================================
-- 2. rename_room(p_room_id uuid, p_name text) — 로그 이름 수정 RPC (신설, SECURITY DEFINER, plan §3.2)
--    반환(성공): jsonb { "room_id": uuid, "name": text | null } — 서버 정규화 최종값(빈/공백→null)이 단일 출처.
--    에러 토큰: NOT_AUTHENTICATED / ROOM_NOT_FOUND / NOT_A_MEMBER / NAME_TOO_LONG.
--    정규화: nullif(btrim(coalesce(p_name,''))) → 공백 trim 후 빈 문자열이면 NULL(폴백 복귀). 클라 normalizeLogName 과 동일 규칙.
--    길이: char_length(정규화값) > 20 → NAME_TOO_LONG(앱 maxLength 1차 + 이 char_length 2차 방어).
-- =====================================================================
create or replace function public.rename_room(p_room_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_exists boolean;
  v_name   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 로그 존재 확인(DEFINER → RLS 우회). 없으면 ROOM_NOT_FOUND.
  select exists(select 1 from public.rooms where id = p_room_id) into v_exists;
  if not v_exists then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- ⚠️ 보안 핵심(C4-RLS): 호출자가 이 로그의 멤버인지 명시 검사. 비멤버 → 거부.
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 정규화: trim 후 빈 문자열이면 NULL(폴백 복귀). 클라 normalizeLogName 과 동일(이중 정규화).
  v_name := nullif(btrim(coalesce(p_name, '')), '');

  -- 길이 2차 방어(trim 후 기준). 앱 maxLength=20 이 1차.
  if v_name is not null and char_length(v_name) > 20 then
    raise exception 'NAME_TOO_LONG';
  end if;

  -- name 컬럼만 갱신(다른 컬럼 불변 — RPC가 name-only 갱신을 강제).
  update public.rooms set name = v_name where id = p_room_id;

  return jsonb_build_object('room_id', p_room_id, 'name', v_name);
end;
$$;

-- 권한: 익명도 Supabase에서 authenticated 역할 → authenticated 에 execute. anon/public 차단.
revoke all on function public.rename_room(uuid, text) from public, anon;
grant execute on function public.rename_room(uuid, text) to authenticated;

-- =====================================================================
-- 3. list_my_rooms() — returns table 에 name 투영 추가 (drop + recreate, plan §3.3)
--    ⚠️ returns table 시그니처(컬럼 구성) 변경 → create or replace 만으로는 반환 타입 변경 불가
--       → drop function if exists 후 재생성(안전). 무인자 시그니처라 오버로드 충돌 없음.
--    신 반환 형: room_id, mode, member_count, created_at, joined_at, name. (기존 5컬럼 + name)
--    기존 소비자(useMyLogs)는 추가 컬럼 name 을 매핑에 반영(null 안전). 정렬·집계 로직 불변.
-- =====================================================================
drop function if exists public.list_my_rooms();

create or replace function public.list_my_rooms()
returns table (
  room_id      uuid,
  mode         text,
  member_count int,
  created_at   timestamptz,
  joined_at    timestamptz,
  name         text
)
language sql
security definer
set search_path = public
as $$
  select r.id,
         r.mode,
         (select count(*)::int from public.room_members m2 where m2.room_id = r.id) as member_count,
         r.created_at,
         rm.joined_at,
         r.name
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;

-- 권한 재선언(idempotent, 무인자 시그니처).
revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;

-- =====================================================================
-- 4. get_room(p_room_id uuid) — jsonb 에 name 키 추가 (create or replace, plan §3.3)
--    jsonb 반환이라 시그니처 불변 → 본문만 교체. 키 추가는 기존 소비자(useRoom)에 비파괴.
--    신 반환: { room_id, invite_code, member_count, mode, name } (name = r.name, nullable).
--    보안(멤버십 검사·ROOM_NOT_FOUND)·member_count 집계 로직은 log_invite 버전과 동일(불변).
-- =====================================================================
create or replace function public.get_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_invite_code  text;
  v_mode         text;
  v_name         text;
  v_member_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 로그 존재 확인(DEFINER → RLS 우회). 없으면 ROOM_NOT_FOUND.
  select r.invite_code, r.mode, r.name
    into v_invite_code, v_mode, v_name
    from public.rooms r
   where r.id = p_room_id;

  if v_invite_code is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- ⚠️ 보안 핵심(C4-RLS): 호출자가 이 로그의 멤버인지 명시 검사.
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 정확한 멤버 수(DEFINER 전 멤버 집계 — 솔로/커플 파생). 클라 직접 select는 self-only RLS로 불가.
  select count(*)::int into v_member_count
    from public.room_members m
   where m.room_id = p_room_id;

  return jsonb_build_object(
    'room_id', p_room_id,
    'invite_code', v_invite_code,
    'member_count', v_member_count,
    'mode', v_mode,
    'name', v_name
  );
end;
$$;

-- 권한: 익명도 authenticated 역할 → authenticated 에 execute. anon/public 차단.
revoke all on function public.get_room(uuid) from public, anon;
grant execute on function public.get_room(uuid) to authenticated;
