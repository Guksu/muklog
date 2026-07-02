-- 20260702120000_app_config.sql
-- 앱 버전 게이트용 원격 설정 싱글턴 테이블 (app-version-gate plan §3.1).
--   min/latest/store URL은 비민감 공개 설정 → anon+authenticated 읽기 허용(로그인 전 게이트 판정 필요, §4.1).
--   insert/update/delete 정책 부재 → 앱은 읽기 전용, 값 변경은 운영자(service role/SQL 에디터)만.
--   시드는 dormant(전원 미차단·미권유) — 운영자가 출시 후 값을 올릴 때만 게이트 활성.

create table if not exists public.app_config (
  id                     int primary key default 1 check (id = 1),   -- 싱글턴(1행 보장)
  min_supported_version  text,        -- semver "x.y.z"(nullable → fail-open)
  latest_version         text,        -- semver "x.y.z"(nullable → suggest 미발화)
  store_url_ios          text,        -- 미출시=null(버튼 숨김)
  store_url_android      text,        -- 미출시=null
  updated_at             timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- 공개 비민감 설정 → 읽기는 anon+authenticated 모두 허용(로그인 전 게이트 필요, §4.1).
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
-- insert/update/delete 정책 없음 → 운영자(service role/SQL 에디터)만 변경. 앱은 읽기 전용.

-- 시드: 게이트 dormant 기본값(전원 미차단·미권유). 운영자가 출시 후 값 갱신.
--   min=0.0.0(아무도 미달 불가 → 전원 미차단), latest=1.0.0(현재와 동일 → 권유 미발화), URL null(미출시).
insert into public.app_config (id, min_supported_version, latest_version)
  values (1, '0.0.0', '1.0.0')
  on conflict (id) do nothing;
