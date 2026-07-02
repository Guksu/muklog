// src/features/map/useNearbyPlaces.spec.ts
// 주변 음식점 viewport 훅 — 디바운스·양자화 캐시·최소이동 임계·레이스 가드 (plan §3.5·§5-1, 비용 §8).
//   searchNearby 모킹 + fake timers로 호출 횟수/상태 전이를 검증. 비용 가드레일을 테스트로 강제한다.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../searchNearby', () => ({ searchNearby: jest.fn() }));
import { searchNearby } from '../searchNearby';
import { NEARBY_ACCUM_CAP, NEARBY_DEBOUNCE_MS, useNearbyPlaces } from './useNearbyPlaces';

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

  // 첫 조회 즉시성 (nearby-first-load) — 첫 조회는 0틱 leading-edge, 2회차+는 500ms 트레일링.
  it('T1-a 첫 조회는 0틱(0ms)에 searchNearby 1회 호출 → ready', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.markers.map((m) => m.id)).toEqual(['1']);
    expect(result.current.markers[0].saved).toBe(false);
  });

  it('T1-b 첫 조회는 동기 즉시가 아니라 0틱 — 타이머 미경과 시 아직 미호출', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    // setBounds 직후, 타이머를 전혀 흘리지 않으면 아직 호출 전(0틱이라야 cleanup 가능 → T2 성립).
    expect(searchMock).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('T1-c 두 번째 이동은 트레일링 유지 — 0틱엔 미호출, 500ms 후 호출', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1); // 첫 조회 소진
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1); // 0틱엔 추가 없음(트레일링)
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('T1-d 첫 조회(0틱) 후 창 내 연속 대이동 → 첫 1회 + 마지막 bbox 1회(총 2회)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.setBounds(bounds({ lat: 37.8 })));
    act(() => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 38.1 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 38.1 }));
  });

  it('T2 첫 진입 idle 다발(연속 setBounds 3회) → searchNearby 정확히 1회(마지막 bbox)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    // 초기 INIT relayout/setCenter가 idle을 다발로 쏘는 상황 모사 — 0틱 타이머가 cleanup으로 수렴.
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    act(() => result.current.setBounds(bounds({ lat: 37.6 })));
    act(() => result.current.setBounds(bounds({ lat: 37.7 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 37.7 }));
  });

  it('T2-b 첫 emit(명시) + belt-and-suspenders 재emit(동일 bbox) → invoke 정확히 1회', async () => {
    // mapHtml init 경로: relayout 직후 emitBounds() + 60ms 후 재 emitBounds()(동일 viewport)를 모사.
    //   같은 양자화 bbox라 0틱 cleanup + 양자화 키 dedup으로 추가 invoke 0 → 사용자 동작 없이 invoke ≤1.
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 }))); // 명시 emit
    act(() => result.current.setBounds(bounds({ lat: 37.5 }))); // 재 emit(동일 bbox)
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    // 60ms 후 belt-and-suspenders 재 emit이 한 번 더 와도 동일 양자화 키 → 추가 invoke 0.
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('G1 디바운스 수렴: 첫 조회 warm 후 창 내 연속 대이동 3회 → searchNearby 1회만(마지막 bbox)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    // 첫 조회를 미리 소진(warm) — 첫 조회 즉시화로 의미가 바뀌므로 2회차+ 트레일링 수렴을 검증.
    act(() => result.current.setBounds(bounds({ lat: 37.2 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    searchMock.mockClear();
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

  // ── nearby-accumulate 증분 (plan §5 T2·T3·T4·T5) ──────────────────
  it('T2: 성공 응답을 교체가 아니라 누적 합집합으로 반영한다(kakaoPlaceId dedup)', async () => {
    searchMock.mockResolvedValueOnce([item('1'), item('2')]);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['1', '2']);

    // area B: 겹치는 id(2) + 신규(3) → 합집합 [1,2,3](2 미증가, 1 유지)
    searchMock.mockResolvedValueOnce([item('2'), item('3')]);
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['1', '2', '3']);
  });

  it('T3: 캐시 히트도 누적에 합류한다(재방문 area가 기존 누적을 지우지 않음)', async () => {
    searchMock.mockResolvedValueOnce([item('a')]);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    searchMock.mockResolvedValueOnce([item('b')]);
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);

    // area A 재방문 → 캐시 히트(invoke 추가 0), 누적 유지(b 안 사라짐 — 구 교체 정책이면 [a]로 소실).
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('T4: 에러 시 누적을 유지한다(비우지 않음) + status=error', async () => {
    // 먼저 성공 응답으로 누적을 쌓는다.
    searchMock.mockResolvedValueOnce([item('a'), item('b')]);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);

    // 다른 area 조회가 실패 → 누적 유지, status만 error(구 정책의 setItems([]) 팝아웃 제거 — 의도적 변경 §3.4).
    searchMock.mockRejectedValueOnce(new Error('KAKAO_REQUEST_FAILED'));
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(NEARBY_DEBOUNCE_MS);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('T5: 누적이 cap(NEARBY_ACCUM_CAP) 초과 시 오래된 것부터 퇴출한다(길이=cap)', async () => {
    const many = Array.from({ length: NEARBY_ACCUM_CAP + 5 }, (_, i) => item(`p${i}`));
    searchMock.mockResolvedValueOnce(many);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.items).toHaveLength(NEARBY_ACCUM_CAP);
    const accumIds = result.current.items.map((it) => it.kakaoPlaceId);
    expect(accumIds).not.toContain('p0'); // 최고참 퇴출
    expect(accumIds).toContain(`p${NEARBY_ACCUM_CAP + 4}`); // 최신 유지
  });
});
