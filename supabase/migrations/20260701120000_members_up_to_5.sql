-- 20260701120000_members_up_to_5.sql
-- members-capacity 스프린트(S5a): 로그 정원 2 → 5 확장.
-- 산출: ① enforce_room_capacity() 트리거 정원식 count>=2 → count>=5
--       ② join_room(p_code) RPC 내부 1차 정원 가드 v_count>=2 → v_count>=5
-- 설계 출처: docs/sprint/sprint-20260701-members-capacity/plan.md §스코프1·AC1, docs/design/architecture.md §3.
--
-- C6(단일 출처): 트리거 정원식(count>=5)은 클라 src/features/room/modes.ts ROOM_CAPACITY(solo·couple 모두 5)와
--                반드시 일치해야 한다. 이번 파일에서 둘을 함께 5로 상향(같은 스프린트 커밋).
--
-- ⚠️ 이미 적용된 마이그레이션은 수정하지 않는다 — 신규 파일로 override(definer-storage-and-best-effort 원칙).
--    최신 정의 베이스: 20260610150000_multi_log_home.sql
--      - enforce_room_capacity(): 모드 무관 count>=2 (room_modes의 모드별 solo=1/couple=2 분기는 이 파일에서 폐기됨).
--      - join_room(p_code): SOLO/타방 ALREADY_IN_ROOM 가드 제거, 같은 로그 PK 멱등, v_count>=2 1차 가드.
--    → 위 최신 본문을 베이스로 정원 숫자만 2→5로 교체(stale room_modes 정의를 override하지 않도록 주의).
-- ⚠️ ROOM_FULL 에러 토큰/errcode(P0001) 보존 — errors.ts ROOM_ERROR_MESSAGES.ROOM_FULL 매핑과 단일 출처 유지.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행(에이전트는 라이브 DB 미접근).
-- ⚠️ 재실행 가능(idempotent): 모두 create or replace. 트리거 trg_room_capacity 재생성 불필요(함수 본문만 교체).

-- =====================================================================
-- 1. enforce_room_capacity() — 정원 2 → 5 (replace)
--    베이스: multi_log_home(모드 무관 count>=2). 정원식 숫자만 5로 상향.
--    트리거 자체(trg_room_capacity, before insert on room_members)는 본문만 교체(재생성 불필요).
-- =====================================================================
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.room_members where room_id = new.room_id) >= 5 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 2. join_room(p_code text) — 1차 정원 가드 2 → 5 (replace)
--    베이스: multi_log_home 정의(SOLO/타방 가드 제거·같은 로그 PK 멱등·for update 잠금).
--    변경: 앱/RPC 1차 차단 v_count>=2 → v_count>=5. 나머지 로직·반환·토큰 불변.
--    반환: { "room_id": uuid }. 에러토큰: NOT_AUTHENTICATED / INVALID_CODE / ROOM_FULL.
-- =====================================================================
create or replace function public.join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_room_id uuid;
  v_count   int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 안전망: profiles 보장(C4 FK).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 정규화(서버에서도 한 번 더): 대문자 + 공백 trim.
  v_code := upper(trim(p_code));

  -- 코드로 로그 조회(DEFINER → RLS 우회).
  select id into v_room_id from public.rooms where invite_code = v_code;
  if v_room_id is null then
    raise exception 'INVALID_CODE';
  end if;

  -- 같은 로그 재조인 → 멱등 성공(PK 중복 INSERT 방지·중복 탭 안전).
  if exists (select 1 from public.room_members where room_id = v_room_id and user_id = v_uid) then
    return jsonb_build_object('room_id', v_room_id);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 1자리 동시 조인 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 앱/RPC 1차 차단(정원 5; 트리거가 최종 방어). 솔로 로그도 조인 허용.
  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 5 then
    raise exception 'ROOM_FULL';
  end if;

  -- 삽입(트리거가 최종 방어; 동시 케이스에서 ROOM_FULL raise 가능).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id);
end;
$$;

-- join_room(text) 권한 재선언(idempotent).
revoke all on function public.join_room(text)  from public, anon;
grant execute on function public.join_room(text) to authenticated;
