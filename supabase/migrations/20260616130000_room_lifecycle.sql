-- 20260616130000_room_lifecycle.sql
-- room-lifecycle 스프린트: 예약 삭제 라이프사이클(#5 나가기 24h 유예/취소) + 예약 경과 cron + Storage 정리.
-- 산출: ① 부분 인덱스(예약 행만) ② leave_room(p_room_id) 유예 모델 교체(커플=예약/솔로=즉시)
--       ③ cancel_room_deletion(p_room_id) 신설(요청자만) ④ delete_expired_rooms() + pg_cron 매시 잡 + Storage 메타 정리
--       ⑤ list_my_rooms()/get_room() 에 delete_scheduled_at·delete_requested_by 투영 추가
--       ⑥ _delete_room_cascade(p_room_id) 공통 헬퍼(Storage 메타 선정리 + 방 행 삭제 → FK CASCADE).
-- 설계 출처: docs/sprint/sprint-20260616-room-lifecycle/plan.md §3, docs/design/architecture.md §1·§3·§5·§7.
--
-- ⚠️ #2 커플방 24h 미입장 자동삭제는 폐기(plan §0, 사용자 결정). cron은 #5 예약 경과(delete_scheduled_at <= now())만 삭제.
--    예약 없는 솔로/일반 로그는 24h가 지나도 절대 삭제하지 않는다(영구). 회귀 가드.
-- ⚠️ 기존 마이그레이션(invite_room/room_modes/room_leave/multi_log_home/log_invite/log_name 등)은 수정하지 않는다.
--    이 파일은 additive(인덱스·함수 본문 교체·신규). 재실행 가능(idempotent):
--      create index if not exists / create or replace / cron 잡 unschedule-후-schedule / 권한 재선언.
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ delete_scheduled_at·delete_requested_by 컬럼은 선반영됨(architecture 라인 62-64). 이 파일은 DDL 추가 없음(컬럼은 가정).
--
-- 비용 가드레일(plan §8): pg_cron in-DB → 외부 호출·Edge Function invocation 0. Storage 정리도 SQL 메타 DELETE(외부 API 0).
--   cron 매시 run당 부분 인덱스 스캔(예약 행만) + 소수 DELETE → 부하 무시 가능.

-- =====================================================================
-- 1. 부분 인덱스 — cron 스캔 비용 최소화 (plan §3.1)
--    예약된(delete_scheduled_at is not null) 행만 인덱싱 → delete_expired_rooms()의 WHERE 스캔이 부분 인덱스만 본다.
-- =====================================================================
create index if not exists idx_rooms_delete_scheduled
  on public.rooms (delete_scheduled_at)
  where delete_scheduled_at is not null;

-- =====================================================================
-- 2. _delete_room_cascade(p_room_id uuid) — Storage 메타 선정리 + 방 삭제 공통 헬퍼 (신설, plan §3.5·§3.2)
--    버킷 첫 세그먼트=room_id 규약(photoPath.ts: {room_id}/{muklog_id}/{uuid}.jpg).
--    방 행 DELETE 전에 storage.objects 메타를 선정리 → DB CASCADE(muklogs/muklog_photos/wishlist_items/room_members)
--    로는 정리되지 않는 Storage 고아 메타 방지(D5). 외부 S3 GC는 환경 의존 → 라이브 스모크 확인 항목.
--    ⚠️ 내부 전용(클라 호출 불가). leave_room(솔로)·delete_expired_rooms 가 DEFINER 컨텍스트에서 호출.
-- =====================================================================
create or replace function public._delete_room_cascade(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  -- Storage 메타 선정리(D5): muklog-photos 버킷의 {room_id}/% 프리픽스 객체 메타행 삭제.
  delete from storage.objects
    where bucket_id = 'muklog-photos' and name like p_room_id::text || '/%';
  -- 방 삭제 → muklogs/muklog_photos/wishlist_items/room_members FK ON DELETE CASCADE 로 하위 정리.
  delete from public.rooms where id = p_room_id;
end;
$$;

-- 내부 전용: 클라/익명 모두 호출 불가(DEFINER 컨텍스트의 다른 함수만 호출).
revoke all on function public._delete_room_cascade(uuid) from public, anon, authenticated;

-- =====================================================================
-- 3. leave_room(p_room_id uuid) — 유예 모델 교체 (replace, plan §3.2, C-LEAVE)
--    반환 jsonb: { scheduled, room_deleted, delete_scheduled_at, room_id }.
--    커플(멤버 2명): 전체 로그 24h 삭제 예약(멤버십·방 보존). 이미 예약됨 → 멱등 no-op(요청자 보존).
--    솔로(멤버 1명): 본인 멤버십 삭제 → 잔여 0 → 즉시 방+하위+Storage 삭제(기존 즉시판 유지).
--    멤버 아님: 멱등 성공(모두 false/null).
--
--    안전장치(room-leave 교훈 유지):
--      for update 행 잠금(동시 나가기 직렬화, C-CONC) / 본인 행만 삭제(DEFINER RLS 우회 → 스코프 명시, C-RLS).
--    ⚠️ 시그니처(uuid) 동일 → create or replace 로 본문만 교체(오버로드 미발생).
-- =====================================================================
create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_member       boolean;
  v_member_count int;
  v_remaining    int;
  v_existing     timestamptz;
  v_scheduled_at timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 멤버 여부(멱등: 멤버 아니면 성공으로 흡수 — 재호출/중복 탭/이미 삭제된 방 안전).
  select exists(
    select 1 from public.room_members where room_id = p_room_id and user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object(
      'scheduled', false, 'room_deleted', false, 'delete_scheduled_at', null, 'room_id', null
    );
  end if;

  -- 동시성 직렬화: 방 행 잠금(커플 동시 나가기·예약↔취소·예약↔cron 경합 직렬화, C-CONC).
  perform 1 from public.rooms where id = p_room_id for update;

  -- 현재 멤버 수(잠금 후 집계 — 본인 포함).
  select count(*) into v_member_count from public.room_members where room_id = p_room_id;

  if v_member_count >= 2 then
    -- 커플: 전체 로그 24h 삭제 예약. 멤버십·방 보존(상대 기록도 함께 예약 대상).
    select delete_scheduled_at into v_existing from public.rooms where id = p_room_id;

    if v_existing is not null then
      -- 이미 예약됨 → 멱등 no-op(요청자/시각 덮어쓰지 않음 — 동시 나가기 요청자 탈취 방지, plan §6).
      return jsonb_build_object(
        'scheduled', true, 'room_deleted', false,
        'delete_scheduled_at', v_existing, 'room_id', p_room_id
      );
    end if;

    update public.rooms
       set delete_scheduled_at = now() + interval '24 hours',
           delete_requested_by = v_uid
     where id = p_room_id
     returning delete_scheduled_at into v_scheduled_at;

    return jsonb_build_object(
      'scheduled', true, 'room_deleted', false,
      'delete_scheduled_at', v_scheduled_at, 'room_id', p_room_id
    );
  end if;

  -- 솔로(멤버 1명): 본인 멤버십 삭제(DEFINER RLS 우회 → 스코프 명시, C-RLS).
  delete from public.room_members where room_id = p_room_id and user_id = v_uid;

  -- 잔여 0 확인 후에만 방 삭제(즉시판 + Storage 정리). 솔로는 항상 0이 되지만 방어적으로 확인.
  select count(*) into v_remaining from public.room_members where room_id = p_room_id;

  if v_remaining = 0 then
    perform public._delete_room_cascade(p_room_id);
    return jsonb_build_object(
      'scheduled', false, 'room_deleted', true, 'delete_scheduled_at', null, 'room_id', p_room_id
    );
  end if;

  -- (이론상 도달 안 함: member_count=1에서 본인 삭제 후 잔여 0) — 방어적 반환.
  return jsonb_build_object(
    'scheduled', false, 'room_deleted', false, 'delete_scheduled_at', null, 'room_id', p_room_id
  );
end;
$$;

-- 권한: 익명도 Supabase에서 authenticated 역할 → authenticated 에 execute. anon/public 차단.
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;

-- =====================================================================
-- 4. cancel_room_deletion(p_room_id uuid) — 삭제 예약 취소 (신설, plan §3.3, C2)
--    반환 jsonb: { canceled, room_id }. 요청자(delete_requested_by == auth.uid())만 두 필드 NULL 복원.
--    에러: NOT_AUTHENTICATED / NOT_SCHEDULED(방 없음·예약 없음) / NOT_DELETION_REQUESTER(타인·상대).
--    ⚠️ SQL raise 토큰 ↔ src/features/room/errors.ts ROOM_ERROR_MESSAGES 단일 출처 동기화.
-- =====================================================================
create or replace function public.cancel_room_deletion(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_scheduled timestamptz;
  v_requester uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 행 잠금 조회(취소↔cron 경합 직렬화). 방 없음(이미 삭제) → NOT_SCHEDULED(멱등 처리, UI는 목록 복귀).
  select delete_scheduled_at, delete_requested_by
    into v_scheduled, v_requester
    from public.rooms
   where id = p_room_id
   for update;

  if not found then
    raise exception 'NOT_SCHEDULED';
  end if;

  -- 예약 없음 → 취소할 것 없음.
  if v_scheduled is null then
    raise exception 'NOT_SCHEDULED';
  end if;

  -- 요청자만 취소 가능(타인·상대 거부). UI는 상대에게 취소 버튼 미노출(이중 방어).
  if v_requester is distinct from v_uid then
    raise exception 'NOT_DELETION_REQUESTER';
  end if;

  update public.rooms
     set delete_scheduled_at = null, delete_requested_by = null
   where id = p_room_id;

  return jsonb_build_object('canceled', true, 'room_id', p_room_id);
end;
$$;

-- 권한: authenticated 에 execute. anon/public 차단.
revoke all on function public.cancel_room_deletion(uuid) from public, anon;
grant execute on function public.cancel_room_deletion(uuid) to authenticated;

-- =====================================================================
-- 5. delete_expired_rooms() — 예약 경과 로그 확정 삭제 (신설, cron 전용, plan §3.4)
--    #5 예약 경과(delete_scheduled_at <= now())만 삭제. #2 자동삭제 predicate 없음(폐기 §0).
--    예약 없는(delete_scheduled_at is null) 솔로/일반 로그는 절대 건드리지 않음(영구 보호, 회귀 가드).
--    삭제는 공통 헬퍼(_delete_room_cascade)로 Storage 메타 선정리 + 방+하위 CASCADE.
--    ⚠️ cron(슈퍼유저 컨텍스트)에서만 실행 → authenticated grant 없음(클라 호출 불가).
-- =====================================================================
create or replace function public.delete_expired_rooms()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  r record;
begin
  for r in
    select id from public.rooms
    where delete_scheduled_at is not null and delete_scheduled_at <= now()
  loop
    perform public._delete_room_cascade(r.id);
  end loop;
end;
$$;

-- 내부/cron 전용: 클라·익명·로그인 사용자 모두 호출 불가.
revoke all on function public.delete_expired_rooms() from public, anon, authenticated;

-- pg_cron 매시 잡 등록(멱등·재실행 안전): 동일 jobname 있으면 unschedule 후 재등록.
--   ⚠️ pg_cron 확장 활성 가정(plan D1: Dashboard→Database→Extensions 또는 create extension). cron 잡은 postgres DB에서 실행.
--   확장 미활성 환경에서 본 블록은 실패할 수 있음 → 확장 활성 후 본 파일 재실행(idempotent).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-expired-rooms') then
    perform cron.unschedule('delete-expired-rooms');
  end if;
  perform cron.schedule('delete-expired-rooms', '0 * * * *', $cron$select public.delete_expired_rooms();$cron$);
end;
$$;

-- =====================================================================
-- 6. list_my_rooms() — returns table 에 delete_scheduled_at·delete_requested_by 투영 추가 (drop + recreate, plan §3.5)
--    ⚠️ returns table 컬럼 구성 변경 → create or replace 불가 → drop 후 재생성(무인자 시그니처라 오버로드 충돌 없음).
--    신 반환: 기존 6컬럼(room_id, mode, member_count, created_at, joined_at, name) + delete_scheduled_at, delete_requested_by.
--    DEFINER 라 멤버면 전 필드 조회 가능. 클라는 delete_requested_by == meId 로 취소권 판정.
-- =====================================================================
drop function if exists public.list_my_rooms();

create or replace function public.list_my_rooms()
returns table (
  room_id             uuid,
  mode                text,
  member_count        int,
  created_at          timestamptz,
  joined_at           timestamptz,
  name                text,
  delete_scheduled_at timestamptz,
  delete_requested_by uuid
)
language sql
security definer
set search_path = public
as $$
  select r.id,
         r.mode,
         (select count(*)::int from public.room_members m2 where m2.room_id = r.id) as member_count,
         r.created_at,
         rm.joined_at,
         r.name,
         r.delete_scheduled_at,
         r.delete_requested_by
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;

revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;

-- =====================================================================
-- 7. get_room(p_room_id uuid) — jsonb 에 delete_scheduled_at·delete_requested_by 키 추가 (create or replace, plan §3.5)
--    jsonb 반환이라 시그니처 불변 → 본문만 교체. 키 추가는 기존 소비자(useRoom)에 비파괴(없으면 null 흡수).
--    신 반환: { room_id, invite_code, member_count, mode, name, delete_scheduled_at, delete_requested_by }.
--    보안(멤버십 검사·ROOM_NOT_FOUND)·member_count 집계 로직은 log_name 버전과 동일(불변).
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
  v_name         text;
  v_scheduled    timestamptz;
  v_requester    uuid;
  v_member_count int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 로그 존재 확인(DEFINER → RLS 우회). 없으면 ROOM_NOT_FOUND.
  select r.invite_code, r.mode, r.name, r.delete_scheduled_at, r.delete_requested_by
    into v_invite_code, v_mode, v_name, v_scheduled, v_requester
    from public.rooms r
   where r.id = p_room_id;

  if v_invite_code is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- ⚠️ 보안 핵심(C4-RLS): 호출자가 이 로그의 멤버인지 명시 검사.
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = v_uid
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 정확한 멤버 수(DEFINER 전 멤버 집계 — 솔로/커플 파생).
  select count(*)::int into v_member_count
    from public.room_members m
   where m.room_id = p_room_id;

  return jsonb_build_object(
    'room_id', p_room_id,
    'invite_code', v_invite_code,
    'member_count', v_member_count,
    'mode', v_mode,
    'name', v_name,
    'delete_scheduled_at', v_scheduled,
    'delete_requested_by', v_requester
  );
end;
$$;

revoke all on function public.get_room(uuid) from public, anon;
grant execute on function public.get_room(uuid) to authenticated;
