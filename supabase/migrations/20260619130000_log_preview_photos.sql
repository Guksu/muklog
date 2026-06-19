-- 20260619130000_log_preview_photos.sql
-- 로그 목록 카드 썸네일 — list_my_rooms()에 preview_paths(로그별 최근 사진 경로 최대 4장) 투영 추가.
--
-- 배경: LogList 카드가 사진 데이터가 없어 빈 점선 슬롯만 표시(stub). 카드엔 로그별 **대표 사진 1장**만 보이고
--   사진이 없으면 미노출(사용자 결정). preview_paths = 그 로그의 대표 사진 storage_path(0개 또는 1개) 배열.
--   클라가 createSignedUrls로 배치 발급해 단일 커버로 렌더. 비공개 버킷이라 경로만 반환(URL은 클라).
-- 정렬: 먹로그 visited_at desc → created_at desc → 사진 order_index asc 중 첫 1장(최근 방문·대표 사진).
--   (배열 형태 유지 — 향후 N장 확장 여지. 현재는 상위 1장만.)
--
-- ⚠️ returns table 컬럼 변경 → drop + recreate(무인자라 오버로드 충돌 없음). DEFINER(멤버면 전 필드 조회).
-- ⚠️ 기존 컬럼/순서·정렬·grant 불변, preview_paths만 말미 추가(소비처 useMyLogs 비파괴).
-- ⚠️ 적용: `supabase db push` 후 라이브 스모크(사진 있는 로그 카드에 썸네일 노출 확인).

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
  preview_paths       text[]
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
         ), '{}'::text[]) as preview_paths
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = auth.uid()
  order by rm.joined_at desc;
$$;

revoke all on function public.list_my_rooms() from public, anon;
grant execute on function public.list_my_rooms() to authenticated;
