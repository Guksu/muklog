// src/features/appVersion/fetchAppConfig/fetchAppConfig.spec.ts
// app_config 조회 래퍼 단위 테스트 (app-version-gate plan §5 T4·§5-1).
//   정상 snake→camel 매핑 / error→null / 빈(0행)→null / 예외→null(throw 0, fail-open).
//   supabase from().select().eq().maybeSingle() 모킹(useProfile 패턴 계승).
const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ select }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromProxy(...a) } }));
const fromProxy = (...a: unknown[]) => from(...(a as []));

import { fetchAppConfig } from './fetchAppConfig';

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe('fetchAppConfig (T4)', () => {
  it('1행을 snake→camel로 매핑한다(정상)', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        min_supported_version: '1.0.0',
        latest_version: '2.0.0',
        store_url_ios: 'https://apps.apple.com/app/id1',
        store_url_android: 'https://play.google.com/store/apps/details?id=x',
      },
      error: null,
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      minSupportedVersion: '1.0.0',
      latestVersion: '2.0.0',
      storeUrlIos: 'https://apps.apple.com/app/id1',
      storeUrlAndroid: 'https://play.google.com/store/apps/details?id=x',
    });
    expect(from).toHaveBeenCalledWith('app_config');
    expect(select).toHaveBeenCalledWith(
      'min_supported_version, latest_version, store_url_ios, store_url_android',
    );
    expect(eq).toHaveBeenCalledWith('id', 1);
  });

  it('null 필드(미출시 URL)는 null로 흡수한다', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        min_supported_version: '0.0.0',
        latest_version: '1.0.0',
        store_url_ios: null,
        store_url_android: null,
      },
      error: null,
    });
    await expect(fetchAppConfig()).resolves.toEqual({
      minSupportedVersion: '0.0.0',
      latestVersion: '1.0.0',
      storeUrlIos: null,
      storeUrlAndroid: null,
    });
  });

  it('조회 에러면 null(fail-open)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('rls or network') });
    await expect(fetchAppConfig()).resolves.toBeNull();
  });

  it('0행(빈)이면 null(fail-open)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchAppConfig()).resolves.toBeNull();
  });

  it('예외가 나도 null로 흡수한다(throw 0)', async () => {
    maybeSingle.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAppConfig()).resolves.toBeNull();
  });
});
