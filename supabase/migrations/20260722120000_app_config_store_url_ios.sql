-- 20260722120000_app_config_store_url_ios.sql
-- app-version-gate 후속(app-update-actions): iOS 출시(2026-07)에 맞춰 store_url_ios 실값 반영.
--   선행 시드(20260702120000)는 store_url_ios=null(미출시)이라 권유 모달이 스토어로 못 감 → 실 URL로 채운다.
--   행은 선행 시드로 이미 존재(id=1) → UPSERT의 do-update 경로만 탐(min/latest/android 보존).
--   Android는 미출시 → store_url_android는 건드리지 않는다(null 유지, 출시 시 별도 UPDATE).
insert into public.app_config (id, store_url_ios, updated_at)
values (1, 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594', now())
on conflict (id) do update
  set store_url_ios = excluded.store_url_ios,
      updated_at = now();
