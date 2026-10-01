// src/features/appVersion/useAppVersionGate/useAppVersionGate.spec.ts
// 버전 게이트 훅 단위 테스트 (app-version-gate plan §5 T6·§5-1).
//   force/suggest(미dismiss)/dismiss됨→none/ok→none/fetch null→none/current null→none(fail-open) 분기,
//   storeUrl 플랫폼(ios/android), dismissSuggest 저장+none, 폴링 0(fetch 1회).
//   invite-share(U72, plan R5 — AC4): 콜드스타트 조회값 storeUrlIos를 판정·플랫폼과 무관하게 내놓는다(초대 메시지 링크 재사용, 추가 조회 0).
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

describe('useAppVersionGate — storeUrlIos 노출 (invite-share AC4)', () => {
  it('조회 전(checking)에는 null이다', () => {
    fetchMock.mockReturnValueOnce(new Promise(() => undefined)); // 끝나지 않는 조회 — checking 유지
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    expect(result.current.state).toEqual({ status: 'checking' });
    expect(result.current.storeUrlIos).toBeNull();
  });

  it('최신(ok → none)이어도 조회한 iOS 링크를 내놓는다 — 평상시에도 링크가 남는다', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
    expect(result.current.storeUrlIos).toBe('ios-url');
  });

  it('권유(suggest)에서도 같은 iOS 링크를 내놓는다', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state.status).toBe('suggest'));
    expect(result.current.storeUrlIos).toBe('ios-url');
  });

  it('강제(force)에서도 같은 iOS 링크를 내놓는다', async () => {
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state.status).toBe('force'));
    expect(result.current.storeUrlIos).toBe('ios-url');
  });

  it('권유를 "나중에"로 닫아 none이 돼도 링크는 유지된다', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('1.5.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state.status).toBe('suggest'));
    act(() => result.current.dismissSuggest());
    expect(result.current.state).toEqual({ status: 'none' });
    expect(result.current.storeUrlIos).toBe('ios-url');
  });

  it('Android에서도 storeUrlIos는 iOS 링크다(게이트 state.storeUrl은 기존대로 Android 링크)', async () => {
    setPlatform('android');
    fetchMock.mockResolvedValueOnce(config({ minSupportedVersion: '2.0.0', latestVersion: '3.0.0' }));
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'force', storeUrl: 'android-url' }));
    expect(result.current.storeUrlIos).toBe('ios-url');
  });

  it('조회 실패(null)면 storeUrlIos도 null이다', async () => {
    fetchMock.mockResolvedValueOnce(null);
    currentMock.mockReturnValue('1.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
    expect(result.current.storeUrlIos).toBeNull();
  });

  it('DB 값이 null이면 그대로 null이다(해석·폴백은 소비처 몫)', async () => {
    fetchMock.mockResolvedValueOnce(config({ storeUrlIos: null }));
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'none' }));
    expect(result.current.storeUrlIos).toBeNull();
  });

  it('링크를 내놓아도 조회는 마운트 1회뿐이다(폴링 0 · 추가 조회 0)', async () => {
    fetchMock.mockResolvedValueOnce(config());
    currentMock.mockReturnValue('2.0.0');
    const { result } = renderHook(() => useAppVersionGate());
    await waitFor(() => expect(result.current.storeUrlIos).toBe('ios-url'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
