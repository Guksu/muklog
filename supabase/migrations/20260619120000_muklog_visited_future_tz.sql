-- 20260619120000_muklog_visited_future_tz.sql
-- 방문일 미래 검증 타임존 보정 — enforce_muklog_fields 트리거 함수 교체(create or replace, body만).
--
-- 문제(라이브): KST 오전(예: 06-19 08:54)엔 UTC가 아직 06-18이라 Supabase `current_date`(UTC) = 06-18.
--   기존 트리거 `new.visited_at > current_date`는 로컬 오늘(06-19)을 미래로 판정 → VISITED_AT_IN_FUTURE
--   ("방문일은 오늘까지만 선택할 수 있어요")로 정당한 오늘 방문 기록 저장을 막음.
-- 원인: 서버 트리거가 UTC 기준 current_date로 비교 — 클라이언트 로컬 today와 최대 1일 어긋남(UTC+14까지).
-- 수정: `current_date + 1`까지 허용(타임존 유예 1일). 최대 시차(UTC+14)에서도 로컬-오늘은 거부 안 되고,
--   명백한 미래(서버 기준 2일 이상 앞)는 여전히 차단. 정밀 로컬 검증은 클라 validate.ts(todayLocalDate)가 담당.
--
-- additive·idempotent: create or replace 로 함수 본문만 교체(트리거 trg_muklog_fields는 함수명 참조라 불변).
-- ⚠️ 적용: `supabase db push` 또는 SQL 에디터 실행 후 라이브 스모크(KST 오전 오늘 저장 확인).

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
  -- 미래 방문일 차단 — UTC current_date + 1일 유예(타임존 false-positive 방지). 정밀 검증은 클라(로컬 today).
  if new.visited_at is not null and new.visited_at > current_date + 1 then
    raise exception 'VISITED_AT_IN_FUTURE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
