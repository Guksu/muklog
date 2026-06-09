-- 20260609120000_invite_room.sql
-- invite-room 스프린트: 익명 인증 + 초대코드 방 생성/입장.
-- 산출: profiles / rooms / room_members 테이블 + RLS + 인원2 트리거 + create_room/join_room RPC.
-- 설계 출처: docs/design/architecture.md §3, docs/sprint/sprint-20260609-invite-room/plan.md §3.
--
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존(supabase db push 또는 SQL 에디터 실행).
--    이 파일은 재실행 가능(idempotent)하도록 작성(create ... if not exists / drop policy if exists / create or replace).
-- ⚠️ create_room/join_room 은 SECURITY DEFINER → RLS 우회. 코드로 방 찾기/멤버 삽입을 안전하게 서버에서 수행.

-- gen_random_uuid() 보장 (Supabase 기본 포함이나 명시)
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. 테이블 (architecture §3.1 / plan §3.1)
-- =====================================================================

-- profiles : auth.users 1:1. 닉네임/아바타는 NULL로 시작(편집은 profile 스프린트).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- rooms : 초대코드 보유 방. invite_code 는 서버 생성(6자리, charset 3.4).
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- room_members : 방당 최대 2명. PK(room_id,user_id)로 동일인 중복가입 차단.
create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- =====================================================================
-- 2. RLS (plan §3.2)
--    profiles : own-only(파트너 표시는 범위 외)
--    rooms    : 본인 멤버 방만 select. insert/update/delete 정책 없음 → RPC(DEFINER)만.
--    room_members : 자기 행만 select(self-join 재귀 회피). insert/delete 정책 없음 → RPC(DEFINER)만.
-- =====================================================================

alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- rooms : select = 본인 멤버 방만. (코드로 찾기는 join_room RPC가 RLS 우회로 처리)
drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member" on public.rooms
  for select using (
    id in (select room_id from public.room_members where user_id = auth.uid())
  );
-- rooms insert/update/delete : 정책 없음 → 직접 쓰기 거부(RPC만 허용)

-- room_members : select = 자기 행만(user_id=auth.uid()). ⚠️ "같은 방 모든 멤버"로 짜면 RLS 자기참조 무한재귀.
drop policy if exists "room_members_select_own" on public.room_members;
create policy "room_members_select_own" on public.room_members
  for select using (user_id = auth.uid());
-- room_members insert/delete : 정책 없음 → 직접 쓰기 거부(RPC만 허용)

-- =====================================================================
-- 3. 인원 2명 제한 트리거 (plan §3.3) — DB 최종 방어(앱 1차차단 + RPC for update 직렬화와 이중강제)
-- =====================================================================

create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.room_members where room_id = new.room_id) >= 2 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_room_capacity on public.room_members;
create trigger trg_room_capacity
  before insert on public.room_members
  for each row execute function public.enforce_room_capacity();

-- =====================================================================
-- 4. create_room() RPC (plan §3.5)
--    반환: { "room_id": <uuid>, "invite_code": <6자리> }
--    에러토큰: NOT_AUTHENTICATED / ALREADY_IN_ROOM / CODE_GENERATION_FAILED
-- =====================================================================

create or replace function public.create_room()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- charset: A-Z 중 O,I 제외(24) + 0-9 중 0,1 제외(8) = 32자. ⚠️ 클라 normalizeInviteCodeInput 과 동일해야 함(C6).
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

  -- 안전망: profiles 보장(AuthProvider 선행 upsert가 1차, 이건 FK 무결성 2차 방어).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 1인 1방 불변식: 이미 어떤 방의 멤버면 차단.
  if exists (select 1 from public.room_members where user_id = v_uid) then
    raise exception 'ALREADY_IN_ROOM';
  end if;

  -- 코드 생성 + 삽입 루프. invite_code UNIQUE 충돌 시 재생성(최대 8회).
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_charset, floor(random() * length(v_charset))::int + 1, 1);
    end loop;
    begin
      insert into public.rooms (invite_code, created_by)
        values (v_code, v_uid)
        returning id into v_room_id;
      exit;  -- 삽입 성공
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'CODE_GENERATION_FAILED';
      end if;
      -- 재시도
    end;
  end loop;

  -- 본인 멤버십 추가(트리거가 0→1이므로 통과).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id, 'invite_code', v_code);
end;
$$;

-- =====================================================================
-- 5. join_room(p_code text) RPC (plan §3.5)
--    반환: { "room_id": <uuid> }
--    에러토큰: NOT_AUTHENTICATED / INVALID_CODE / ALREADY_IN_ROOM / ROOM_FULL
--    자기 방 재입장은 토큰 없이 멱등 성공.
-- =====================================================================

create or replace function public.join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_code         text;
  v_room_id      uuid;
  v_existing     uuid;
  v_count        int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 안전망: profiles 보장(C4 FK).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 정규화(서버에서도 한 번 더): 대문자 + 공백 trim.
  v_code := upper(trim(p_code));

  -- 코드로 방 조회(DEFINER → RLS 우회).
  select id into v_room_id from public.rooms where invite_code = v_code;
  if v_room_id is null then
    raise exception 'INVALID_CODE';
  end if;

  -- 기존 멤버십 판정.
  select room_id into v_existing from public.room_members where user_id = v_uid;
  if v_existing is not null then
    if v_existing = v_room_id then
      -- 자기 방 재입장 → 멱등 성공.
      return jsonb_build_object('room_id', v_room_id);
    else
      raise exception 'ALREADY_IN_ROOM';
    end if;
  end if;

  -- 동시성 직렬화: 방 행 잠금(마지막 1자리 동시 입장 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 앱/RPC 1차 차단.
  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 2 then
    raise exception 'ROOM_FULL';
  end if;

  -- 삽입(트리거가 최종 방어; 동시 케이스에서 ROOM_FULL raise 가능).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id);
end;
$$;

-- =====================================================================
-- 6. RPC 권한 (plan §3.5 / §3.6 T6, C9)
--    익명 사용자도 Supabase에서 authenticated 역할 → authenticated 에 execute 부여.
--    JWT 없는 anon/public 에는 미부여(불필요 권한 차단).
-- =====================================================================

revoke all on function public.create_room()           from public, anon;
revoke all on function public.join_room(text)          from public, anon;
grant execute on function public.create_room()         to authenticated;
grant execute on function public.join_room(text)       to authenticated;
