// src/features/map/useLocationPermission.spec.ts
// 현재위치 권한 요청·상태 훅 단위 테스트 (plan §3.3·§5-1 useLocationPermission).
//   undetermined→request()→granted 시 coords 채움 / denied 시 coords null·status denied /
//   권한·위치 모듈 throw 시 denied로 흡수(지도 차단 안 함 — 예외 전파 금지).
//   네이티브는 모킹 → expo-location 모듈 모킹으로 클라 분기만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import { useLocationPermission } from './useLocationPermission';
import { LocationPermissionStatus } from './types';

const requestPermMock = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPositionMock = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  requestPermMock.mockReset();
  getPositionMock.mockReset();
});

describe('useLocationPermission', () => {
  it('초기 상태는 undetermined, coords null이다', () => {
    const { result } = renderHook(() => useLocationPermission());
    expect(result.current.status).toBe(LocationPermissionStatus.Undetermined);
    expect(result.current.coords).toBeNull();
  });

  it('권한 granted + 위치 획득 시 status granted, coords 채움', async () => {
    requestPermMock.mockResolvedValueOnce({ status: 'granted' });
    getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } });

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {
      await result.current.request();
    });

    await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));
    expect(result.current.coords).toEqual({ lat: 37.5, lng: 127.0 });
  });

  it('권한 거부 시 status denied, coords null (위치 조회 미시도)', async () => {
    requestPermMock.mockResolvedValueOnce({ status: 'denied' });

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {
      await result.current.request();
    });

    await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Denied));
    expect(result.current.coords).toBeNull();
    expect(getPositionMock).not.toHaveBeenCalled();
  });

  it('권한 모듈 throw 시 denied로 흡수한다(예외 전파 안 함)', async () => {
    requestPermMock.mockRejectedValueOnce(new Error('perm boom'));

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {
      await result.current.request();
    });

    await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Denied));
    expect(result.current.coords).toBeNull();
  });

  it('granted지만 위치 조회 throw 시 granted 유지·coords null(무한 로딩 금지)', async () => {
    requestPermMock.mockResolvedValueOnce({ status: 'granted' });
    getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {
      await result.current.request();
    });

    await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));
    expect(result.current.coords).toBeNull();
  });

  // ── map-locate-button: refreshCoords (plan §3.6·§5-1 T7) ──────────
  describe('refreshCoords', () => {
    it('granted일 때 getCurrentPositionAsync 1회 호출·coords 갱신·새 coords 반환', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      // 진입 request 시 1회, refreshCoords 시 1회 — 두 번째가 fresh 좌표.
      getPositionMock
        .mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } })
        .mockResolvedValueOnce({ coords: { latitude: 37.6, longitude: 127.1 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));

      getPositionMock.mockClear();
      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshCoords();
      });
      expect(getPositionMock).toHaveBeenCalledTimes(1);
      expect(returned).toEqual({ lat: 37.6, lng: 127.1 });
      expect(result.current.coords).toEqual({ lat: 37.6, lng: 127.1 });
    });

    it('granted 아니면 getCurrentPositionAsync 미호출·null 반환', async () => {
      const { result } = renderHook(() => useLocationPermission());
      let returned: unknown = 'sentinel';
      await act(async () => {
        returned = await result.current.refreshCoords();
      });
      expect(returned).toBeNull();
      expect(getPositionMock).not.toHaveBeenCalled();
    });

    it('실패(throw) 시 직전 coords로 폴백 반환(throw 전파 안 함)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.coords).toEqual({ lat: 37.5, lng: 127.0 }));

      getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));
      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshCoords();
      });
      // 직전 coords 폴백.
      expect(returned).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it('직전 coords 없이 실패하면 null 반환', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      // 진입 request 시 위치 획득 실패 → coords null 유지.
      getPositionMock.mockRejectedValueOnce(new Error('init gps fail'));

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));

      getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));
      let returned: unknown = 'sentinel';
      await act(async () => {
        returned = await result.current.refreshCoords();
      });
      expect(returned).toBeNull();
    });

    it('in-flight 재진입 시 getCurrentPositionAsync 중복 호출 0(가드)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));

      getPositionMock.mockClear();
      // 응답을 잡아두는 deferred — 첫 호출 in-flight 동안 두 번째 호출 발사.
      let resolveGet: (v: unknown) => void = () => {};
      getPositionMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
      );

      await act(async () => {
        const first = result.current.refreshCoords();
        const second = result.current.refreshCoords();
        resolveGet({ coords: { latitude: 37.9, longitude: 127.9 } });
        await Promise.all([first, second]);
      });
      expect(getPositionMock).toHaveBeenCalledTimes(1);
    });
  });
});
