-- 20260610130000_room_modes.sql
-- room-modes 스프린트: 생성 시 솔로/커플 모드 선택 + 모드별 정원.
-- 산출: rooms.mode 컬럼(+backfill) / 삭제 라이프사이클 컬럼 선반영 /
--       정원 트리거 모드별 일반화 / create_room(p_mode) / join_room 솔로 가드.
-- 설계 출처: docs/sprint/sprint-20260610-room-modes/plan.md §3, docs/design/architecture.md §1·§3.
--
-- ⚠️ 기존 invite_room(20260609120000) 마이그레이션은 수정하지 않는다 — 이미 적용된 환경 고려, ALTER로 증분.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): add column if not exists / create or replace / drop function if exists.
--
-- 적용 순서(부록):
--   1) drop function create_room()  → 무인자 오버로드 제거(함정1, 안 하면 두 오버로드 공존)
--   2) alter rooms add (mode/backfill + 삭제 라이프사이클 컬럼)
--   3) create or replace enforce_room_capacity (모드별 정원)
--   4) create create_room(text)  + 권한 재grant
--   5) create or replace join_room (솔로 입장 거부 가드)

-- =====================================================================
-- 0. 무인자 create_room() 제거 (함정1 — 반드시 신규 시그니처 생성 전에)
--    create or replace 는 시그니처가 다르면 "새 오버로드 추가"라 무인자 버전이 잔존 →
--    rpc('create_room') 호출이 모호해진다. 먼저 drop 한다.
-- =====================================================================
drop function if exists public.create_room();

-- =====================================================================
-- 1. rooms 컬럼 추가 + backfill (plan §3.1)
-- =====================================================================

-- mode: 생성 시 확정. solo=정원1 / couple=정원2.
-- add column ... default 'couple' 가 기존 행을 'couple'로 backfill(전부 커플방이었음) → 회귀-안전.
alter table public.rooms
  add column if not exists mode text not null default 'couple'
    check (mode in ('solo', 'couple'));

-- 삭제 라이프사이클 — 선반영(스키마만, 동작은 room-lifecycle 스프린트). NULL=예약 없음.
alter table public.rooms
  add column if not exists delete_scheduled_at timestamptz;
alter table public.rooms
  add column if not exists delete_requested_by uuid references public.profiles(id);

-- =====================================================================
-- 2. 정원 트리거 모드별 일반화 (plan §3.2)
--    트리거 자체(before insert on room_members)는 invite_room.sql 것 재사용 — 본문만 교체.
--    solo=1 / couple=2. couple 정원 2 유지 → 기존 동시성/3번째 입장 의미 보존(회귀).
-- =====================================================================
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity int;
  v_count    int;
begin
  -- 모드별 정원: solo=1, couple=2
  select case when mode = 'solo' then 1 else 2 end
    into v_capacity
    from public.rooms where id = new.room_id;

  if v_capacity is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from public.room_members where room_id = new.room_id;

  if v_count >= v_capacity then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- =====================================================================
-- 3. create_room(p_mode text default 'couple') RPC (plan §3.3)
--    반환: { "room_id": <uuid>, "invite_code": <6자리>, "mode": <solo|couple> }
--    에러토큰: NOT_AUTHENTICATED / INVALID_MODE / ALREADY_IN_ROOM / CODE_GENERATION_FAILED
--    회귀: 인자 없이 호출 시 default 'couple' → 기존과 동일 + mode 추가 반환(additive).
-- =====================================================================
create or replace function public.create_room(p_mode text default 'couple')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- charset: A-Z 중 O,I 제외(24) + 0-9 중 0,1 제외(8) = 32자. ⚠️ 클라 INVITE_CODE_CHARSET 과 동일(C6).
  v_charset constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid     uuid := auth.uid();
  v_code    text;
  v_room_id uuid;
  v_attempt int := 0;
  i         int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 모드 검증: solo|couple 외 값(null/오타) 차단.
  if p_mode is null or p_mode not in ('solo', 'couple') then
    raise exception 'INVALID_MODE';
  end if;

  -- 안전망: profiles 보장(AuthProvider 선행 upsert가 1차, 이건 FK 무결성 2차 방어).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 1인 1방 불변식: 이미 어떤 방의 멤버면 차단.
  if exists (select 1 from public.room_members where user_id = v_uid) then
    raise exception 'ALREADY_IN_ROOM';
  end if;

  -- 코드 생성 + 삽입 루프(솔로/커플 공통 발급). invite_code UNIQUE 충돌 시 재생성(최대 8회).
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_charset, floor(random() * length(v_charset))::int + 1, 1);
    end loop;
    begin
      insert into public.rooms (invite_code, created_by, mode)
        values (v_code, v_uid, p_mode)
        returning id into v_room_id;
      exit;  -- 삽입 성공
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'CODE_GENERATION_FAILED';
      end if;
      -- 재시도
    end;
  end loop;

  -- 본인 멤버십 추가(트리거가 0→1이므로 solo·couple 공통 통과).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id, 'invite_code', v_code, 'mode', p_mode);
end;
$$;

-- 권한 재선언(무인자 drop 후이므로 신규 시그니처로 필수).
revoke all on function public.create_room(text)  from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- =====================================================================
-- 4. join_room(p_code text) — 솔로방 입장 거부 가드 추가 (plan §3.4)
--    반환·기존 토큰은 invite_room §3.5 그대로 + SOLO_ROOM_NOT_JOINABLE.
--    ⚠️ 순서 중요: 멤버십 분기(자기방 멱등성공/다른방 ALREADY_IN_ROOM)를 먼저 처리한 뒤
--       솔로 가드를 둔다 → 솔로 생성자 자기코드 재입력은 멱등 성공으로 빠져 가드에 안 걸림(C5b).
-- =====================================================================
create or replace function public.join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_code     text;
  v_room_id  uuid;
  v_mode     text;
  v_existing uuid;
  v_count    int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 안전망: profiles 보장(C4 FK).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 정규화(서버에서도 한 번 더): 대문자 + 공백 trim.
  v_code := upper(trim(p_code));

  -- 코드로 방 조회(DEFINER → RLS 우회). mode 도 함께 읽어 솔로 가드에 사용.
  select id, mode into v_room_id, v_mode from public.rooms where invite_code = v_code;
  if v_room_id is null then
    raise exception 'INVALID_CODE';
  end if;

  -- 기존 멤버십 분기 먼저(솔로 가드보다 우선 — 자기 방 재입장 멱등성 보존, C5b).
  select room_id into v_existing from public.room_members where user_id = v_uid;
  if v_existing is not null then
    if v_existing = v_room_id then
      -- 자기 방 재입장 → 멱등 성공(솔로 생성자가 자기 코드 재입력해도 여기서 성공).
      return jsonb_build_object('room_id', v_room_id);
    else
      raise exception 'ALREADY_IN_ROOM';
    end if;
  end if;

  -- 솔로방 가드: "이 방 멤버 아님"이 확정된 뒤(타인) → 입장 거부.
  if v_mode = 'solo' then
    raise exception 'SOLO_ROOM_NOT_JOINABLE';
  end if;

  -- 동시성 직렬화: 방 행 잠금(마지막 1자리 동시 입장 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 앱/RPC 1차 차단(모드별 정원은 트리거가 최종 방어; 솔로는 위 가드에서 이미 차단됨).
  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 2 then
    raise exception 'ROOM_FULL';
  end if;

  -- 삽입(트리거가 최종 방어; 동시 케이스에서 ROOM_FULL raise 가능).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id);
end;
$$;

-- join_room(text) 권한은 invite_room.sql 에서 부여됨(본문만 교체). 재선언해도 무해.
revoke all on function public.join_room(text)  from public, anon;
grant execute on function public.join_room(text) to authenticated;
