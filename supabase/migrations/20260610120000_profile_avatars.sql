-- 20260610120000_profile_avatars.sql
-- profile 스프린트: 아바타 Storage 버킷 + 소유자 쓰기 정책.
-- 산출: avatars 버킷(public) + storage.objects insert/update/delete 정책(첫 세그먼트=uid).
-- 설계 출처: docs/sprint/sprint-20260610-profile/plan.md §3.1.
--
-- ⚠️ profiles 테이블/컬럼·RLS는 invite-room(20260609120000)에서 이미 생성됨 → 이 파일은 DDL 변경 없음.
--    이번엔 avatar_url/nickname "값 편집"만 하므로 기존 profiles RLS(own-only)를 그대로 재사용한다.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존(supabase db push 또는 SQL 에디터 실행).
--    재실행 가능(idempotent): on conflict do nothing / drop policy if exists.

-- =====================================================================
-- 1. avatars 버킷 (공개 읽기)
--    아바타는 비민감 + 추후 파트너 표시 대비 → public=true.
--    파일명이 uuid → 교체 시 URL 변경 = CDN 캐시 자연 무효화.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- =====================================================================
-- 2. storage.objects 정책
--    경로 규약: avatars/{user_id}/{uuid}.jpg  (첫 세그먼트 = 소유자 uid)
--    쓰기(insert/update/delete)는 소유자만. 읽기는 public 버킷이라 익명 CDN 허용(별도 select 정책 불필요).
--    ⚠️ 버킷명 'avatars' / 경로 첫 세그먼트=uid 규약은 src/features/profile/avatarPath.ts 와 단일 출처.
-- =====================================================================

drop policy if exists "avatar_insert_own" on storage.objects;
create policy "avatar_insert_own" on storage.objects for insert to authenticated
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects for update to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects for delete to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );
