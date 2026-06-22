-- 20260622120000_push_send.sql
-- push-send 스프린트(S2 — 발송 + 서버 prefs 게이팅): 알림 설정을 서버로 옮기고, 발송 시
--   "다른 멤버 중 알림을 켠 사람"의 Expo 토큰만 골라내는 SECURITY DEFINER RPC를 신설한다.
-- 산출:
--   ① public.notification_prefs        — 사용자별 마스터 스위치(행 부재 = on). RLS 본인만.
--   ② public.notification_pref_rooms    — (user,room) 명시적 override(부재 = on). RLS 본인만.
--   ③ public.list_room_push_targets(p_room_id, p_actor) SECURITY DEFINER
--        — p_actor 멤버 아니면 빈 결과 / 다른 멤버 토큰만 / 수신자 master AND room override 둘 다 on 인 토큰만.
-- 설계 출처: docs/sprint/sprint-20260622-push-send/plan.md §1·AC1·AC6, docs/design/architecture.md §3·§7.
--
-- ⚠️ 기존 마이그레이션(invite_room/.../device_tokens)은 수정하지 않는다. 이 파일은 additive(신규 테이블/정책/함수만).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행(developer 는 배포 금지).
-- ⚠️ 재실행 가능(idempotent): create table if not exists / drop policy if exists / create or replace.
--
-- ┌───────────────────────── 보안 핵심 (RLS + DEFINER) ───────────────────────────┐
-- │ ① prefs 두 테이블: RLS 모든 정책 user_id = auth.uid() → 본인 설정만 R/W. 타인 설정 노출/조작 차단.   │
-- │ ② list_room_push_targets 는 SECURITY DEFINER → RLS 우회(다른 멤버 토큰·prefs 조회 필요).            │
-- │    안티스팸 게이트: p_actor 가 p_room_id 멤버가 아니면 **빈 결과** 반환(타인 룸에 발송 트리거 불가).      │
-- │    토큰은 service_role(Edge Function)에서만 호출 → 클라이언트에 절대 노출 안 함.                       │
-- │    GRANT execute to authenticated 안 함(함수는 service_role 로만 호출). DEFINER 소유자 권한으로 조회.   │
-- └────────────────────────────────────────────────────────────────────────────────┘

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. notification_prefs — 사용자별 마스터 스위치 (plan §1)
--    user_id pk → profiles ON DELETE CASCADE(계정 삭제 시 설정 동반 정리).
--    master_enabled default true: 행 부재 = on(기본). 토글 시 upsert 로 1행 유지.
-- =====================================================================
create table if not exists public.notification_prefs (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  master_enabled boolean not null default true,
  updated_at     timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_select_own" on public.notification_prefs;
create policy "notification_prefs_select_own" on public.notification_prefs
  for select using (user_id = auth.uid());

drop policy if exists "notification_prefs_insert_own" on public.notification_prefs;
create policy "notification_prefs_insert_own" on public.notification_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists "notification_prefs_update_own" on public.notification_prefs;
create policy "notification_prefs_update_own" on public.notification_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- 2. notification_pref_rooms — (user,room) 명시적 override (plan §1)
--    부재 = on(기본). 행이 있으면 enabled 값 그대로(off = mute). pk(user_id, room_id).
--    user_id → profiles cascade, room_id → rooms cascade(계정/룸 삭제 시 동반 정리).
-- =====================================================================
create table if not exists public.notification_pref_rooms (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.notification_pref_rooms enable row level security;

drop policy if exists "notification_pref_rooms_select_own" on public.notification_pref_rooms;
create policy "notification_pref_rooms_select_own" on public.notification_pref_rooms
  for select using (user_id = auth.uid());

drop policy if exists "notification_pref_rooms_insert_own" on public.notification_pref_rooms;
create policy "notification_pref_rooms_insert_own" on public.notification_pref_rooms
  for insert with check (user_id = auth.uid());

drop policy if exists "notification_pref_rooms_update_own" on public.notification_pref_rooms;
create policy "notification_pref_rooms_update_own" on public.notification_pref_rooms
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- 3. updated_at 자동 갱신 트리거 — upsert(onConflict)의 update 경로에서 갱신 시각 기록.
-- =====================================================================
create or replace function public.touch_notification_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_notification_prefs_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_updated_at
  before update on public.notification_prefs
  for each row execute function public.touch_notification_prefs_updated_at();

drop trigger if exists trg_notification_pref_rooms_updated_at on public.notification_pref_rooms;
create trigger trg_notification_pref_rooms_updated_at
  before update on public.notification_pref_rooms
  for each row execute function public.touch_notification_prefs_updated_at();

-- =====================================================================
-- 4. list_room_push_targets(p_room_id, p_actor) — 발송 수신 토큰 조회 (plan §1, AC1·AC6)
--    SECURITY DEFINER(RLS 우회) — service_role(Edge Function)에서만 호출.
--    게이팅 로직:
--      · p_actor 가 p_room_id 멤버가 아니면 → 빈 결과(안티스팸 게이트).
--      · p_room_id 의 다른 멤버(user_id <> p_actor)의 device_tokens 만.
--      · 수신자 게이팅: notification_prefs.master_enabled(행 부재 = true)
--                       AND notification_pref_rooms.enabled(부재 = true, 있으면 그 값) 둘 다 true.
--    반환: expo_push_token, platform(메시지 빌드용). 토큰은 service_role 경계 안에서만 사용.
--    coalesce(LEFT JOIN, true): prefs 행 부재를 기본 on 으로 해석(클라 resolveLogEnabled 와 동일 의미).
-- =====================================================================
create or replace function public.list_room_push_targets(p_room_id uuid, p_actor uuid)
returns table (expo_push_token text, platform text)
language sql
security definer
set search_path = public
as $$
  select dt.expo_push_token, dt.platform
  from public.room_members rm
  join public.device_tokens dt on dt.user_id = rm.user_id
  left join public.notification_prefs np on np.user_id = rm.user_id
  left join public.notification_pref_rooms npr
    on npr.user_id = rm.user_id and npr.room_id = p_room_id
  where rm.room_id = p_room_id
    and rm.user_id <> p_actor
    -- 안티스팸 게이트: p_actor 가 이 룸의 멤버일 때만 결과를 낸다(아니면 EXISTS 가 false → 빈 결과).
    and exists (
      select 1 from public.room_members me
      where me.room_id = p_room_id and me.user_id = p_actor
    )
    and coalesce(np.master_enabled, true) = true   -- 수신자 마스터 on(행 부재 = on)
    and coalesce(npr.enabled, true) = true;         -- 해당 룸 override on(행 부재 = on)
$$;

-- ⚠️ GRANT execute 안 함 — 함수는 service_role(Edge Function)에서만 호출. authenticated 직접 호출 불가
--    (토큰은 클라이언트에 절대 노출하지 않는다). service_role 은 RLS·GRANT 무관하게 실행 가능.

-- =====================================================================
-- 5. 권한 — prefs 두 테이블은 RLS 하 클라 직접 R/W(upsert). 행 제한은 RLS 가 담당.
-- =====================================================================
grant select, insert, update on public.notification_prefs to authenticated;
grant select, insert, update on public.notification_pref_rooms to authenticated;
