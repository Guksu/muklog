-- 20260620120000_home_log_stats.sql
-- home-fidelity 스프린트: 홈 로그 카드 통계행/+N/홈 합계를 위해 list_my_rooms()에
--   집계 2컬럼(spot_count·last_muklog_at)을 말미에 추가.
--
-- 배경: LogList 카드의 "맛집 N곳"·"마지막 기록 N일 전"·사진 스트립 +N·홈 헤더 합계가
--   RPC에 집계가 없어 렌더 불가(거짓 카운트 금지 — 실집계만 사용). 본 마이그레이션이 그 데이터 출처.
--   - spot_count     int          : 해당 room의 muklog(맛집) 총 개수. 맛집 0이면 0.
--   - last_muklog_at timestamptz   : 가장 최근 muklog의 기록 시각(muklogs.created_at MAX). 맛집 0이면 NULL.
--     ("기록 시각" = 레코드 생성 시각 created_at(timestamptz). visited_at은 date라 시간 정보 없음 → 부적합.)
--
-- ⚠️ 적용된 마이그레이션(20260619130000_log_preview_photos.sql)을 직접 수정하지 않고 신규 파일로 교체
--    (메모리 정책 definer-storage-and-best-effort: "적용된 마이그레이션은 신규 파일로 교체").
-- ⚠️ returns table 컬럼 변경 → drop + recreate(무인자라 오버로드 충돌 없음). DEFINER(멤버면 전 멤버 집계, RLS 우회).
-- ⚠️ 기존 컬럼/순서·정렬·preview_paths 서브쿼리·grant 불변, spot_count·last_muklog_at만 말미 추가(소비처 useMyLogs 비파괴).
-- ⚠️ 라이브 적용은 사용자 전담: `supabase db push`(또는 SQL 에디터에서 본 파일 실행) 후 라이브 스모크
--    (맛집 있는 로그 카드에 "맛집 N곳"·"마지막 기록" 노출, 맛집 0 로그는 빈카드 확인).
-- ⚠️ 비용 가드레일 §8: 추가 페치 없음(기존 RPC 1회에 컬럼만 추가). idx_muklogs_room_visited(room_id …)로 집계 효율화.

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
  delete_requested_by uuid,
  preview_paths       text[],
  spot_count          int,
  last_muklog_at      timestamptz
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
         r.delete_requested_by,
         coalesce((
           select array_agg(t.storage_path order by t.rn)
           from (
             select mp.storage_path,
                    row_number() over (
                      order by mk.visited_at desc nulls last, mk.created_at desc, mp.order_index asc
                    ) as rn
             from public.muklog_photos mp
             join public.muklogs mk on mk.id = mp.muklog_id
             where mk.room_id = r.id
           ) t
           where t.rn <= 1
         ), '{}'::text[]) as preview_paths,
         -- 맛집 총 개수(0이면 0). DEFINER라 멤버십 RLS 우회 집계.
         (select count(*)::int from public.muklogs mk2 where mk2.room_id = r.id) as spot_count,
         -- 가장 최근 기록 시각(맛집 0이면 NULL). visited_at(date) 아닌 created_at(timestamptz) 기준.
         (select max(mk3.created_at) from public.muklogs mk3 where mk3.room_id = r.id) as last_muklog_at
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;

revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;
