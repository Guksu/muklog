-- 20260611130000_muklog_list.sql
-- muklog-list 스프린트: 한 로그(방)의 맛집 기록(먹로그) 테이블 신설 + 조회/생성 토대.
-- 산출: public.muklogs 테이블(전체 컬럼 선반영, lat/lng nullable·area 추가) + RLS(방 멤버 select/insert)
--       + 인덱스(room_id, visited_at desc, created_at desc) + enforce_muklog_fields 트리거(값 범위 최종 방어) + grant.
-- 설계 출처: docs/sprint/sprint-20260611-muklog-list/plan.md §5.1, docs/design/architecture.md §3(§15 divergence 승인).
--
-- ⚠️ 기존 마이그레이션(invite_room/room_modes/room_leave/multi_log_home/log_invite)은 수정하지 않는다.
--    이 파일은 additive(신규 테이블/정책/트리거만 추가).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create table if not exists / drop policy if exists / create or replace / drop trigger if exists.
--
-- ┌───────────────────────── 보안 핵심 (RLS) ─────────────────────────┐
-- │ muklogs 는 RLS 하 클라 직접 select/insert(RPC 아님, D3). select=`room_id IN 내 방`,            │
-- │ insert=`with check (created_by=auth.uid() and room_id IN 내 방)`. 이로써                       │
-- │  · 타방 먹로그 read/insert 차단(AC7)  · created_by 위조(타인 명의) 차단(AC8).                   │
-- │ room_members RLS=자기 행만이라 파트너 프로필 read 불가 → 작성자 라벨만 클라가 파생(파트너 닉네임 OUT).│
-- └──────────────────────────────────────────────────────────────────────┘
-- OUT(이번 미생성): muklog_photos(사진·Storage), 영상 컬럼은 nullable 선반영만(UI 없음), Kakao 좌표/주소(좌표 nullable).

-- gen_random_uuid() 보장(이미 invite_room에서 생성됐으나 명시).
create extension if not exists pgcrypto;

-- =====================================================================
-- 1. 테이블 (plan §5.1 / architecture §3, 전체 컬럼 선반영)
--    lat/lng = nullable(D2 승인): 수동입력 시 NULL, Kakao(muklog-editor)에서 채움. 지도는 lat is not null만 핀.
--    area    = nullable(D4 승인): 카드 표시·수동 입력 편의용 동네 필드.
-- =====================================================================
create table if not exists public.muklogs (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms(id) on delete cascade,
  place_name        text not null,
  kakao_place_id    text,                 -- editor(차기)
  category          text,                 -- 앱이 8종 enum 강제(DB는 자유 text)
  area              text,                 -- D4 표시용(동네)
  address           text,                 -- editor
  road_address      text,                 -- editor
  lat               double precision,     -- D2 nullable (editor 좌표)
  lng               double precision,     -- D2 nullable (editor 좌표)
  memo              text,
  rating            smallint,             -- 1~5(트리거 검증), NULL=미평가
  visited_at        date,                 -- 기본 today(앱), NULL 허용
  video_path        text,                 -- video(차기) nullable 선반영
  video_duration_ms integer,              -- video(차기) nullable 선반영
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =====================================================================
-- 2. RLS (plan §5.1 / architecture §3)
--    select : 내 방 먹로그만 (room_id IN 내 방)
--    insert : 내 방에만 + 작성자=나 (created_by=auth.uid())
--    update/delete : 정책 없음 → 직접 수정/삭제 거부(수정/삭제 OUT, 차기 슬라이스).
-- =====================================================================
alter table public.muklogs enable row level security;

drop policy if exists "muklogs_select_member" on public.muklogs;
create policy "muklogs_select_member" on public.muklogs
  for select using (
    room_id in (select room_id from public.room_members where user_id = auth.uid())
  );

drop policy if exists "muklogs_insert_member" on public.muklogs;
create policy "muklogs_insert_member" on public.muklogs
  for insert with check (
    created_by = auth.uid()
    and room_id in (select room_id from public.room_members where user_id = auth.uid())
  );
-- muklogs update/delete : 정책 없음 → 직접 쓰기 거부(차기 muklog-editor/삭제 슬라이스에서 도입).

-- =====================================================================
-- 3. 인덱스 (plan §5.1) — 방별 최신순 조회 효율화(풀스캔 회피, 비용 가드레일 §10).
--    쿼리 정렬(visited_at desc, created_at desc)과 컬럼 순서 일치.
-- =====================================================================
create index if not exists idx_muklogs_room_visited
  on public.muklogs (room_id, visited_at desc, created_at desc);

-- =====================================================================
-- 4. 값 범위 검증 트리거 (plan §5.1) — 앱 1차 검증 + DB 최종 방어.
--    ⚠️ raise 토큰은 SQL ↔ 앱(features/muklog/errors.ts·validate.ts)이 단일 출처여야 한다(동기화 유지).
--    ⚠️ created_by/room_id 위변조는 RLS with check가 막는다(트리거는 값 범위만).
-- =====================================================================
create or replace function public.enforce_muklog_fields()
returns trigger
language plpgsql
as $$
begin
  if new.place_name is null or length(btrim(new.place_name)) = 0 then
    raise exception 'PLACE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if new.rating is not null and (new.rating < 1 or new.rating > 5) then
    raise exception 'RATING_OUT_OF_RANGE' using errcode = 'P0001';
  end if;
  -- 미래 방문일 차단(오늘까지 허용). NULL 허용.
  if new.visited_at is not null and new.visited_at > current_date then
    raise exception 'VISITED_AT_IN_FUTURE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_muklog_fields on public.muklogs;
create trigger trg_muklog_fields
  before insert or update on public.muklogs
  for each row execute function public.enforce_muklog_fields();

-- =====================================================================
-- 5. 권한 (plan §5.1) — RLS 하 직접 접근(RPC 아님). 행 제한은 RLS가 담당.
-- =====================================================================
grant select, insert on public.muklogs to authenticated;
