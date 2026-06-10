-- 20260610150000_multi_log_home.sql
-- multi-log-home 스프린트: "1인 1방" → "1인 多로그" 전환.
-- 산출: ① enforce_room_capacity 정원 2 통일(모드별 solo=1 폐기) ② create_room 1인1방 가드 제거
--       ③ join_room 솔로거부·타방 가드 제거(같은 로그 멤버십 PK 멱등 유지) ④ list_my_rooms() 신설
--       ⑤ leave_room()→leave_room(p_room_id) 인자화(多로그 호환 선반영, UI 호출부는 차기 LogScreen).
-- 설계 출처: docs/sprint/sprint-20260610-multi-log-home/plan.md §3, docs/design/architecture.md §1·§3·§4.
--
-- ⚠️ 기존 invite_room(20260609120000)/room_modes(20260610130000)/room_leave(20260610140000) 마이그레이션은
--    수정하지 않는다 — 이미 적용된 환경 고려, 이 파일은 additive(함수 본문 교체 + 신규 RPC).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): 모두 create or replace + 권한 재선언.
--
-- 적용 순서:
--   1) enforce_room_capacity 본문 교체(정원 2 통일) — 트리거 trg_room_capacity는 재생성 불필요(본문만 교체)
--   2) create_room 본문 교체(ALREADY_IN_ROOM 가드 제거)
--   3) join_room 본문 교체(SOLO_ROOM_NOT_JOINABLE·타방 ALREADY_IN_ROOM 제거, 같은 로그 PK 멱등 유지)
--   4) list_my_rooms() 신설(DEFINER, member_count 집계) + grant/revoke
--   5) leave_room() drop → leave_room(p_room_id uuid) 재생성(인자화) + grant/revoke

-- =====================================================================
-- 1. enforce_room_capacity() — 정원 2 통일 (replace, plan §3.1)
--    room_modes의 모드별(solo=1) 분기 폐기 → 모든 로그 정원 2 고정.
--    트리거 자체(trg_room_capacity, before insert on room_members)는 본문만 교체(재생성 불필요).
--    결과적으로 invite_room.sql의 정원2 의미로 환원.
-- =====================================================================
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.room_members where room_id = new.room_id) >= 2 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 2. create_room(p_mode text default 'couple') — 1인1방 가드 제거 (replace, plan §3.2)
--    room_modes 버전에서 `ALREADY_IN_ROOM` 가드 블록만 삭제 → 한 사용자가 여러 로그 생성 가능.
--    나머지(NOT_AUTHENTICATED·INVALID_MODE·profiles 안전망·코드생성 루프·INSERT·반환)는 불변.
--    반환: { "room_id": uuid, "invite_code": text, "mode": text } (불변).
--    에러토큰: NOT_AUTHENTICATED / INVALID_MODE / CODE_GENERATION_FAILED (ALREADY_IN_ROOM 더는 raise 안 함).
-- =====================================================================
create or replace function public.create_room(p_mode text default 'couple')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- charset: A-Z 중 O,I 제외(24) + 0-9 중 0,1 제외(8) = 32자. ⚠️ 클라 INVITE_CODE_CHARSET 과 동일(C6).
  v_charset constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid     uuid := auth.uid();
  v_code    text;
  v_room_id uuid;
  v_attempt int := 0;
  i         int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 모드 검증: solo|couple 외 값(null/오타) 차단.
  if p_mode is null or p_mode not in ('solo', 'couple') then
    raise exception 'INVALID_MODE';
  end if;

  -- 안전망: profiles 보장(AuthProvider 선행 upsert가 1차, 이건 FK 무결성 2차 방어).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- ⚠️ 멀티 로그 전환: 기존 "1인 1방" 가드(ALREADY_IN_ROOM)를 제거했다.
  --    이제 한 사용자가 여러 로그를 생성할 수 있다(plan §3.2 · C3).

  -- 코드 생성 + 삽입 루프. invite_code UNIQUE 충돌 시 재생성(최대 8회).
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_charset, floor(random() * length(v_charset))::int + 1, 1);
    end loop;
    begin
      insert into public.rooms (invite_code, created_by, mode)
        values (v_code, v_uid, p_mode)
        returning id into v_room_id;
      exit;  -- 삽입 성공
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'CODE_GENERATION_FAILED';
      end if;
      -- 재시도
    end;
  end loop;

  -- 본인 멤버십 추가(트리거가 0→1이므로 통과).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id, 'invite_code', v_code, 'mode', p_mode);
end;
$$;

-- 권한 재선언(idempotent, 시그니처 (text) 동일).
revoke all on function public.create_room(text)  from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- =====================================================================
-- 3. join_room(p_code text) — 솔로거부·타방 가드 제거 (replace, plan §3.3)
--    제거: SOLO_ROOM_NOT_JOINABLE(솔로 로그도 조인→커플화) + 타방 ALREADY_IN_ROOM(여러 로그 동시 소속 허용).
--    유지: INVALID_CODE·ROOM_FULL·NOT_AUTHENTICATED·for update 잠금.
--    같은 로그 재조인 멱등은 이제 "로그별 멤버십 PK 존재 검사"로 판정(중복 INSERT/중복 탭 안전).
--    반환: { "room_id": uuid } (불변).
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
  --   ⚠️ 멀티 로그: "이미 이 로그 멤버인가"만 검사(타방 ALREADY_IN_ROOM 제거 — 다른 로그 동시 소속 허용).
  if exists (select 1 from public.room_members where room_id = v_room_id and user_id = v_uid) then
    return jsonb_build_object('room_id', v_room_id);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 1자리 동시 조인 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 앱/RPC 1차 차단(정원 2; 트리거가 최종 방어). 솔로 로그도 조인 허용(SOLO 가드 제거).
  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 2 then
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

-- =====================================================================
-- 4. list_my_rooms() — 내 로그 목록 RPC (신설, SECURITY DEFINER, plan §3.4)
--    반환 행 집합(0행 = 빈 목록 = 정상). 내가 속한 로그 + 정확한 멤버 수.
--    ⚠️ 함정(C-RLS): DEFINER → RLS 우회 → `where rm.user_id = auth.uid()` 필수(누락 시 전체 로그 노출).
--    member_count는 DEFINER로 전 멤버 집계(RLS 우회) → 솔로/커플 파생 가능
--      (room_members RLS=자기 행만이라 클라 직접 select는 항상 count=1 → 집계 불가, RPC 필수).
--    정렬: joined_at desc(최근 합류 로그 상단). created_at도 반환(표시·정렬 보조).
-- =====================================================================
create or replace function public.list_my_rooms()
returns table (
  room_id      uuid,
  mode         text,
  member_count int,
  created_at   timestamptz,
  joined_at    timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id,
         r.mode,
         (select count(*)::int from public.room_members m2 where m2.room_id = r.id) as member_count,
         r.created_at,
         rm.joined_at
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;

-- 권한: 익명 사용자도 Supabase에서 authenticated 역할 → authenticated 에 execute.
revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;

-- =====================================================================
-- 5. leave_room(p_room_id uuid) — 多로그 호환 인자화 (drop + replace, plan §3.4-leave)
--    문제: 기존 leave_room()(무인자)는 `where user_id=v_uid`로 단일 멤버십을 가정 → 多로그에서 모호·깨짐.
--    해결: p_room_id로 대상 로그를 명시. room-leave 스프린트의 안전장치
--          (for update 잠금·본인 행 스코프·count 후 삭제·잔여≥1 보존)는 모두 유지.
--    ⚠️ 무인자 버전은 반드시 drop(오버로드 함정 회피 — create_room 교훈). 시그니처가 다르면 두 오버로드 공존.
--    ⚠️ 이번 슬라이스엔 UI 호출부 없음(Profile 나가기 제거) → 차기 LogScreen 로그별 나가기가 사용(선반영).
-- =====================================================================
drop function if exists public.leave_room();

create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_member    boolean;
  v_remaining int;
  v_deleted   boolean := false;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 해당 로그 멤버 여부(멱등: 멤버 아니면 성공으로 흡수 — 재호출/중복 탭 안전).
  select exists(
    select 1 from public.room_members where room_id = p_room_id and user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('room_deleted', false, 'room_id', null);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 두 멤버 동시 나가기 → 고아 빈 로그 방지, C-CONC).
  perform 1 from public.rooms where id = p_room_id for update;

  -- 본인 행만 삭제(DEFINER RLS 우회 → 스코프 명시 필수, C-RLS).
  delete from public.room_members where room_id = p_room_id and user_id = v_uid;

  -- 잔여 멤버 수 확인.
  select count(*) into v_remaining from public.room_members where room_id = p_room_id;

  -- 잔여 0일 때만 로그 삭제(FK CASCADE로 하위 정리). 잔여 ≥1이면 보존(남은 멤버 손실 0, C-DEL).
  if v_remaining = 0 then
    delete from public.rooms where id = p_room_id;
    v_deleted := true;
  end if;

  return jsonb_build_object('room_deleted', v_deleted, 'room_id', p_room_id);
end;
$$;

-- 권한: authenticated 에 execute(인자 uuid 시그니처).
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;
