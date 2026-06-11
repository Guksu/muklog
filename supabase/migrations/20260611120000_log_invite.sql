-- 20260611120000_log_invite.sql
-- log-invite 스프린트: 커플 초대 흐름 완성(코드 표시·복사 + 입장 UI).
-- 산출: get_room(p_room_id) DEFINER RPC 신설 — LogScreen이 그 로그의 invite_code + member_count + mode를
--       1 round-trip으로 가져온다(멤버십 검사 내장).
-- 설계 출처: docs/sprint/sprint-20260611-log-invite/plan.md §4·§5.1, docs/design/architecture.md §4·§5.
--
-- ⚠️ 기존 마이그레이션(invite_room/room_modes/room_leave/multi_log_home)은 수정하지 않는다.
--    이 파일은 additive(신규 함수만 추가, 기존 함수 미수정).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create or replace + 권한 재선언.
--
-- ┌───────────────────────── 보안 핵심 (C4-RLS) ─────────────────────────┐
-- │ get_room 은 SECURITY DEFINER → RLS 를 우회한다. 본문에서 호출자(auth.uid())가     │
-- │ p_room_id 의 멤버인지 명시 검사하지 않으면 누구나 임의 로그의 invite_code 를 읽어      │
-- │ 초대 시스템이 붕괴한다. 따라서 멤버십 검사 → 없으면 NOT_A_MEMBER raise 가 필수.       │
-- │ (room_members RLS=자기 행만이라 member_count 도 클라가 직접 집계 불가 → DEFINER 필수) │
-- └──────────────────────────────────────────────────────────────────────┘

-- =====================================================================
-- get_room(p_room_id uuid) — 단일 로그 상세 조회 RPC (신설, SECURITY DEFINER)
--    반환(성공): { "room_id": uuid, "invite_code": text, "member_count": int, "mode": text }
--    에러 토큰: NOT_AUTHENTICATED / NOT_A_MEMBER / ROOM_NOT_FOUND
--    member_count = (select count(*) from room_members where room_id = p_room_id) — DEFINER 전 멤버 집계.
-- =====================================================================
create or replace function public.get_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_invite_code  text;
  v_mode         text;
  v_member_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 로그 존재 확인(DEFINER → RLS 우회). 없으면 ROOM_NOT_FOUND.
  select r.invite_code, r.mode
    into v_invite_code, v_mode
    from public.rooms r
   where r.id = p_room_id;

  if v_invite_code is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- ⚠️ 보안 핵심(C4-RLS): 호출자가 이 로그의 멤버인지 명시 검사.
  --    멤버 아니면 거부(존재하는 코드라도 비멤버에게 노출 금지).
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 정확한 멤버 수(DEFINER 전 멤버 집계 — 솔로/커플 파생). 클라 직접 select는 self-only RLS로 불가.
  select count(*)::int into v_member_count
    from public.room_members m
   where m.room_id = p_room_id;

  return jsonb_build_object(
    'room_id', p_room_id,
    'invite_code', v_invite_code,
    'member_count', v_member_count,
    'mode', v_mode
  );
end;
$$;

-- 권한: 익명도 Supabase에서 authenticated 역할 → authenticated 에 execute. anon/public 차단.
revoke all on function public.get_room(uuid) from public, anon;
grant execute on function public.get_room(uuid) to authenticated;
