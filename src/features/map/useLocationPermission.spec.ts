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
});
