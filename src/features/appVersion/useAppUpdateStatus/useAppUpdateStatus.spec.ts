// src/features/appVersion/useAppUpdateStatus/useAppUpdateStatus.spec.ts
// 설정용 업데이트 상태 훅 단위 테스트 (app-update-actions plan §3.2·§5 T2·§5-1).
//   force/suggest→available(+플랫폼 storeUrl), ok→latest, unknown/fetch null/current null/형불량→unknown,
//   storeUrl 플랫폼(ios/android), available&storeUrl null(android 미출시), 폴링 0(fetch 1회).
//   dismissal 미참조 — updateSuggestDismissal은 모킹하지 않는다(참조 시 실모듈 로드 = 회귀 신호).
//   fetchAppConfig·getCurrentAppVersion 모킹 + Platform.OS 조작(useAppVersionGate.spec 패턴).
import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('../fetchAppConfig', () => ({ fetchAppConfig: jest.fn() }));
jest.mock('../currentAppVersion', () => ({ getCurrentAppVersion: jest.fn() }));

import { fetchAppConfig } from '../fetchAppConfig';
import { getCurrentAppVersion } from '../currentAppVersion';
import { useAppUpdateStatus } from './useAppUpdateStatus';

const fetchMock = fetchAppConfig as jest.Mock;
const currentMock = getCurrentAppVersion as jest.Mock;

const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const config = (over?: Record<string, unknown>) => ({
  minSupportedVersion: '1.0.0',
  latestVersion: '2.0.0',
  storeUrlIos: 'ios-url',
  storeUrlAndroid: 'android-url',
  ...over,
});

beforeEach(() => {
  fetchMock.mockReset();
  currentMock.mockReset();
  setPlatform('ios');
});

describe('useAppUpdateStatus (T2)', () => {
  it('suggest(min<=current<latest) → available(+ios storeUrl)', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: 'available', storeUrl: 'ios-url' }),
    );
  });

  it('force(current<min) → available', async () => {
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: 'available', storeUrl: 'ios-url' }),
    );
  });

  it('ok(current>=latest) → latest', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() => expect(result.current.status).toEqual({ kind: 'latest' }));
  });

  it('fetchAppConfig null → unknown(fail-open)', async () => {
    fetchMock.mockResolvedValueOnce(null);
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() => expect(result.current.status).toEqual({ kind: 'unknown' }));
  });

  it('current 미확보(null) → unknown', async () => {
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0' }));
    currentMock.mockReturnValue(null);
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() => expect(result.current.status).toEqual({ kind: 'unknown' }));
  });

  it('형불량(latest "x") → unknown', async () => {
    fetchMock.mockResolvedValueOnce(config({ latestVersion: 'x' }));
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() => expect(result.current.status).toEqual({ kind: 'unknown' }));
  });

  it('storeUrl은 플랫폼 분기(android → storeUrlAndroid)', async () => {
    setPlatform('android');
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: 'available', storeUrl: 'android-url' }),
    );
  });

  it('available인데 storeUrl null(android 미출시) → available & storeUrl null', async () => {
    setPlatform('android');
    fetchMock.mockResolvedValueOnce(
      config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0', storeUrlAndroid: null }),
    );
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: 'available', storeUrl: null }),
    );
  });

  it('폴링 0 — fetchAppConfig는 마운트 1회만 호출된다', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppUpdateStatus());
    await waitFor(() => expect(result.current.status).toEqual({ kind: 'latest' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
