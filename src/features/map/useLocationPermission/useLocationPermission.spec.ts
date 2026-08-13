// src/features/map/useLocationPermission.spec.ts
// 현재위치 권한 요청·상태 훅 단위 테스트 (plan §3.3·§5-1 useLocationPermission).
//   undetermined→request()→granted 시 coords 채움 / denied 시 coords null·status denied /
//   권한·위치 모듈 throw 시 denied로 흡수(지도 차단 안 함 — 예외 전파 금지).
//   네이티브는 모킹 → expo-location 모듈 모킹으로 클라 분기만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import { useLocationPermission } from './useLocationPermission';
// lastKnownLocation은 실물을 쓴다(모킹 아님) — "메모리 캐시 ↔ 훅 시드" 경계면이 이 스프린트의 급소라
//   두 쪽을 함께 태워 실제 왕복을 검증한다(plan §7 경계면 1). 네이티브만 expo-location 모킹으로 격리.
import { clearWarmCoords, readWarmCoords, writeWarmCoords } from '../lastKnownLocation';
import { LocationCoordsSource, LocationPermissionStatus } from '../types';

const requestPermMock = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPermMock = Location.getForegroundPermissionsAsync as jest.Mock;
const getPositionMock = Location.getCurrentPositionAsync as jest.Mock;
const getLastKnownMock = Location.getLastKnownPositionAsync as jest.Mock;

beforeEach(() => {
  requestPermMock.mockReset();
  getPermMock.mockReset();
  getPositionMock.mockReset();
  getLastKnownMock.mockReset();
  // 프로세스 수명 캐시 — 케이스 간 격리.
  clearWarmCoords();
  // 기본값: 비프롬프트 getter는 미결정(워밍 경로가 조용히 null) / OS 캐시 없음.
  getPermMock.mockResolvedValue({ granted: false, status: 'undetermined' });
  getLastKnownMock.mockResolvedValue(null);
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
      // 좌표와 그 출처를 함께 돌려준다 — 소비자가 정밀도를 추정하지 않게 한다.
      expect(returned).toEqual({
        coords: { lat: 37.6, lng: 127.1 },
        source: LocationCoordsSource.Fresh,
      });
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
      // 직전 coords 폴백(그 좌표의 실제 출처와 함께).
      expect(returned).toEqual({
        coords: { lat: 37.5, lng: 127.0 },
        source: LocationCoordsSource.Fresh,
      });
    });

    it('실패 폴백 시 직전 좌표의 실제 출처를 돌려준다 — warm을 fresh로 오마킹하지 않는다', async () => {
      // 진입 시 last-known(warm)만 확보하고 정밀 픽스는 실패 → 현재 좌표의 출처는 warm.
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPermMock.mockResolvedValue({ granted: true, status: 'granted' });
      getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });
      getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.coordsSource).toBe(LocationCoordsSource.Warm));

      // FAB 재취득도 실패 → 직전 warm 좌표로 폴백. 출처는 warm 그대로여야 한다.
      getPositionMock.mockRejectedValueOnce(new Error('gps timeout again'));
      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshCoords();
      });

      expect(returned).toEqual({
        coords: { lat: 37.55, lng: 126.99 },
        source: LocationCoordsSource.Warm,
      });
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

    it('refreshCoords 성공 시 출처가 fresh로 승격되고 캐시도 갱신된다(map-initial-location R5)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPositionMock
        .mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } })
        .mockResolvedValueOnce({ coords: { latitude: 37.6, longitude: 127.1 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));

      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshCoords();
      });

      expect(result.current.coordsSource).toBe(LocationCoordsSource.Fresh);
      expect(returned).toEqual({
        coords: { lat: 37.6, lng: 127.1 },
        source: LocationCoordsSource.Fresh,
      });
      expect(readWarmCoords()).toEqual({ lat: 37.6, lng: 127.1 });
    });

    it('refreshCoords 실패 시 직전 좌표·출처가 그대로 유지된다(R6)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.5, longitude: 127.0 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });
      await waitFor(() => expect(result.current.coords).toEqual({ lat: 37.5, lng: 127.0 }));

      getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));
      await act(async () => {
        await result.current.refreshCoords();
      });

      expect(result.current.coords).toEqual({ lat: 37.5, lng: 127.0 });
      expect(result.current.coordsSource).toBe(LocationCoordsSource.Fresh);
    });
  });

  // ── map-initial-location: warm 시드 + coordsSource (plan §3.4 R1~R6·§5-1 T5) ──
  describe('warm 좌표 시드(coordsSource)', () => {
    it('R1: 캐시가 있으면 첫 렌더에서 이미 coords가 채워져 있고 출처는 warm이다 (동기 시드 — E9)', () => {
      writeWarmCoords({ coords: { lat: 37.55, lng: 126.99 } });

      const { result } = renderHook(() => useLocationPermission());

      // 첫 렌더 시점(비동기 대기 없이) 이미 좌표 보유 = initialRegion이 렌더 1부터 실좌표를 받는다.
      expect(result.current.coords).toEqual({ lat: 37.55, lng: 126.99 });
      expect(result.current.coordsSource).toBe(LocationCoordsSource.Warm);
      // 권한 상태와 좌표 보유는 독립 — 여전히 undetermined에서 시작한다.
      expect(result.current.status).toBe(LocationPermissionStatus.Undetermined);
    });

    it('R1: 캐시가 없으면 기존과 동일(coords null·coordsSource null) — 회귀 0', () => {
      const { result } = renderHook(() => useLocationPermission());
      expect(result.current.coords).toBeNull();
      expect(result.current.coordsSource).toBeNull();
    });

    it('R2: granted면 last-known으로 즉시 시드한 뒤 fresh 픽스로 승격한다', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPermMock.mockResolvedValue({ granted: true, status: 'granted' });
      getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });
      getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.6, longitude: 127.1 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });

      await waitFor(() => expect(result.current.coordsSource).toBe(LocationCoordsSource.Fresh));
      expect(result.current.coords).toEqual({ lat: 37.6, lng: 127.1 });
      expect(getLastKnownMock).toHaveBeenCalled();
      // fresh 좌표가 캐시에 반영돼 다음 마운트는 정밀 좌표로 시작한다(E14).
      expect(readWarmCoords()).toEqual({ lat: 37.6, lng: 127.1 });
    });

    it('R3: granted + last-known 있음 + fresh 실패면 warm 좌표를 유지한다(null로 떨어지지 않음)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPermMock.mockResolvedValue({ granted: true, status: 'granted' });
      getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });
      getPositionMock.mockRejectedValueOnce(new Error('gps timeout'));

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });

      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Granted));
      expect(result.current.coords).toEqual({ lat: 37.55, lng: 126.99 });
      expect(result.current.coordsSource).toBe(LocationCoordsSource.Warm);
    });

    it('R2 경계: granted인데 last-known이 없으면 기존 동작과 동일(fresh만)', async () => {
      requestPermMock.mockResolvedValueOnce({ status: 'granted' });
      getPermMock.mockResolvedValue({ granted: true, status: 'granted' });
      getLastKnownMock.mockResolvedValue(null);
      getPositionMock.mockResolvedValueOnce({ coords: { latitude: 37.6, longitude: 127.1 } });

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });

      await waitFor(() => expect(result.current.coords).toEqual({ lat: 37.6, lng: 127.1 }));
      expect(result.current.coordsSource).toBe(LocationCoordsSource.Fresh);
    });

    it('R4: denied면 warm 좌표를 버리고 캐시도 비운다(권한 없이 stale 좌표 표시 금지 — E7)', async () => {
      writeWarmCoords({ coords: { lat: 37.55, lng: 126.99 } });
      requestPermMock.mockResolvedValueOnce({ status: 'denied' });

      const { result } = renderHook(() => useLocationPermission());
      // 마운트 시엔 warm 시드가 살아있다.
      expect(result.current.coords).toEqual({ lat: 37.55, lng: 126.99 });

      await act(async () => {
        await result.current.request();
      });

      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Denied));
      expect(result.current.coords).toBeNull();
      expect(result.current.coordsSource).toBeNull();
      expect(readWarmCoords()).toBeNull();
      expect(getPositionMock).not.toHaveBeenCalled();
    });

    it('R4: 권한 모듈 throw도 denied로 흡수하며 캐시를 비운다', async () => {
      writeWarmCoords({ coords: { lat: 37.55, lng: 126.99 } });
      requestPermMock.mockRejectedValueOnce(new Error('perm boom'));

      const { result } = renderHook(() => useLocationPermission());
      await act(async () => {
        await result.current.request();
      });

      await waitFor(() => expect(result.current.status).toBe(LocationPermissionStatus.Denied));
      expect(result.current.coords).toBeNull();
      expect(result.current.coordsSource).toBeNull();
      expect(readWarmCoords()).toBeNull();
    });

    it('E9: 워밍이 끝난 뒤 마운트하면 폴링·구독 없이 렌더 1에 반영된다(추가 네이티브 호출 0)', () => {
      writeWarmCoords({ coords: { lat: 37.55, lng: 126.99 } });

      const { result } = renderHook(() => useLocationPermission());

      expect(result.current.coords).toEqual({ lat: 37.55, lng: 126.99 });
      // 마운트만으로는 어떤 위치·권한 네이티브도 건드리지 않는다(권한 프롬프트 0).
      expect(requestPermMock).not.toHaveBeenCalled();
      expect(getPositionMock).not.toHaveBeenCalled();
      expect(getLastKnownMock).not.toHaveBeenCalled();
    });
  });
});
