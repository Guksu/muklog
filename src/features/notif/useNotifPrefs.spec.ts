// src/features/notif/useNotifPrefs.spec.ts
// 알림 설정 영속 훅 — T2. 마운트 1회 read(폴링 없음)·낙관적 갱신·직렬화 영속·쓰기 실패 폴백.
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

import { notifPrefsKey } from './notifPrefs';
import { useNotifPrefs } from './useNotifPrefs';

beforeEach(() => {
  mockGetItem.mockReset();
  mockSetItem.mockReset();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('useNotifPrefs — 마운트 read', () => {
  it('마운트 시 user-scoped 키로 getItem을 정확히 1회 호출한다(폴링 없음)', async () => {
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith(notifPrefsKey({ userId: 'u1' }));
  });

  it('read 값이 있으면 파싱값으로 ready 전이한다', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ master: false, perLog: { r1: false } }));
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({
      status: 'ready',
      prefs: { master: false, perLog: { r1: false } },
    });
  });

  it('read 값이 null이면 DEFAULT로 ready 전이한다', async () => {
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: true, perLog: {} } });
  });
});

describe('useNotifPrefs — setMaster/setLogEnabled', () => {
  it('setMaster(false) → state.master 즉시 false + setItem에 master:false 직렬화', async () => {
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setMaster({ enabled: false });
    });

    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: false, perLog: {} } });
    expect(mockSetItem).toHaveBeenCalledWith(
      notifPrefsKey({ userId: 'u1' }),
      JSON.stringify({ master: false, perLog: {} }),
    );
  });

  it('setLogEnabled(r1,false) → perLog.r1=false 반영, 마스터/다른 로그 값 불변', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ master: true, perLog: { r2: false } }));
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setLogEnabled({ roomId: 'r1', enabled: false });
    });

    expect(result.current.state).toEqual({
      status: 'ready',
      prefs: { master: true, perLog: { r2: false, r1: false } },
    });
    expect(mockSetItem).toHaveBeenLastCalledWith(
      notifPrefsKey({ userId: 'u1' }),
      JSON.stringify({ master: true, perLog: { r2: false, r1: false } }),
    );
  });

  it('setItem이 reject해도 state는 낙관적으로 유지되고 warn한다(throw 미전파)', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setMaster({ enabled: false });
    });

    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: false, perLog: {} } });
    expect(console.warn).toHaveBeenCalled();
  });
});
