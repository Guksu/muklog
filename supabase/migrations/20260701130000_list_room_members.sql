-- 20260701130000_list_room_members.sql
-- members-display 스프린트(S5b): 같은 로그 멤버들의 실 닉네임·아바타를 조회하는 DEFINER RPC 신설.
-- 산출: list_room_members(p_room_id) DEFINER RPC — 호출자가 그 로그 멤버일 때만
--       그 로그 멤버들의 { user_id, nickname, avatar_url }(최대 5행, joined_at asc)을 반환.
-- 설계 출처: docs/sprint/sprint-20260701-members-display/plan.md §3.1, docs/design/architecture.md §3.
--
-- ⚠️ 기존 마이그레이션은 수정하지 않는다 — 이 파일은 additive(신규 함수만 추가).
--    베이스 패턴: 20260611120000_log_invite.sql get_room(p_room_id)(DEFINER + 멤버십 검사 내장).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행(에이전트는 라이브 DB 미접근).
-- ⚠️ 재실행 가능(idempotent): create or replace + 권한 재선언.
--
-- ┌───────────────────────── 보안 핵심 (C4-RLS) ─────────────────────────┐
-- │ list_room_members 는 SECURITY DEFINER → profiles self-only RLS 를 우회한다.    │
-- │ 본문에서 호출자(auth.uid())가 p_room_id 의 멤버인지 명시 검사하지 않으면            │
-- │ 누구나 임의 로그의 멤버 프로필(닉/아바타)을 유출 → 프라이버시 붕괴.                  │
-- │ 따라서 멤버십 검사 → 없으면 NOT_A_MEMBER raise 가 프라이버시 격리의 핵심.           │
-- │ (co-member 프로필 read 는 오직 이 스코프된 RPC 로만 허용 — RLS 자체는 self-only 유지) │
-- └──────────────────────────────────────────────────────────────────────┘
--
-- 아바타 URL 계약(plan §3.4): avatars 버킷은 public(20260610120000_profile_avatars.sql: public=true)
--   → profiles.avatar_url 은 직접 렌더 가능한 CDN URL(getPublicUrl). signed URL 미개입 — 값 그대로 투영.

-- =====================================================================
-- list_room_members(p_room_id uuid) — 같은 로그 멤버 목록 조회 RPC (신설, SECURITY DEFINER)
--    반환(성공): setof (user_id uuid, nickname text, avatar_url text) — 최대 5행(정원 5), joined_at asc.
--    에러 토큰: NOT_AUTHENTICATED / ROOM_NOT_FOUND / NOT_A_MEMBER (모두 기존 errors.ts 매핑, 신규 토큰 0).
--    nickname/avatar_url 은 nullable(미설정 프로필 → 클라 defaultNickname/기본 아바타 폴백).
-- =====================================================================
create or replace function public.list_room_members(p_room_id uuid)
returns table (user_id uuid, nickname text, avatar_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 로그 존재 확인(DEFINER → RLS 우회). 없으면 ROOM_NOT_FOUND.
  if not exists (select 1 from public.rooms r where r.id = p_room_id) then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- ⚠️ 보안 핵심(C4-RLS): 호출자가 이 로그의 멤버인지 명시 검사.
  --    비멤버면 거부(임의 room_id 로 타인 멤버 프로필 유출 차단).
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 멤버 프로필 투영(DEFINER → profiles self-only RLS 우회, same-room 스코프).
  --   joined_at asc: 생성자=첫 행. 클라는 meId 로 "나"를 판정(첫 행≠항상 나).
  return query
    select m.user_id, p.nickname, p.avatar_url
      from public.room_members m
      join public.profiles p on p.id = m.user_id
     where m.room_id = p_room_id
     order by m.joined_at asc;
end;
$$;

-- 권한: 익명도 Supabase에서 authenticated 역할 → authenticated 에 execute. anon/public 차단.
revoke all on function public.list_room_members(uuid) from public, anon;
grant execute on function public.list_room_members(uuid) to authenticated;
