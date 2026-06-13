-- 20260613130000_muklog_edit.sql
-- muklog-edit 스프린트: 먹로그 수정(update)·삭제 데이터 토대(RLS update 정책 2종).
-- 산출: muklogs_update_own RLS(본인+내 방만 update, 위변조 차단)
--       + muklog_photos_update_member RLS(reindex용 order_index update)
--       + 각 grant update.
-- 설계 출처: docs/sprint/sprint-20260613-muklog-edit/plan.md §3.1·§3.4, docs/design/architecture.md §3.
--
-- ⚠️ 기존 마이그레이션(invite_room/.../muklog_photos)은 수정하지 않는다. 이 파일은 additive.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): drop policy if exists → create policy.
--
-- ┌───────────────────── 재사용(추가 안 함) — 기존 마이그레이션 자산 ─────────────────────┐
-- │ muklogs_delete_own  : muklog_photos 마이그레이션(20260613120000)이 이미 선언 + grant delete.  │
-- │                       → 본 파일에서 재선언 금지(중복 정의 회피). 삭제 UI도 이 정책을 그대로 쓴다. │
-- │ enforce_muklog_fields 트리거 : muklog-list 마이그레이션이 이미 `before insert OR update`로 선언. │
-- │                       → update 시에도 place_name/rating/visited_at 값 검증이 발화(2차 방어).     │
-- │                       → 본 파일에서 추가/변경 불필요.                                           │
-- │ muklog_photos insert/delete RLS · storage select/insert/delete 정책 · FK ON DELETE CASCADE :  │
-- │                       모두 기존(20260613120000)에 존재. reconciliation의 delete/insert는 재사용. │
-- └─────────────────────────────────────────────────────────────────────────────────────────────┘
-- OUT(이번 미구현): Storage 파일 자동삭제 트리거(앱이 useDeleteMuklog로 remove). 잔여 orphan은 차기 정리 잡.

-- =====================================================================
-- 1. muklogs update 정책 (plan §3.1) — 본인이 만든 + 내 방 먹로그만 수정.
--    using(현재 행) + with check(수정 후 행) 모두 동일 조건
--    → 타인 명의/타 방으로의 위변조(created_by/room_id 변경)를 with check가 차단.
--    앱(useUpdateMuklog)은 created_by/room_id를 payload에 넣지 않아 1차로도 사고를 차단한다.
-- =====================================================================
drop policy if exists "muklogs_update_own" on public.muklogs;
create policy "muklogs_update_own" on public.muklogs
  for update
  using (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  )
  with check (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

grant update on public.muklogs to authenticated;

-- =====================================================================
-- 2. muklog_photos update 정책 (plan §3.4) — reindex(order_index 재부여)용.
--    조건은 insert와 동일(상위 먹로그가 내 방 + 그 먹로그를 내가 만든 것).
--    using(현재 행) + with check(변경 후 행) 모두 동일 — 다른 먹로그로의 이동을 차단.
--    사진 재정렬을 delete+재업로드 없이 update로 처리해 Storage 재업로드 비용·orphan을 회피(plan §3.4).
-- =====================================================================
drop policy if exists "muklog_photos_update_member" on public.muklog_photos;
create policy "muklog_photos_update_member" on public.muklog_photos
  for update
  using (
    muklog_id in (
      select id from public.muklogs
      where created_by = auth.uid()
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  )
  with check (
    muklog_id in (
      select id from public.muklogs
      where created_by = auth.uid()
        and room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
  );

grant update on public.muklog_photos to authenticated;
