// src/features/ota/useOtaUpdate/useOtaUpdate.spec.ts
// OTA 상태 훅 단위 테스트 (expo-updates-ota plan §3.5, T5 · §5-1).
//   loadUpdatesModule만 모킹(shouldCheckOta는 실물 — 로더↔판정↔소비 경계면을 실제로 통과시킨다).
//   정상/경계/실패 + 호출 횟수(폴링 0) + 언마운트 setState 가드까지 인수조건 10항목 전수.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { setDevMode } from '@/test/setDevMode';

jest.mock('../updatesModule', () => ({ loadUpdatesModule: jest.fn() }));

import { loadUpdatesModule, type UpdatesModule } from '../updatesModule';
import { OtaStatus, useOtaUpdate } from './useOtaUpdate';

const loadMock = loadUpdatesModule as jest.Mock;

const makeUpdates = ({ isEnabled = true }: { isEnabled?: boolean } = {}) => ({
  isEnabled,
  checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: false }),
  fetchUpdateAsync: jest.fn().mockResolvedValue({ isNew: false }),
  reloadAsync: jest.fn().mockResolvedValue(undefined),
});

let updates: ReturnType<typeof makeUpdates>;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  // 프로덕션 번들 기준(개발 중이면 shouldCheckOta가 막는다 — 별도 케이스에서 검증).
  setDevMode({ isDev: false });
  updates = makeUpdates();
  loadMock.mockReset();
  loadMock.mockReturnValue(updates as unknown as UpdatesModule);
});

afterEach(() => {
  setDevMode({ isDev: true });
  jest.restoreAllMocks();
});

describe('useOtaUpdate (T5)', () => {
  it('AC1: 네이티브 미탑재(로더 null) → idle 유지 + 체크 호출 0(네트워크 0)', async () => {
    loadMock.mockReturnValue(null);
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('AC1: 개발 중(__DEV__) → idle 유지 + 체크 호출 0', async () => {
    setDevMode({ isDev: true });
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('AC1: 빌드 비활성(isEnabled false) → idle 유지 + 체크 호출 0', async () => {
    updates = makeUpdates({ isEnabled: false });
    loadMock.mockReturnValue(updates as unknown as UpdatesModule);
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('AC2: 업데이트 없음(isAvailable false) → idle + fetch 미호출', async () => {
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
  });

  it('AC3: 업데이트 있음 → downloading 경유 → isNew true면 ready', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    let releaseFetch: (value: { isNew: boolean }) => void = () => {};
    updates.fetchUpdateAsync.mockReturnValue(
      new Promise<{ isNew: boolean }>((resolve) => {
        releaseFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useOtaUpdate());
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Downloading));

    await act(async () => {
      releaseFetch({ isNew: true });
    });
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Ready));
  });

  it('AC4: fetch isNew false → idle(안내 없음)', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe(OtaStatus.Idle);
  });

  it('AC5: check throw(오프라인) → idle + 예외가 밖으로 안 나감', async () => {
    updates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
  });

  it('AC5: fetch throw(다운로드 중 끊김) → idle', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockRejectedValue(new Error('network lost'));
    const { result } = renderHook(() => useOtaUpdate());
    await flush();
    expect(result.current.state.status).toBe(OtaStatus.Idle);
  });

  it('AC6: applyUpdate() → reloading + reloadAsync 정확히 1회', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    const { result } = renderHook(() => useOtaUpdate());
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Ready));

    act(() => result.current.applyUpdate());
    expect(updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe(OtaStatus.Reloading);
  });

  it('AC7: reloadAsync throw → idle 복귀(앱 계속 사용 가능)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    updates.reloadAsync.mockRejectedValue(new Error('reload failed'));

    const { result } = renderHook(() => useOtaUpdate());
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Ready));
    await act(async () => {
      result.current.applyUpdate();
    });
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Idle));
    expect(warn).toHaveBeenCalled();
  });

  it('AC8: dismiss() → idle', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    const { result } = renderHook(() => useOtaUpdate());
    await waitFor(() => expect(result.current.state.status).toBe(OtaStatus.Ready));

    act(() => result.current.dismiss());
    expect(result.current.state.status).toBe(OtaStatus.Idle);
  });

  it('AC9: 리렌더해도 마운트당 check는 정확히 1회(폴링 0·타이머 0·AppState 리스너 0)', async () => {
    const addEventListener = jest.spyOn(AppState, 'addEventListener');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const { rerender } = renderHook(() => useOtaUpdate());
    await flush();
    rerender({});
    await flush();

    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(addEventListener).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('AC10: 언마운트 후 응답이 도착해도 setState 경고 0', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    let releaseCheck: (value: { isAvailable: boolean }) => void = () => {};
    updates.checkForUpdateAsync.mockReturnValue(
      new Promise<{ isAvailable: boolean }>((resolve) => {
        releaseCheck = resolve;
      }),
    );

    const { unmount } = renderHook(() => useOtaUpdate());
    unmount();
    await act(async () => {
      releaseCheck({ isAvailable: true });
    });

    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled(); // 언마운트 후 진행 중단.
    expect(error).not.toHaveBeenCalled();
  });
});
