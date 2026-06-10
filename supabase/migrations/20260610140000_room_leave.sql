-- 20260610140000_room_leave.sql
-- room-leave 스프린트: 방 나가기(즉시) — 멤버십 즉시 해지 + 0명 시 방 삭제.
-- 산출: leave_room() RPC(무인자, SECURITY DEFINER) + 권한 grant.
-- 설계 출처: docs/sprint/sprint-20260610-room-leave/plan.md §3, docs/design/architecture.md §3·§7.
--
-- ⚠️ 기존 invite_room(20260609120000)/room_modes(20260610130000) 마이그레이션은 수정하지 않는다 —
--    이미 적용된 환경 고려, 이 파일은 additive(신규 RPC만 추가).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create or replace function / 권한 재선언.
--
-- 설계 결정(plan §3.2):
--   - 나가기 = "내 멤버십만 해지". 잔여 1명 이상 → 방 보존(남은 멤버 데이터 손실 0).
--   - 잔여 0명 → 방 삭제(CASCADE로 하위 정리). 현재 CASCADE 대상은 room_members뿐
--     (muklogs/muklog_photos 테이블 부재). 미래 muklogs.room_id FK는 ON DELETE CASCADE 필수(plan §3.3).
--   - 예약/유예/취소/cron 없음 → 즉시 확정(24h 유예는 room-lifecycle 보류).

-- =====================================================================
-- leave_room() RPC (SECURITY DEFINER, 무인자) — plan §3.1
--   반환 jsonb: { "room_deleted": <bool>, "room_id": <uuid|null> }
--   에러토큰: NOT_AUTHENTICATED (그 외 멤버 아님은 멱등 성공)
--
--   ⚠️ 무인자 단일 시그니처만 둔다(create_room 오버로드 함정 교훈) — 인자 버전 만들지 않음.
--
--   함정 3개(plan §6·부록):
--     ① DEFINER는 RLS 우회 → 삭제에 `user_id = v_uid` 스코프 필수(누락 시 타인 행 삭제, C-RLS).
--     ② 멤버십 삭제 '전에' 방 행 for update 잠금 → 마지막 두 멤버 동시 나가기의 고아 빈 방 방지(C-CONC).
--     ③ 방 삭제는 잔여 count 0 확인 '후에만' → 먼저 지우면 CASCADE로 상대 멤버까지 삭제(C-DEL).
-- =====================================================================
create or replace function public.leave_room()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_room_id   uuid;
  v_remaining int;
  v_deleted   boolean := false;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 호출자의 멤버십 방 조회(1인 1방 불변식 → 최대 1행).
  select room_id into v_room_id from public.room_members where user_id = v_uid;

  -- 멤버 아님(이미 나감/방 없음) → 멱등 성공. 재호출 안전(C-IDEM).
  if v_room_id is null then
    return jsonb_build_object('room_deleted', false, 'room_id', null);
  end if;

  -- 함정②: 멤버십 삭제 전에 방 행 잠금 → 동시 나가기 직렬화(고아 빈 방 방지, C-CONC).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 함정①: 본인 행만 삭제(DEFINER RLS 우회 상태 → 스코프 명시 필수, C-RLS).
  delete from public.room_members where room_id = v_room_id and user_id = v_uid;

  -- 잔여 멤버 수 확인.
  select count(*) into v_remaining from public.room_members where room_id = v_room_id;

  -- 함정③: 잔여 0일 때만 방 삭제(CASCADE로 하위 정리). 잔여 ≥1이면 보존(남은 멤버 손실 0, C-DEL).
  if v_remaining = 0 then
    delete from public.rooms where id = v_room_id;
    v_deleted := true;
  end if;

  return jsonb_build_object('room_deleted', v_deleted, 'room_id', v_room_id);
end;
$$;

-- 권한: 익명 사용자도 Supabase에서 authenticated 역할 → authenticated 에 execute.
revoke all on function public.leave_room() from public, anon;
grant execute on function public.leave_room() to authenticated;
