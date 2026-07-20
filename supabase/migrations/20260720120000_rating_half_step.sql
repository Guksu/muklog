-- 20260720120000_rating_half_step.sql
-- half-star-rating 스프린트: 별점 0.5 단위 지원 — muklogs.rating을 smallint → numeric(2,1)로 넓히고
--   트리거·핀 RPC 반환 타입을 0.5 단위 수용형으로 정합. 설계 출처: docs/sprint/sprint-20260720-half-star-rating/plan.md §1·§2.
--
-- 배경: rating이 smallint라 정수만 저장 가능 → 사용자 요청("각각 0.5점도 설정 가능하게").
--   허용값 {1.0, 1.5, …, 5.0} 또는 NULL(미평가). 검증 규칙: 1 ≤ rating ≤ 5 AND rating×2가 정수(0.5 단위).
--   위반 토큰은 기존 RATING_OUT_OF_RANGE 재사용(SQL↔앱 토큰 단일 출처 — errors.ts). 신규 토큰 없음.
--
-- ⚠️ 기존 마이그레이션은 수정하지 않는다(이미 적용된 환경 고려). 이 파일은 additive.
--   - muklogs.rating: smallint→numeric(2,1) 캐스트는 무손실(기존 정수 1~5 그대로 보존).
--   - enforce_muklog_fields: create or replace(본문만 교체, 트리거 trg_muklog_fields는 함수명 참조라 불변).
--     최신본(20260619120000_muklog_visited_future_tz.sql)의 visited_at `current_date + 1` 유예 로직 그대로 보존.
--   - list_my_muklog_pins(): 반환 table의 rating 타입 변경(smallint→numeric(2,1)) → drop + recreate 필요
--     (returns 시그니처 변경은 create or replace 불가). security definer·set search_path=public·
--     revoke(public,anon)·grant(authenticated) 원본(20260614140000_map_tab_pins.sql)과 동일 유지.
-- ⚠️ 라이브 적용은 사용자 전담: `supabase db push`(또는 SQL 에디터에서 본 파일 실행) 후 라이브 스모크
--    (별점 4.5 저장 통과·4.3 거부, 지도 핀 rating 표시 확인).

-- =====================================================================
-- 1) rating 컬럼 타입 확장 — smallint → numeric(2,1) (0.5 단위 수용). 기존 정수 값 무손실 캐스트.
-- =====================================================================
alter table public.muklogs
  alter column rating type numeric(2,1);

-- =====================================================================
-- 2) enforce_muklog_fields — rating 0.5 단위 체크 추가(범위 1~5 유지). visited_at 유예 로직 보존.
--   0.5 단위 위반: new.rating * 2 <> trunc(new.rating * 2) → RATING_OUT_OF_RANGE(범위 위반과 동일 토큰).
-- =====================================================================
create or replace function public.enforce_muklog_fields()
returns trigger
language plpgsql
as $$
begin
  if new.place_name is null or length(btrim(new.place_name)) = 0 then
    raise exception 'PLACE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  -- rating: 1~5 범위 + 0.5 단위(rating×2가 정수). NULL=미평가는 통과.
  if new.rating is not null
     and (new.rating < 1 or new.rating > 5 or new.rating * 2 <> trunc(new.rating * 2)) then
    raise exception 'RATING_OUT_OF_RANGE' using errcode = 'P0001';
  end if;
  -- 미래 방문일 차단 — UTC current_date + 1일 유예(타임존 false-positive 방지). 정밀 검증은 클라(로컬 today).
  if new.visited_at is not null and new.visited_at > current_date + 1 then
    raise exception 'VISITED_AT_IN_FUTURE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 3) list_my_muklog_pins() — 반환 rating 타입 smallint→numeric(2,1). drop 후 재생성(시그니처 변경).
--   본문·권한·격리(rm.user_id = auth.uid())·좌표 null 필터는 원본과 동일.
-- =====================================================================
drop function if exists public.list_my_muklog_pins();

create or replace function public.list_my_muklog_pins()
returns table (
  muklog_id  uuid,
  room_id    uuid,
  place_name text,
  category   text,
  area       text,
  rating     numeric(2,1),
  lat        double precision,
  lng        double precision
)
language sql
security definer
set search_path = public
as $$
  select m.id,
         m.room_id,
         m.place_name,
         m.category,
         m.area,
         m.rating,
         m.lat,
         m.lng
  from public.muklogs m
  join public.room_members rm on rm.room_id = m.room_id
  where rm.user_id = auth.uid()
    and m.lat is not null
    and m.lng is not null;
$$;

-- 권한: 익명 사용자도 Supabase에서 authenticated 역할 → authenticated 에 execute.
revoke all on function public.list_my_muklog_pins() from public, anon;
grant execute on function public.list_my_muklog_pins() to authenticated;
