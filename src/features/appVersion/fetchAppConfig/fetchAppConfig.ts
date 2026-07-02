// src/features/appVersion/fetchAppConfig/fetchAppConfig.ts
// app_config 단일행 조회 래퍼 (app-version-gate plan §3.2).
//   생산자: public.app_config(싱글턴 id=1, anon+authenticated select RLS). 소비자: useAppVersionGate(콜드스타트 1회).
//   error/빈/형불량/예외는 전부 null(=fail-open — 호출부가 게이트 미발화). 절대 throw하지 않는다.
//   네트워크: 1회 select만(폴링/Realtime 0 — 비용 가드레일 §8).
import { supabase } from '@/lib/supabase';

/** app_config 소비형(camelCase). null 필드는 게이트에서 fail-open/미발화로 처리. */
export type AppConfig = {
  minSupportedVersion: string | null;
  latestVersion: string | null;
  storeUrlIos: string | null;
  storeUrlAndroid: string | null;
};

/** app_config 원행(snake_case) — select 컬럼 계약의 단일 출처. */
type AppConfigRow = {
  min_supported_version?: string | null;
  latest_version?: string | null;
  store_url_ios?: string | null;
  store_url_android?: string | null;
};

/**
 * app_config 1행(id=1)을 조회해 camelCase로 매핑한다. 실패는 조용히 null(fail-open).
 * @returns AppConfig 또는 null(error/빈/형불량/예외)
 */
export const fetchAppConfig = async (): Promise<AppConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('min_supported_version, latest_version, store_url_ios, store_url_android')
      .eq('id', 1)
      .maybeSingle();

    if (error || data === null || typeof data !== 'object') return null;

    const row = data as AppConfigRow;
    return {
      minSupportedVersion: row.min_supported_version ?? null,
      latestVersion: row.latest_version ?? null,
      storeUrlIos: row.store_url_ios ?? null,
      storeUrlAndroid: row.store_url_android ?? null,
    };
  } catch {
    return null;
  }
};
