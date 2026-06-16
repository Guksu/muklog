-- 20260616140000_room_cascade_storage_fix.sql
-- room-lifecycle 후속 핫픽스 — _delete_room_cascade 의 Storage 메타 정리를 best-effort 로 격리.
--
-- 문제(라이브에서 발견): 솔로 로그 나가기/삭제 시 "연결에 실패했어요" 에러 + 삭제 실패.
--   원인 = _delete_room_cascade(20260616130000) 의 `delete from storage.objects ...` 가
--   DEFINER(소유자=postgres) 컨텍스트에서 Supabase storage.objects(소유=supabase_storage_admin)에 대한
--   DELETE 권한 부족으로 permission denied 예외 → leave_room 트랜잭션 롤백 → 방 삭제 실패.
--   ※ DELETE 문은 매칭 행 0개(사진 없는 새 로그)에도 권한 검사 → 모든 솔로 삭제가 이 줄에서 실패.
--   ※ Postgres 에러는 errors.ts 토큰 미일치 → DEFAULT_ROOM_ERROR_MESSAGE("연결에 실패했어요")로 표면화.
--
-- 수정: Storage 메타 정리를 begin/exception 블록으로 감싸 best-effort 화.
--   권한/환경 문제로 실패해도 NOTICE만 남기고 방 삭제(핵심)는 계속 진행한다.
--   고아 Storage 메타·실제 파일 GC는 환경 의존(라이브 스모크 이월 항목, plan §5) — 삭제 차단 사유가 될 수 없다.
--
-- additive·idempotent: create or replace 로 함수 본문만 교체. 시그니처·grant(revoke 내부전용) 불변.
-- 영향: leave_room(솔로 즉시삭제) · delete_expired_rooms(cron) 둘 다 이 헬퍼를 거치므로 한 번에 해소.

create or replace function public._delete_room_cascade(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  -- Storage 메타 선정리(D5) — best-effort. 권한/환경 문제로 실패해도 방 삭제는 진행(삭제를 막지 않음).
  begin
    delete from storage.objects
      where bucket_id = 'muklog-photos' and name like p_room_id::text || '/%';
  exception
    when others then
      -- 권한 부족(insufficient_privilege) 등 — 고아 메타는 환경측 GC/후속 정리에 위임. 방 삭제는 계속.
      raise notice 'storage meta cleanup skipped for room %: %', p_room_id, sqlerrm;
  end;

  -- 방 삭제 → muklogs/muklog_photos/wishlist_items/room_members FK ON DELETE CASCADE 로 하위 정리.
  delete from public.rooms where id = p_room_id;
end;
$$;

-- 내부 전용 유지(클라/익명/로그인 사용자 호출 불가). create or replace 는 grant 를 변경하지 않으나 명시 재선언.
revoke all on function public._delete_room_cascade(uuid) from public, anon, authenticated;
