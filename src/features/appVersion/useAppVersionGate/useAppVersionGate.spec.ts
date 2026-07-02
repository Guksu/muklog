// src/features/appVersion/useAppVersionGate/useAppVersionGate.spec.ts
// 버전 게이트 훅 단위 테스트 (app-version-gate plan §5 T6·§5-1).
//   force/suggest(미dismiss)/dismiss됨→none/ok→none/fetch null→none/current null→none(fail-open) 분기,
//   storeUrl 플랫폼(ios/android), dismissSuggest 저장+none, 폴링 0(fetch 1회).
//   fetchAppConfig·getCurrentAppVersion·updateSuggestDismissal 모킹 + Platform.OS 조작(socialSignIn 패턴).
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('../fetchAppConfig', () => ({ fetchAppConfig: jest.fn() }));
jest.mock('../currentAppVersion', () => ({ getCurrentAppVersion: jest.fn() }));
jest.mock('../updateSuggestDismissal', () => ({
  loadDismissedVersion: jest.fn(),
  saveDismissedVersion: jest.fn(),
}));

import { fetchAppConfig } from '../fetchAppConfig';
import { getCurrentAppVersion } from '../currentAppVersion';
import { loadDismissedVersion, saveDismissedVersion } from '../updateSuggestDismissal';
import { useAppVersionGate } from './useAppVersionGate';

const fetchMock = fetchAppConfig as jest.Mock;
const currentMock = getCurrentAppVersion as jest.Mock;
const loadDismissed = loadDismissedVersion as jest.Mock;
const saveDismissed = saveDismissedVersion as jest.Mock;

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
  loadDismissed.mockReset();
  saveDismissed.mockReset();
  loadDismissed.mockResolvedValue(null);
  saveDismissed.mockResolvedValue(undefined);
  setPlatform('ios');
});

describe('useAppVersionGate (T6)', () => {
  it('current < min → force(storeUrl=플랫폼 URL)', async () => {
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'force', storeUrl: 'ios-url' }),
    );
  });

  it('min<=current<latest & 미dismiss → suggest(latestVersion·storeUrl)', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'suggest',
        latestVersion: '2.0.0',
        storeUrl: 'ios-url',
      }),
    );
  });

  it('suggest인데 이미 그 latest를 dismiss했으면 none(버전당 1회)', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    loadDismissed.mockResolvedValueOnce('2.0.0'); // 현재 latest와 동일 → 미노출
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
  });

  it('current >= latest → ok → none', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
  });

  it('fetchAppConfig null → none(fail-open)', async () => {
    fetchMock.mockResolvedValueOnce(null);
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
  });

  it('current 미확보(null) → unknown → none(fail-open)', async () => {
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0' }));
    currentMock.mockReturnValue(null);
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
  });

  it('storeUrl은 플랫폼 분기(android → storeUrlAndroid)', async () => {
    setPlatform('android');
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'force', storeUrl: 'android-url' }),
    );
  });

  it('dismissSuggest → saveDismissedVersion(latest) 기록 + state none', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state.status).toBe('suggest'));

    act(() => result.current.dismissSuggest());
    expect(saveDismissed).toHaveBeenCalledWith({ version: '2.0.0' });
    expect(result.current.state).toEqual({ status: 'none' });
  });

  it('폴링 0 — fetchAppConfig는 마운트 1회만 호출된다', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
