-- 20260617120000_device_tokens.sql
-- push-notifications 스프린트 슬라이스 S1(디바이스 토큰 등록): Expo push token 저장 테이블 신설.
-- 산출: public.device_tokens 테이블 + RLS 4종(본인 토큰만 select/insert/update/delete)
--       + 인덱스(user_id) + updated_at 자동 갱신 트리거 + grant.
-- 설계 출처: docs/sprint/sprint-20260617-push-notifications/plan.md §3.1·§3.2, docs/design/architecture.md §3.
--
-- ⚠️ 기존 마이그레이션(invite_room/.../room_lifecycle)은 수정하지 않는다. 이 파일은 additive(신규 테이블/정책/트리거만).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create table if not exists / drop policy if exists / create or replace / drop trigger if exists.
--
-- ┌───────────────────────── 보안 핵심 (RLS) ─────────────────────────┐
-- │ device_tokens 는 RLS 하 클라 직접 select/insert/update/delete(RPC 아님, 비용 가드레일).               │
-- │  · 모든 정책 user_id = auth.uid() 기반 → 본인 토큰만 R/W. 타인 토큰 노출/조작 차단.                   │
-- │  · 토큰 식별 단위 = expo_push_token UNIQUE(1 토큰 = 1 행). 기기 계정 전환 시                          │
-- │    클라 upsert onConflict(expo_push_token)로 user_id·updated_at 갱신(소유자 이전).                   │
-- └──────────────────────────────────────────────────────────────────────┘
-- ⚠️ S2 예고(이번 미구현): 발송 시 *상대* 토큰을 읽어야 하나 위 RLS는 본인 토큰만 노출 →
--    S2에서 SECURITY DEFINER RPC(예: list_room_push_targets)로 같은 방 멤버 토큰을 조회한다.
--    S1은 컬럼·인덱스만 선반영하고 DEFINER RPC는 만들지 않는다.
-- OUT(이번 미사용): 발송 트리거/Edge Function, prefs gating, 무효토큰(DeviceNotRegistered) 정리.

-- gen_random_uuid() 보장(이미 invite_room에서 생성됐으나 명시).
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. 테이블 (plan §3.1 / architecture §3)
--    user_id → profiles(id) ON DELETE CASCADE: 계정 삭제 시 토큰 동반 정리.
--    expo_push_token UNIQUE: 토큰=기기 식별 단위. platform CHECK in (ios,android) — web 등 미지원.
--    device_name nullable: expo-device Device.deviceName(표시용, 옵션).
-- =====================================================================
create table if not exists public.device_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform        text not null check (platform in ('ios', 'android')),
  device_name     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =====================================================================
-- 2. RLS (plan §3.2) — select/insert/update/delete 4정책 모두 user_id = auth.uid().
-- =====================================================================
alter table public.device_tokens enable row level security;

-- select: 본인 토큰만.
drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own" on public.device_tokens
  for select using (user_id = auth.uid());

-- insert: 본인 명의만(타인 user_id로 등록 차단).
drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (user_id = auth.uid());

-- update: 본인 토큰만(onConflict upsert의 갱신 경로 — 기기 계정 전환 시 user_id=새 소유자).
--   using = 갱신 대상이 현재 본인 소유, with check = 갱신 후에도 본인 소유.
drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own" on public.device_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- delete: 본인 토큰만(로그아웃 시 현재 기기 토큰 폐기 — T6).
drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (user_id = auth.uid());

-- =====================================================================
-- 3. 인덱스 (plan §3.1) — S2에서 수신자(user_id)별 토큰 조회 효율화(풀스캔 회피).
-- =====================================================================
create index if not exists idx_device_tokens_user_id
  on public.device_tokens (user_id);

-- =====================================================================
-- 4. updated_at 자동 갱신 트리거 — upsert(onConflict)의 update 경로에서 갱신 시각 기록.
--    클라도 payload.updated_at을 넣지만 DB가 최종 방어(단일 출처 일관).
-- =====================================================================
create or replace function public.touch_device_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_device_tokens_updated_at on public.device_tokens;
create trigger trg_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.touch_device_tokens_updated_at();

-- =====================================================================
-- 5. 권한 (plan §3.2) — RLS 하 직접 접근(RPC 아님). 행 제한은 RLS가 담당.
-- =====================================================================
grant select, insert, update, delete on public.device_tokens to authenticated;
