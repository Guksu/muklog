-- 20260616120000_wishlist.sql
-- wishlist 스프린트: 한 로그(방) 안에 "가보고 싶은 곳"을 모으는 위시리스트 테이블 신설.
-- 산출: public.wishlist_items 테이블 + RLS(멤버 select/insert/delete) + 인덱스(room_id, created_at desc)
--       + enforce_wishlist_fields 트리거(place_name 공백 거부, 최종 방어) + grant.
-- 설계 출처: docs/sprint/sprint-20260616-wishlist/plan.md §4.1·§4.2, docs/design/architecture.md §3.
--
-- ⚠️ 기존 마이그레이션(invite_room/.../log_name)은 수정하지 않는다. 이 파일은 additive(신규 테이블/정책/트리거만).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create table if not exists / drop policy if exists / create or replace / drop trigger if exists.
--
-- ┌───────────────────────── 보안 핵심 (RLS) ─────────────────────────┐
-- │ wishlist_items 는 RLS 하 클라 직접 select/insert/delete(RPC 아님, 비용 가드레일 §10).                │
-- │  · select : room_id IN 내 방            → 타방 위시 read 차단(B3)                                  │
-- │  · insert : with check (added_by=auth.uid() and room_id IN 내 방) → 타인 명의/타방 insert 차단(B2)  │
-- │  · delete : room_id IN 내 방            → 커플 공유 리스트(멤버 누구나 정리, plan §3 결정).            │
-- │ update 정책 없음(편집 OUT) → 직접 update 거부. room_members RLS=자기 행만 → 파트너 프로필 비노출,    │
-- │ 작성자 라벨(addedByMe/짝꿍)은 클라가 added_by uuid로 파생(B4).                                       │
-- └──────────────────────────────────────────────────────────────────────┘
-- OUT(이번 미사용): Realtime 구독, 위시 편집(update), note 입력 UI(컬럼만 선반영·표시만).

-- gen_random_uuid() 보장(이미 invite_room에서 생성됐으나 명시).
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. 테이블 (plan §4.1 / architecture §3)
--    명명은 muklogs와 정렬(place_name·road_address·category·area·lat·lng·kakao_place_id).
--    작성자 컬럼만 added_by(킷 addedBy). lat/lng·kakao_place_id·road_address·area·category·note = nullable
--    (수동/좌표없는 검색결과 허용). added_by = profiles(id)(auth user) → 표시단 매핑.
-- =====================================================================
create table if not exists public.wishlist_items (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  place_name     text not null,
  category       text,                 -- 앱이 8종 enum 강제(DB는 자유 text), 미지 key는 표시단 폴백
  area           text,                 -- 동네 표시(예: "성수동")
  road_address   text,                 -- 킷 road
  lat            double precision,     -- nullable(수동/검색 미선택 시 NULL)
  lng            double precision,     -- nullable
  kakao_place_id text,                 -- Kakao 장소 id
  note           text,                 -- 이번 스프린트 입력 UI OUT, 표시만(값 있으면 렌더)
  added_by       uuid not null references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- 2. RLS (plan §4.2) — select/insert/delete 3정책. update 정책 없음(편집 OUT).
-- =====================================================================
alter table public.wishlist_items enable row level security;

-- select: 내가 멤버인 방의 위시만.
drop policy if exists "wishlist_select_member" on public.wishlist_items;
create policy "wishlist_select_member" on public.wishlist_items
  for select using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- insert: added_by=본인 AND 내 방(타인 명의/타방 차단).
drop policy if exists "wishlist_insert_member" on public.wishlist_items;
create policy "wishlist_insert_member" on public.wishlist_items
  for insert with check (
    added_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- delete: 룸 멤버 누구나(공유 리스트) — 내 방이면 삭제 허용.
drop policy if exists "wishlist_delete_member" on public.wishlist_items;
create policy "wishlist_delete_member" on public.wishlist_items
  for delete using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

-- =====================================================================
-- 3. 인덱스 (plan §4.1) — 방별 최신 추가순 조회 효율화(풀스캔 회피, 비용 가드레일 §10).
--    쿼리 정렬(created_at desc)과 컬럼 순서 일치.
-- =====================================================================
create index if not exists idx_wishlist_room_created
  on public.wishlist_items (room_id, created_at desc);

-- =====================================================================
-- 4. 값 검증 트리거 (plan §4.2) — place_name 공백 거부(앱 1차 + DB 최종 방어).
--    ⚠️ raise 토큰은 SQL ↔ 앱(features/wishlist/errors.ts)이 단일 출처여야 한다(동기화 유지).
--    ⚠️ added_by/room_id 위변조는 RLS with check가 막는다(트리거는 값만).
-- =====================================================================
create or replace function public.enforce_wishlist_fields()
returns trigger
language plpgsql
as $$
begin
  if new.place_name is null or length(btrim(new.place_name)) = 0 then
    raise exception 'PLACE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wishlist_fields on public.wishlist_items;
create trigger trg_wishlist_fields
  before insert or update on public.wishlist_items
  for each row execute function public.enforce_wishlist_fields();

-- =====================================================================
-- 5. 권한 (plan §4.2) — RLS 하 직접 접근(RPC 아님). 행 제한은 RLS가 담당.
-- =====================================================================
grant select, insert, delete on public.wishlist_items to authenticated;
