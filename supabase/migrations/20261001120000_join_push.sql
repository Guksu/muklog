-- 20261001120000_join_push.sql
-- join-push 스프린트(U74 합류 알림 · U75 푸시 문구): 초대코드로 누군가 로그에 들어오면 그 로그의 기존 멤버에게
--   "들어왔어요" 알림을 **한 번만** 보내기 위한 서버 장치 + 발송 RPC 권한 하드닝.
--
-- 산출:
--   ① public.room_members.join_push_claimed_at timestamptz — 합류 알림 발송권을 쓴 시각(NULL = 아직 안 씀).
--      컬럼을 처음 만들 때만 기존 행을 joined_at 으로 백필(기존 멤버십은 소급 발송 0).
--   ② room_members 테이블 UPDATE 권한 회수(anon·authenticated) — RLS UPDATE 정책 0 과 이중 차단(클라이언트 쓰기 0).
--   ③ public.claim_join_push(p_room_id, p_user_id) returns boolean — SECURITY INVOKER · service_role 전용.
--      조건 확인과 기록이 한 문장(원자적 UPDATE): 내 멤버 행 · 아직 NULL · 합류 10분 안 · 생성자 아님 → 처음 채운 호출만 true.
--   ④ public.list_room_push_targets(uuid, uuid) 실행 권한 하드닝 — 기본 실행 권한(public·anon·authenticated) 회수,
--      service_role 에만 부여. (push_send.sql 은 "GRANT 안 함"이라고만 적었고 Postgres·Supabase 기본 실행 권한을
--      회수하지 않아, 같은 로그 멤버가 앱 키로 직접 불러 상대의 Expo 토큰을 꺼낼 수 있었다.)
-- 설계 출처: _workspace/sprint-20261001-join-push/plan.md §4 D2·D3 · §5.1, docs/design/architecture.md §3.
--
-- ┌──────────────────────────── 보안 핵심 ─────────────────────────────┐
-- │ · claim_join_push 는 INVOKER — service_role(Edge Function)로 부를 때만 RLS 를 건너뛰어 갱신된다.        │
-- │   실행 권한이 실수로 열려도 authenticated 는 room_members UPDATE 권한이 없고(②) RLS UPDATE 정책도 없어  │
-- │   갱신하지 못한다(권한 오류).                                                                          │
-- │ · p_user_id 에는 Edge Function 이 JWT 로 확인한 callerId 만 넣는다(send-join-push/handler.ts).            │
-- │ · 동시 호출: 같은 (로그, 사람)에 두 UPDATE 가 겹치면 첫 UPDATE 가 행을 잠그고 채운다. 두 번째는 기다렸다가   │
-- │   갱신된 행으로 조건을 다시 평가해(is null 거짓) 0행 → 정확히 한 호출만 true.                            │
-- │ · VOLATILE(기본값) 유지 — STABLE·IMMUTABLE 로 선언하면 PostgREST 가 읽기 전용 트랜잭션으로 실행해 UPDATE 실패. │
-- └────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ 기존 마이그레이션은 수정하지 않는다(additive). 라이브 적용은 사용자: `supabase db push`
--    (또는 SQL 편집기에서 이 파일 실행). 적용 직후 스모크(plan §8.5 SM1·SM2)로 확인한다.
-- ⚠️ 재실행 안전: 컬럼·백필은 DO 블록에서 컬럼 존재를 확인해 처음 한 번만, 함수는 create or replace,
--    권한 revoke/grant 는 반복해도 같은 결과.

-- =====================================================================
-- 1) 컬럼 + 백필 — 컬럼을 처음 만들 때만 기존 행을 채운다(재실행 때 그 사이 생긴 새 합류의 NULL 을 덮지 않는다).
-- =====================================================================
do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'room_members'
       and column_name = 'join_push_claimed_at'
  ) then
    alter table public.room_members add column join_push_claimed_at timestamptz;
    -- 기존 멤버십은 모두 "이미 처리됨" — 소급 발송 0.
    update public.room_members set join_push_claimed_at = joined_at;
  end if;
end;
$$;

comment on column public.room_members.join_push_claimed_at is
  '합류 알림 발송권을 쓴 시각(NULL = 아직 안 씀). service_role 의 claim_join_push 만 채운다.';

-- =====================================================================
-- 2) 클라이언트 쓰기 이중 차단(RLS UPDATE 정책 0 + 테이블 UPDATE 권한 회수).
--    앱·DEFINER 함수 어디에서도 authenticated 로 room_members 를 UPDATE 하거나 select … for update 하지 않는다
--    (DEFINER 함수는 소유자 권한이라 영향 없음).
-- =====================================================================
revoke update on table public.room_members from anon, authenticated;

-- =====================================================================
-- 3) claim_join_push — 합류 알림 발송권을 한 번만 기록한다(조건 확인과 기록이 한 문장).
--    true  = 이 호출이 처음 채웠다(발송해도 된다).
--    false = 멤버 아님 · 이미 씀 · 합류 10분 지남 · 생성자.
--    10분 창: 구 앱(1.3.0)으로 들어와 호출이 없었거나 호출이 실패해 NULL 로 남은 행에, 며칠 뒤 같은 코드 재입력(멱등 성공)으로
--             늦은 "들어왔어요"가 가는 것을 막는다. 앱은 입장 직후 바로 부른다.
--    생성자 제외: create_room 이 넣은 생성자 행의 joined_at 도 생성 시각이라 합류로 치지 않는다.
--                 탈퇴로 created_by 가 NULL 이어도 is distinct from 이라 합류자는 정상 대상이다.
-- =====================================================================
create or replace function public.claim_join_push(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with claimed as (
    update public.room_members rm
       set join_push_claimed_at = now()
     where rm.room_id = p_room_id
       and rm.user_id = p_user_id
       and rm.join_push_claimed_at is null
       and rm.joined_at > now() - interval '10 minutes'
       and exists (
         select 1
           from public.rooms r
          where r.id = rm.room_id
            and r.created_by is distinct from rm.user_id
       )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_join_push(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_join_push(uuid, uuid) to service_role;

-- =====================================================================
-- 4) list_room_push_targets 하드닝 — 기본 실행 권한(public·anon·authenticated) 회수, Edge(service_role)만.
--    앱 코드는 이 함수를 부르지 않는다(발송은 Edge Function 만) → 앱 영향 0. 구 send-muklog-push 도 service_role 이라 그대로 동작.
-- =====================================================================
revoke all on function public.list_room_push_targets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_room_push_targets(uuid, uuid) to service_role;
