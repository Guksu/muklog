-- 20260614140000_map_tab_pins.sql
-- map-tab 슬라이스 1: 내 모든 로그의 좌표 있는 먹로그 핀 통합 조회 RPC 신설.
-- 산출: list_my_muklog_pins() — 내가 멤버인 모든 로그의 muklogs 중 lat/lng NOT NULL 행만 투영 반환.
-- 설계 출처: docs/sprint/sprint-20260614-map-tab/plan.md §3.2, docs/design/architecture.md §3·§5.
--
-- ⚠️ 기존 마이그레이션은 수정하지 않는다(이미 적용된 환경 고려). 이 파일은 additive(신규 RPC + 권한).
-- ⚠️ 실 Supabase 적용은 사용자 환경 의존: `supabase db push` 또는 SQL 에디터에서 본 파일 실행.
-- ⚠️ 재실행 가능(idempotent): create or replace + 권한 재선언.
-- ⚠️ 컬럼/테이블 변경 없음 — 기존 muklogs(lat/lng double precision nullable, muklog-place에서 채움) 사용.

-- =====================================================================
-- list_my_muklog_pins() — 내 모든 로그의 좌표 있는 먹로그 핀 (신설, SECURITY DEFINER, plan §3.2)
--   반환 행 집합(0행 = 빈 핀 = 정상). 좌표 있는 행만(lat is not null and lng is not null).
--
--   DEFINER 선택 근거(plan §3.2 재량, 기존 list_my_rooms 패턴 계승):
--     - muklogs select RLS(`room_id IN 내 방`)로 INVOKER도 가능하나, list_my_rooms와 동일하게
--       DEFINER로 두어 (a) 조회 정책(좌표 null 필터·크로스-로그 통합)을 서버에 못 박고,
--       (b) 필요 컬럼만 투영해 전송량을 줄이며, (c) 슬라이스 2에서 viewport bbox 인자 추가 자리를 마련한다.
--   ⚠️ 함정(C-RLS): DEFINER → RLS 우회 → `where rm.user_id = auth.uid()`로 본인 멤버십 스코프 필수
--      (누락 시 전 로그 핀 노출). room_members 조인으로 내가 속한 로그만 격리한다.
--   투영: 카드용 최소 컬럼만(muklog_id/room_id/place_name/category/area/rating/lat/lng).
--     대표 사진/커버는 싣지 않는다(plan §3.2 — signed URL N장 배치 발급 회피, 비용 §8).
--   정렬: 미지정(지도 핀은 순서 무관). 슬라이스 1은 ORDER BY 생략(불필요 연산 회피).
-- =====================================================================
create or replace function public.list_my_muklog_pins()
returns table (
  muklog_id  uuid,
  room_id    uuid,
  place_name text,
  category   text,
  area       text,
  rating     smallint,
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
