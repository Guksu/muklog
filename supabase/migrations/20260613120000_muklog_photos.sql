-- 20260613120000_muklog_photos.sql
-- muklog-photos 스프린트: 먹로그 사진(최대 5장) 첨부의 데이터·Storage·정책 토대.
-- 산출: public.muklog_photos 테이블 + 인덱스(muklog_id, order_index) + RLS(멤버 select/insert/delete)
--       + enforce_muklog_photo_fields 트리거(order 0~4·먹로그당 5장 상한) + grant
--       + 비공개 Storage 버킷 'muklog-photos'(public=false) + storage 정책 3종(첫 세그먼트=room_id 멤버)
--       + muklogs_delete_own RLS 정책(사진 업로드 실패 롤백용 — muklog-list엔 delete 정책 없음).
-- 설계 출처: docs/sprint/sprint-20260613-muklog-photos/plan.md §3.2~§3.4·§6, docs/design/architecture.md §3.
--
-- ⚠️ 기존 마이그레이션(invite_room/.../muklog_list)은 수정하지 않는다. 이 파일은 additive.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create table if not exists / drop policy if exists / create or replace
--    / drop trigger if exists / on conflict do nothing.
--
-- ┌───────────────────────── 보안 핵심 (RLS + Storage) ─────────────────────────┐
-- │ muklog_photos: select=상위 먹로그가 내 방. insert/delete=내 방 + 그 먹로그를 내가 만든 것(created_by). │
-- │ Storage 'muklog-photos'(private): 경로 첫 세그먼트(room_id)가 내 방일 때만 read/insert/delete.        │
-- │ private 버킷이므로 signed URL(만료 1h)로만 표시 — getPublicUrl 미사용(plan §3.1).                      │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- OUT(이번 미구현): Storage 파일 자동삭제(muklog 삭제 시 행은 FK CASCADE로 사라지나 파일은 orphan → 차기 정리 잡).

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. 테이블 (plan §3.2 / architecture §3)
--    storage_path = 버킷 내부 키 '{room_id}/{muklog_id}/{uuid}.jpg' (photoPath.ts 단일 출처).
--    order_index  = 0~4 (선택 순서, 트리거로 범위·5장 상한 방어).
-- =====================================================================
create table if not exists public.muklog_photos (
  id           uuid primary key default gen_random_uuid(),
  muklog_id    uuid not null references public.muklogs(id) on delete cascade,
  storage_path text not null,
  order_index  smallint not null,
  created_at   timestamptz not null default now()
);

-- 먹로그별 정렬 조회(대표 1장 order_index 최소 추출) 효율화.
create index if not exists idx_muklog_photos_muklog_order
  on public.muklog_photos (muklog_id, order_index);

-- =====================================================================
-- 2. RLS (plan §3.3) — 상위 muklog의 room 멤버십으로 검증.
--    select : 상위 먹로그가 내 방
--    insert : 상위 먹로그가 내 방 + 그 먹로그를 내가 만든 것(created_by=auth.uid())
--    delete : insert와 동일(orphan 정리·차기 편집 대비)
--    update : 정책 없음(불필요 — 재정렬은 차기 muklog-edit).
-- =====================================================================
alter table public.muklog_photos enable row level security;

drop policy if exists "muklog_photos_select_member" on public.muklog_photos;
create policy "muklog_photos_select_member" on public.muklog_photos
  for select using (
    muklog_id in (
      select id from public.muklogs
      where room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );

drop policy if exists "muklog_photos_insert_member" on public.muklog_photos;
create policy "muklog_photos_insert_member" on public.muklog_photos
  for insert with check (
    muklog_id in (
      select id from public.muklogs
      where created_by = auth.uid()
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );

drop policy if exists "muklog_photos_delete_member" on public.muklog_photos;
create policy "muklog_photos_delete_member" on public.muklog_photos
  for delete using (
    muklog_id in (
      select id from public.muklogs
      where created_by = auth.uid()
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );

-- =====================================================================
-- 3. 값 검증 트리거 (plan §3.2) — order_index 0~4 범위 + 먹로그당 5장 상한.
--    ⚠️ raise 토큰은 SQL ↔ 앱(features/muklog/errors.ts MuklogErrorToken)이 단일 출처여야 한다.
-- =====================================================================
create or replace function public.enforce_muklog_photo_fields()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  -- order_index 0~4 범위.
  if new.order_index < 0 or new.order_index > 4 then
    raise exception 'PHOTO_ORDER_OUT_OF_RANGE' using errcode = 'P0001';
  end if;
  -- 먹로그당 5장 상한(현재 행 수가 이미 5 이상이면 차단).
  select count(*) into existing_count from public.muklog_photos where muklog_id = new.muklog_id;
  if existing_count >= 5 then
    raise exception 'PHOTO_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_muklog_photo_fields on public.muklog_photos;
create trigger trg_muklog_photo_fields
  before insert on public.muklog_photos
  for each row execute function public.enforce_muklog_photo_fields();

-- =====================================================================
-- 4. 권한 (plan §3.2) — RLS 하 직접 접근(RPC 아님). delete는 orphan 정리/롤백·차기 편집 대비.
-- =====================================================================
grant select, insert, delete on public.muklog_photos to authenticated;

-- =====================================================================
-- 5. muklogs 롤백용 delete 정책 (plan §6) — 사진 업로드 실패 시 방금 만든 muklog 정리.
--    muklog-list엔 delete 정책이 없어 정리 delete가 거부됨 → 본인 행만 삭제 허용.
--    ⚠️ 일반 삭제 UI는 여전히 OUT(차기). 이 정책은 정리/롤백 한정 용도(created_by=본인 + 내 방).
-- =====================================================================
drop policy if exists "muklogs_delete_own" on public.muklogs;
create policy "muklogs_delete_own" on public.muklogs
  for delete using (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );
grant delete on public.muklogs to authenticated;

-- =====================================================================
-- 6. 비공개 Storage 버킷 'muklog-photos' (plan §3.4)
--    ⚠️ public=false — 먹로그 사진은 커플의 사적 기록. signed URL(만료 1h)로만 표시.
--    경로 규약: {room_id}/{muklog_id}/{uuid}.jpg (첫 세그먼트=room_id가 정책 멤버십 판정 기준).
--    ⚠️ 버킷명 'muklog-photos'는 src/features/muklog/photoPath.ts 와 단일 출처.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('muklog-photos', 'muklog-photos', false)
on conflict (id) do nothing;

-- =====================================================================
-- 7. storage.objects 정책 — 첫 세그먼트(room_id)가 내 방일 때만 read/insert/delete.
--    private 버킷이므로 select 정책 필수(authenticated download/signed URL 검증).
-- =====================================================================
drop policy if exists "muklog_photos_storage_select_member" on storage.objects;
create policy "muklog_photos_storage_select_member" on storage.objects for select to authenticated
  using (
    bucket_id = 'muklog-photos'
    and (storage.foldername(name))[1] in (
      select room_id::text from public.room_members where user_id = auth.uid()
    )
  );

drop policy if exists "muklog_photos_storage_insert_member" on storage.objects;
create policy "muklog_photos_storage_insert_member" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'muklog-photos'
    and (storage.foldername(name))[1] in (
      select room_id::text from public.room_members where user_id = auth.uid()
    )
  );

drop policy if exists "muklog_photos_storage_delete_member" on storage.objects;
create policy "muklog_photos_storage_delete_member" on storage.objects for delete to authenticated
  using (
    bucket_id = 'muklog-photos'
    and (storage.foldername(name))[1] in (
      select room_id::text from public.room_members where user_id = auth.uid()
    )
  );
