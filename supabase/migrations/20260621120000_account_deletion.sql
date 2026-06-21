-- 20260621120000_account_deletion.sql
-- account-deletion 스프린트: 회원 탈퇴(계정 삭제, Apple 5.1.1(v)) 데이터 토대 — 작성자 익명화 가능화.
-- 산출: 차단 FK(RESTRICT, NOT NULL) 3종을 NOT NULL 해제 + ON DELETE SET NULL 로 전환,
--       + rooms.delete_requested_by FK 를 ON DELETE SET NULL 로 보강.
-- 설계 출처: docs/sprint/sprint-20260621-account-deletion/plan.md §1, docs/design/architecture.md §1·§3.
--
-- ⚠️ 기존 마이그레이션(invite_room/muklog_list/wishlist/room_modes 등)은 수정하지 않는다. 이 파일은 additive.
-- ⚠️ 재실행 가능(idempotent): drop constraint if exists → add constraint / alter column drop not null(멱등).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행(developer는 적용 금지).
--
-- 배경(정찰): muklogs.created_by · rooms.created_by · wishlist_items.added_by 가 profiles(id)를
--   cascade 없이(RESTRICT) + NOT NULL 로 참조 → 사용자가 만든 룸/맛집/위시가 있으면 profile 삭제가 막힌다.
--   회원 탈퇴 시 auth.admin.deleteUser → profiles ON DELETE CASCADE 가 발화하려면 이 컬럼들이
--   삭제를 차단하지 않고 NULL(익명화)이 되어야 한다(사용자 결정: 커플 공유 기록은 보존·작성자 익명화).
--
-- 안전(소비처 영향, plan §1 소비처 점검 + qa-logic 교차검증):
--   · RLS(muklogs_update_own/muklogs_delete_own/wishlist_delete_member 등)는 `created_by = auth.uid()`
--     / `added_by = auth.uid()` 조건 → created_by/added_by 가 NULL 이면 `NULL = auth.uid()` = NULL(=false 취급)
--     → 익명화된 행은 그 누구도 편집/삭제 불가(우연 통과 0). 본 파일에서 RLS 변경 불필요(NULL-safe 확인).
--   · list_my_rooms()/get_room()/useMuklogs/useMuklog 는 created_by 를 표시 파생(라벨/아바타)에만 사용 →
--     NULL 이면 "탈퇴한 사용자" + 기본 아바타로 graceful(앱 데이터 레벨 폴백). 조회 차단 없음.
--
-- 컬럼 위치 주의(plan 텍스트 정정): delete_requested_by 는 room_members 가 아니라 **rooms** 테이블 컬럼이다
--   (20260610130000_room_modes.sql 에서 rooms 에 추가). 실제 스키마 기준으로 rooms.delete_requested_by 를 대상.

-- =====================================================================
-- 1. NOT NULL 제약 해제 — 익명화(SET NULL) 가능하게 (plan §1)
--    이미 nullable 이면 no-op(멱등). 기존 행은 모두 값이 있으므로 데이터 영향 없음.
-- =====================================================================
alter table public.muklogs alter column created_by drop not null;
alter table public.rooms alter column created_by drop not null;
alter table public.wishlist_items alter column added_by drop not null;

-- =====================================================================
-- 2. FK 재선언 — RESTRICT → ON DELETE SET NULL (plan §1)
--    기존 FK 는 인라인 익명 정의라 Postgres 가 {table}_{col}_fkey 로 자동 명명한다.
--    drop constraint if exists 로 자동명 제거 후(없으면 no-op), 동일 명으로 SET NULL FK 재선언(idempotent).
-- =====================================================================

-- muklogs.created_by → profiles(id) ON DELETE SET NULL
alter table public.muklogs drop constraint if exists muklogs_created_by_fkey;
alter table public.muklogs
  add constraint muklogs_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- rooms.created_by → profiles(id) ON DELETE SET NULL
alter table public.rooms drop constraint if exists rooms_created_by_fkey;
alter table public.rooms
  add constraint rooms_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- wishlist_items.added_by → profiles(id) ON DELETE SET NULL
alter table public.wishlist_items drop constraint if exists wishlist_items_added_by_fkey;
alter table public.wishlist_items
  add constraint wishlist_items_added_by_fkey
  foreign key (added_by) references public.profiles (id) on delete set null;

-- rooms.delete_requested_by → profiles(id) ON DELETE SET NULL (이미 nullable, 차단 방지 보강)
--   삭제 예약 요청자가 탈퇴하면 예약 요청자만 NULL(예약 자체·방은 보존, cron/취소 로직은 NULL 안전).
alter table public.rooms drop constraint if exists rooms_delete_requested_by_fkey;
alter table public.rooms
  add constraint rooms_delete_requested_by_fkey
  foreign key (delete_requested_by) references public.profiles (id) on delete set null;
