// src/features/map/useNearbyPlaces.spec.ts
// 주변 음식점 viewport 훅 — 디바운스·양자화 캐시·최소이동 임계·레이스 가드 (plan §3.5·§5-1, 비용 §8).
//   searchNearby 모킹 + fake timers로 호출 횟수/상태 전이를 검증. 비용 가드레일을 테스트로 강제한다.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('./searchNearby', () => ({ searchNearby: jest.fn() }));
import { searchNearby } from './searchNearby';
import { NEARBY_DEBOUNCE_MS, useNearbyPlaces } from './useNearbyPlaces';

const searchMock = searchNearby as jest.Mock;

// 두 코너 bbox 헬퍼(중심을 dLat/dLng만큼 평행이동, 폭 고정).
const bounds = ({ lat = 37.5, lng = 127.0 }: { lat?: number; lng?: number } = {}) => ({
  sw: { lat: lat - 0.01, lng: lng - 0.01 },
  ne: { lat: lat + 0.01, lng: lng + 0.01 },
});

const item = (id: string) => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 100,
});

beforeEach(() => {
  jest.useFakeTimers();
  searchMock.mockReset();
  searchMock.mockResolvedValue([item('1')]);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useNearbyPlaces', () => {
  it('setBounds 후 디바운스 1회 호출 → markers ready', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.markers.map((m) => m.id)).toEqual(['1']);
    expect(result.current.markers[0].saved).toBe(false);
  });

  it('디바운스: 창 내 연속 setBounds(크게 이동) 3회 → searchNearby 1회만(마지막 bbox)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    act(() => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 37.8 })));
    act(() => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 38.1 })));
    expect(searchMock).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 38.1 }));
  });

  it('캐시: 동일(양자화) bbox 재 setBounds → searchNearby 0회 추가(히트)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    // 멀리 갔다가
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    // 원위치(동일 bbox) → 캐시 히트, 추가 호출 0.
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });

  it('최소 이동 임계: 직전 조회 bbox에서 미세 이동(임계 미만)은 미호출', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    // 아주 살짝 이동(임계 미만, 양자화 키는 다를 수 있음) → 추가 호출 0.
    act(() => result.current.setBounds(bounds({ lat: 37.5 + 0.00005 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('임계 이상 이동 → 호출', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    act(() => result.current.setBounds(bounds({ lat: 37.9 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('레이스: 늦게 온 stale 응답은 폐기하고 최신 결과만 반영', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    searchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    searchMock.mockResolvedValueOnce([item('second')]);

    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    }); // 첫 요청 pending
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    }); // 둘째 → [second]
    await act(async () => {
      resolveFirst([item('first')]); // 늦은 첫 응답
    });
    expect(result.current.markers.map((m) => m.id)).toEqual(['second']);
  });

  it('에러: searchNearby reject → status=error, markers 비움', async () => {
    searchMock.mockRejectedValueOnce(new Error('KAKAO_REQUEST_FAILED'));
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.markers).toEqual([]);
  });
});
