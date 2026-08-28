// src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts
// 주변 음식점 로딩 상태 기계 — 선로딩·영속 캐시·명시 재검색 (map-pin-loading plan §4.4·§4.5·§5-1, 비용 C1~C9).
//
// ★ 처분표(plan §4.5) 적용 결과: 기존 17행 = `it()` 16건(**존속 10 · 재작성 6**) + import 1행 **교체**.
//   존속 케이스는 단언(=지키던 불변식)을 그대로 두되, 그 중 5건은 **구동 수단**만 바꿨다 —
//   "두 번째 area를 setBounds로 warm한다"는 전제가 이 스프린트에서 폐기됐기 때문이다(자동 조회 삭제).
//   각 케이스 주석에 원 단언과 수단 변경을 남긴다. **완화 0**(단언 수·강도 모두 유지 또는 강화).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../searchNearby', () => ({ searchNearby: jest.fn() }));
// AsyncStorage는 네이티브라 단위 대상이 아니다 — requireActual('../nearbyCache')가 실 모듈을 로드하므로
//   상수(TTL·디바운스·버전)는 실값을 쓰되 저장소만 비운다(load/save는 아래에서 별도 모킹).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../nearbyCache', () => ({
  ...jest.requireActual('../nearbyCache'),
  loadNearbyCache: jest.fn(),
  saveNearbyCache: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';

import { loadNearbyCache, saveNearbyCache, type NearbyCachePayload } from '../nearbyCache';
import { searchNearby } from '../searchNearby';
import { type Bounds } from '../bboxDrift';
import { NEARBY_ACCUM_CAP, NEARBY_HYDRATE_MAX_SPANS, useNearbyPlaces } from './useNearbyPlaces';

const searchMock = searchNearby as jest.Mock;
const loadCacheMock = loadNearbyCache as jest.Mock;
const saveCacheMock = saveNearbyCache as jest.Mock;
const getSessionMock = supabase.auth.getSession as jest.Mock;

// 두 코너 bbox 헬퍼(중심을 dLat/dLng만큼 평행이동, 폭 기본 0.02).
const bounds = ({
  lat = 37.5,
  lng = 127.0,
  span = 0.02,
}: { lat?: number; lng?: number; span?: number } = {}): Bounds => ({
  sw: { lat: lat - span / 2, lng: lng - span / 2 },
  ne: { lat: lat + span / 2, lng: lng + span / 2 },
});

// 훅 내부 양자화(소수 4자리)와 동일한 키 — 캐시 payload를 만들 때 쓴다(하드코딩 금지).
const keyOf = (b: Bounds): string => {
  const round = (n: number): number => Math.round(n * 1e4) / 1e4;
  return `${round(b.sw.lat)},${round(b.sw.lng)},${round(b.ne.lat)},${round(b.ne.lng)}`;
};

const item = (id: string) => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 100,
});

const cachePayload = ({
  areas,
  span = null,
  savedAt = Date.now(),
}: {
  areas: { bounds: Bounds; items: ReturnType<typeof item>[] }[];
  span?: { lat: number; lng: number } | null;
  savedAt?: number;
}): NearbyCachePayload => ({
  version: 1,
  savedAt,
  span,
  areas: areas.map((a) => ({ key: keyOf(a.bounds), bounds: a.bounds, items: a.items })),
});

// 기존 스펙이 "디바운스 창"으로 쓰던 경과 시간 — 폐기된 트레일링 디바운스 상수 대신 로컬 상수로 둔다.
//   의미: "충분한 시간이 흘러도" 추가 invoke가 없음을 보이기 위한 경과값(더 이상 프로덕션 상수가 아니다).
const SETTLE_MS = 500;

/** 하이드레이션(마이크로태스크) + 0틱 타이머 + 응답을 모두 소화한다. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  searchMock.mockReset();
  searchMock.mockResolvedValue([item('1')]);
  loadCacheMock.mockReset();
  loadCacheMock.mockResolvedValue(null);
  saveCacheMock.mockReset();
  saveCacheMock.mockResolvedValue(undefined);
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useNearbyPlaces', () => {
  // #1 재작성 — 원 단언: "setBounds 후 디바운스 1회 호출 → markers ready".
  //   트레일링 디바운스가 사라졌으므로 **0틱 1회**로 강화(더 이르게, 같은 횟수).
  it('선로딩 없이 첫 setBounds → 0틱에 1회 호출 → markers ready(허용분 소비)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.markers.map((m) => m.id)).toEqual(['1']);
    expect(result.current.markers[0].kind).toBe('nearby');
  });

  // #2 존속(무수정) — 첫 조회 즉시성.
  it('T1-a 첫 조회는 0틱(0ms)에 searchNearby 1회 호출 → ready', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.markers.map((m) => m.id)).toEqual(['1']);
    expect(result.current.markers[0].kind).toBe('nearby');
  });

  // #3 존속(무수정) — cleanup 회수 가능성(0틱이라야 T2가 성립).
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

  // #4 재작성 — 원 단언: "두 번째 이동은 트레일링(500ms 후 호출)".
  //   자동 조회 폐기로 **어느 시점에도 호출 0**(더 강함) + 대신 버튼이 켜진다.
  it('T1-c 두 번째 이동은 어느 시점에도 호출 0 — 대신 researchAvailable=true', async () => {
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
    expect(searchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS * 10); // 아무리 기다려도 트레일링 조회가 없다.
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.researchAvailable).toBe(true);
  });

  // #5 재작성 — 원 단언: "첫 조회 후 창 내 연속 대이동 → 총 2회".
  //   이제 추가 invoke **0**(상한 강화) + 버튼 노출.
  it('T1-d 첫 조회 후 연속 대이동 → 추가 invoke 0 · researchAvailable=true', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.setBounds(bounds({ lat: 37.8 })));
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 38.1 })));
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.researchAvailable).toBe(true);
  });

  // #6 존속(무수정) — 허용분 1회 수렴(마지막 bbox).
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

  // #7 존속(필수) — mapHtml의 0ms/60ms 이중 emit이 살아 있다(mapHtml diff 0). 상수 참조만 로컬 상수로 교체.
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
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  // #8 재작성 — 원 단언: "warm 후 연속 대이동 3회 → 1회 수렴".
  //   이제 **0회**(수렴이 아니라 아예 태우지 않음 — 더 강한 가드레일).
  it('G1 warm 후 창 내 연속 대이동 3회 → searchNearby 0회(자동 조회 폐기)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.2 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    searchMock.mockClear();
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 37.8 })));
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS - 100);
    });
    act(() => result.current.setBounds(bounds({ lat: 38.1 })));
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(searchMock).not.toHaveBeenCalled();
  });

  // #9 존속(단언 무변경 · 구동 수단만 research로) — "동일(양자화) bbox 재조회 → 추가 invoke 0".
  //   두 번째 area를 자동 조회로 warm할 수 없게 됐으므로 사용자 액션(research)으로 warm한다. C8도 같이 잠근다.
  it('캐시: 동일(양자화) bbox 재조회 → searchNearby 0회 추가(히트)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    // 멀리 갔다가(버튼 노출) 명시 재검색으로 area B를 warm
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    // 원위치(동일 bbox) → 캐시 히트, 추가 호출 0.
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });

  // #10 재작성 — 원 단언: "미세 이동(임계 미만)은 미호출".
  //   미호출은 이제 전 경로 공통이므로, 원 의도(=미세 이동은 '새 영역'이 아니다)를 **버튼 판정으로 승격**한다.
  it('최소 이동 임계: 미세 이동은 호출도 없고 researchAvailable도 켜지 않는다', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    // 아주 살짝 이동(임계 미만, 양자화 키는 다를 수 있음) → 추가 호출 0 + 버튼 미노출.
    act(() => result.current.setBounds(bounds({ lat: 37.5 + 0.00005 })));
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.researchAvailable).toBe(false);
  });

  // #11 재작성 — 원 단언: "임계 이상 이동 → 호출".
  //   이제 이동만으로는 호출 0이고, **버튼이 켜진 뒤 탭해야** 1회 호출된다(의도 보존 + 경로 명시).
  it('임계 이상 이동 → invoke 0 · researchAvailable=true → research()에서 1회 호출', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    act(() => result.current.setBounds(bounds({ lat: 37.9 })));
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.researchAvailable).toBe(true);
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 37.9 }));
  });

  // #12 존속(단언 무변경 · 구동 수단만 선로딩+보정으로) — 늦게 온 stale 응답 폐기.
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
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await act(async () => {
      jest.advanceTimersByTime(0);
    }); // 첫 요청 pending
    act(() => result.current.setBounds(bounds({ lat: 38.0 }))); // 보정 조회
    await act(async () => {
      jest.advanceTimersByTime(0);
    }); // 둘째 → [second]
    await act(async () => {
      resolveFirst([item('first')]); // 늦은 첫 응답
    });
    expect(result.current.markers.map((m) => m.id)).toEqual(['second']);
  });

  // ── nearby-accumulate 증분 (존속 T2~T5) ──────────────────
  // #13 존속(단언 무변경 · area B를 research로 warm).
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
      result.current.research();
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['1', '2', '3']);
  });

  // #14 존속(단언 무변경 · 구동 수단만 research).
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
      result.current.research();
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);

    // area A 재방문 → 캐시 히트(invoke 추가 0), 누적 유지(b 안 사라짐 — 구 교체 정책이면 [a]로 소실).
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  // #15 존속(단언 무변경 · 실패 area를 research로 조회).
  it('T4: 에러 시 누적을 유지한다(비우지 않음) + status=error', async () => {
    searchMock.mockResolvedValueOnce([item('a'), item('b')]);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);

    // 다른 area 조회가 실패 → 누적 유지, status만 error(팝아웃 없음).
    searchMock.mockRejectedValueOnce(new Error('KAKAO_REQUEST_FAILED'));
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      result.current.research();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.markers.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  // #16 존속(무수정).
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

describe('하이드레이션 (A3-1·A3-2·A3-12)', () => {
  it('A3-1 캐시 area 2건이면 마운트 후 items가 합집합이 되고 searchNearby 호출 0', async () => {
    loadCacheMock.mockResolvedValue(
      cachePayload({
        areas: [
          { bounds: bounds({ lat: 37.5 }), items: [item('a')] },
          { bounds: bounds({ lat: 37.51 }), items: [item('a'), item('b')] },
        ],
      }),
    );
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    expect(result.current.items.map((it) => it.kakaoPlaceId).sort()).toEqual(['a', 'b']);
    expect(result.current.status).toBe('ready');
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('A3-2 하이드레이션 resolve 전에 preload를 호출해도 캐시 히트면 invoke 0(순서 뒤집힘 방지) — M2', async () => {
    const bbox = bounds({ lat: 37.5 });
    loadCacheMock.mockResolvedValue(cachePayload({ areas: [{ bounds: bbox, items: [item('a')] }] }));
    const { result } = renderHook(() => useNearbyPlaces());
    // 하이드레이션을 기다리지 않고 즉시 선로딩 요청(화면 마운트 effect와 같은 타이밍).
    act(() => result.current.preload({ bbox }));
    await settle();
    expect(searchMock).not.toHaveBeenCalled();
    expect(result.current.items.map((it) => it.kakaoPlaceId)).toEqual(['a']);
  });

  it('A3-12 첫 bbox 중심에서 span 3배 밖 area는 prune되어 items에 포함되지 않는다 — M8', async () => {
    const near = bounds({ lat: 37.5 });
    const far = bounds({ lat: 37.5 + 0.02 * (NEARBY_HYDRATE_MAX_SPANS + 1) });
    loadCacheMock.mockResolvedValue(
      cachePayload({
        areas: [
          { bounds: far, items: [item('far') as never] },
          { bounds: near, items: [item('near') as never] },
        ],
      }),
    );
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    // 하이드레이션 직후엔 둘 다 있다(아직 첫 bbox가 확정되지 않았다).
    expect(result.current.items.map((it) => it.kakaoPlaceId).sort()).toEqual(['far', 'near']);
    act(() => result.current.preload({ bbox: near }));
    await settle();
    expect(result.current.items.map((it) => it.kakaoPlaceId)).toEqual(['near']);
    expect(searchMock).not.toHaveBeenCalled(); // near는 캐시 히트라 invoke 0
  });

  // qa-logic L4 — A3-12는 lat으로만 멀어져서 prune의 lng 축(`farLng`)이 하중을 받지 못했다.
  //   실제 이동은 경도로 멀어지는 쪽이 흔하다(서울 127.0 → 강릉 128.9).
  it('A3-12 경도로 span 3배 밖인 area도 prune된다(lng 축 하중) — L4', async () => {
    const near = bounds({ lat: 37.5, lng: 127.0 });
    const far = bounds({ lat: 37.5, lng: 127.0 + 0.02 * (NEARBY_HYDRATE_MAX_SPANS + 1) });
    loadCacheMock.mockResolvedValue(
      cachePayload({
        areas: [
          { bounds: far, items: [item('far') as never] },
          { bounds: near, items: [item('near') as never] },
        ],
      }),
    );
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    expect(result.current.items.map((it) => it.kakaoPlaceId).sort()).toEqual(['far', 'near']);
    act(() => result.current.preload({ bbox: near }));
    await settle();
    expect(result.current.items.map((it) => it.kakaoPlaceId)).toEqual(['near']);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('캐시가 관측한 span이 있으면 선로딩 bbox를 그 폭으로 재구성한다(폴백 근사 대체)', async () => {
    loadCacheMock.mockResolvedValue(cachePayload({ areas: [], span: { lat: 0.05, lng: 0.05 } }));
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5, span: 0.02 }) }));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    const rect = searchMock.mock.calls[0][0] as Bounds;
    expect(rect.ne.lat - rect.sw.lat).toBeCloseTo(0.05, 6);
  });

  it('세션 없음(userId 미확보)이면 캐시를 읽지도 쓰지도 않는다(E5·E6)', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(loadCacheMock).not.toHaveBeenCalled();
    expect(saveCacheMock).not.toHaveBeenCalled();
  });

  it('getSession이 throw해도 조회는 정상 진행된다(무음 폴백)', async () => {
    getSessionMock.mockRejectedValue(new Error('session down'));
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
  });
});

describe('선로딩 · 보정 · 허용분 (A3-3·A3-4·A3-9·A3-10·A3-14)', () => {
  it('A3-3 캐시 miss + preload → 0틱에 searchNearby 1회, 인자는 boundsToRect(bbox)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    const bbox = bounds({ lat: 37.5 });
    act(() => result.current.preload({ bbox }));
    expect(searchMock).not.toHaveBeenCalled(); // 0틱 전
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenLastCalledWith({ sw: bbox.sw, ne: bbox.ne });
  });

  it('A3-4 선로딩 후 임계 초과 setBounds 3회 연속 → 추가 invoke 0(타이머 소진 후에도) — M1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    // 첫 setBounds는 보정 판정을 소진한다(같은 bbox라 보정 없음).
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    searchMock.mockClear();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    act(() => result.current.setBounds(bounds({ lat: 38.5 })));
    act(() => result.current.setBounds(bounds({ lat: 39.0 })));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('A3-5 임계 초과 이동은 researchAvailable=true, 임계 미만만이면 false', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    expect(result.current.researchAvailable).toBe(false);
    act(() => result.current.setBounds(bounds({ lat: 37.5 + 0.001 })));
    expect(result.current.researchAvailable).toBe(false);
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    expect(result.current.researchAvailable).toBe(true);
  });

  it('A3-9 선로딩 bbox와 임계 초과로 다른 INIT bbox면 1회 보정, 그 뒤 임계 초과 이동은 0회 — M9', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.setBounds(bounds({ lat: 38.0 }))); // 임계 초과 INIT bbox
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 38.0 }));
    // 보정은 1회권 — 이후 임계 초과 이동은 자동 조회를 되살리지 않는다.
    act(() => result.current.setBounds(bounds({ lat: 39.0 })));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('A3-10 첫 진입 어떤 경로에서도 사용자 액션 없는 invoke는 최대 2회', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    // INIT 이중 emit + 사용자 팬 다발까지 전부 태워도 상한을 넘지 않는다.
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await settle();
    for (let i = 0; i < 10; i += 1) {
      act(() => result.current.setBounds(bounds({ lat: 38.5 + i * 0.5 })));
    }
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(searchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  // qa-logic L1 회귀 — 하이드레이션(getSession+AsyncStorage)이 프리워밍된 WebView의 READY보다 느리면
  //   "선로딩 큐잉 → 첫 BOUNDS_CHANGED가 먼저 → 하이드레이션 완료 → 늦게 깨어난 선로딩"이 실제로 성립한다.
  //   기존 A3-10은 항상 하이드레이션을 먼저 끝내고 preload를 불러 이 순서를 지나지 않았고, 그 사이로
  //   자동 invoke 3회(실측 1 + 추정 1 + 보정 1)가 샜다. 이 케이스가 그 순서를 그대로 잠근다.
  it('A3-10 하이드레이션이 늦고 첫 BOUNDS_CHANGED가 먼저 와도 자동 invoke ≤2 — L1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    // 1) 하이드레이션 resolve 전에 선로딩 요청(화면 마운트 effect 타이밍) → 큐잉된다.
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    // 2) 프리워밍 WebView가 먼저 READY → 실측 뷰포트가 하이드레이션보다 빨리 도착.
    act(() => result.current.setBounds(bounds({ lat: 37.52 })));
    // 3) 하이드레이션 완료 → 큐잉된 선로딩이 깨어나는 시점.
    await settle();
    // 4) 관성·relayout 정착(사용자 액션 아님).
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(searchMock.mock.calls.length).toBeLessThanOrEqual(2);
    // 실측 뷰포트로만 조회한다 — 지도가 보고 있지도 않은 추정 bbox(sw 37.49)는 쏘지 않는다.
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect((searchMock.mock.calls[0][0] as Bounds).sw.lat).toBeCloseTo(37.51, 6);
  });

  it('A3-14 선로딩 in-flight(0틱 미발사) 중 언마운트 → invoke 0(타이머 회수)', async () => {
    const { result, unmount } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds() }));
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('M11 preload 2회차 이후는 no-op(좌표 승격으로 재호출돼도 invoke 순증 0)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    // ⚠ 하이드레이션 **전에** 두 번 부른다 — 뒤에서 부르면 첫 preload가 이미 허용분을 소비해
    //   L1 가드가 둘째를 대신 막고, 정작 검증 대상인 preloadCalledRef가 하중을 잃는다(qa-logic L3).
    //   이 순서에서만 "pendingPreloadRef가 둘째 bbox로 덮어써지는가"를 볼 수 있다.
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    act(() => result.current.preload({ bbox: bounds({ lat: 38.5 }) }));
    await settle();
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 37.5 })); // 첫 bbox가 이긴다(A4-1 계약)
  });
});

describe('명시 재검색 (A3-6·A3-7·A3-8)', () => {
  it('A3-6 research() → 1회 invoke → 성공 후 researchAvailable=false(자동 소멸)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    expect(result.current.researchAvailable).toBe(true);
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.researchAvailable).toBe(false);
  });

  it('A3-7 in-flight 중 research()를 3회 더 호출해도 추가 invoke 0 · 버튼은 숨는다 — M3', async () => {
    let resolveSearch: (v: unknown) => void = () => {};
    searchMock.mockResolvedValueOnce([item('a')]); // 첫 조회는 정상 완료(기준선 확보)
    searchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    // ⚠ 드리프트가 살아 있는 상태에서 눌러야 한다 — 같은 자리에서 누르면 drift 0이라
    //   "조회 중이라 숨었는지"와 "이동이 없어 숨었는지"가 구분되지 않아 loading 조건이 하중을 잃는다(M3).
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    expect(result.current.researchAvailable).toBe(true);

    act(() => {
      result.current.research();
      result.current.research();
      result.current.research();
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2); // 첫 조회 1 + 연타 4회가 1회로 수렴
    // 조회 중엔 버튼을 숨긴다(스피너가 아니라 미노출로 상태 수를 줄인다) — 이동은 그대로 임계 초과다.
    expect(result.current.researchAvailable).toBe(false);
    await act(async () => {
      resolveSearch([item('1')]);
    });
  });

  it('A3-8 research() 실패 → items 불변 · status=error · researchAvailable 유지 → 재탭 시 1회 더 — M4', async () => {
    searchMock.mockResolvedValueOnce([item('a')]);
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    expect(result.current.researchAvailable).toBe(true);

    searchMock.mockRejectedValueOnce(new Error('KAKAO_REQUEST_FAILED'));
    await act(async () => {
      result.current.research();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.items.map((it) => it.kakaoPlaceId)).toEqual(['a']);
    expect(result.current.researchAvailable).toBe(true); // 실패는 lastQueried를 갱신하지 않는다.

    searchMock.mockResolvedValueOnce([item('b')]);
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(3);
    expect(result.current.items.map((it) => it.kakaoPlaceId).sort()).toEqual(['a', 'b']);
  });

  // ── map-feedback U4: 첫 조회 실패의 복구 경로 (plan §3.2·§5-1) ──────────────────────
  //   첫 조회가 실패하면 lastQueried가 영원히 null이고 팬·줌 자동 조회도 없어, 그 세션에서 주변 핀을
  //   볼 방법이 사라졌다(원칙 10·3 위반). status==='error'를 노출 경로로 추가해 복구 어포던스를 연다.
  it('U4-1 첫 조회가 실패하고 뷰포트를 받으면 재검색 버튼이 뜬다(복구 경로 — 기존엔 영영 안 떴다)', async () => {
    searchMock.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();

    expect(result.current.status).toBe('error');
    // 적용된 area가 0건이라 임계 비교 기준선이 없다 — 그래도(그렇기 때문에) 버튼은 떠야 한다.
    expect(result.current.researchAvailable).toBe(true);
  });

  it('U4-2 그 버튼 탭 → 1회 재조회 · 성공하면 핀이 채워지고 버튼은 스스로 숨는다(자기치유)', async () => {
    searchMock.mockRejectedValueOnce(new Error('net'));
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    expect(result.current.researchAvailable).toBe(true);

    searchMock.mockResolvedValueOnce([item('b')]);
    await act(async () => {
      result.current.research();
    });

    expect(searchMock).toHaveBeenCalledTimes(2); // 자동 재시도 0 — 사용자 탭 경로만 열린다
    expect(result.current.items.map((it) => it.kakaoPlaceId)).toEqual(['b']);
    expect(result.current.status).toBe('ready');
    // 성공이 lastQueried를 현재 뷰포트로 올려 drift 0 → 별도 상태 없이 버튼이 사라진다.
    expect(result.current.researchAvailable).toBe(false);
  });

  it('U4-3 실패했어도 뷰포트 미수신이면 버튼은 뜨지 않는다(눌러도 no-op인 버튼 0)', async () => {
    // currentBounds는 두 경로(에러 복구·드리프트)의 **공통 전제**다 — research()가 currentBoundsRef null이면
    //   no-op이라, 에러 절 안으로 옮기면 여기서 "눌러도 아무 일도 안 하는 버튼"이 뜬다(뮤턴트 → red).
    searchMock.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();

    expect(result.current.status).toBe('error');
    expect(result.current.researchAvailable).toBe(false);
  });

  // qa-logic L2 재작성(map-feedback §3.2) — 원 케이스(첫 조회 실패 + 뷰포트 수신)는 U4-1이 정반대 결과를
  //   요구하므로 그대로 둘 수 없다. 같은 conjunct(lastQueried !== null)에 **다른 방식으로** 하중을 옮긴다.
  //   ⚠️ 타이머를 흘리면 status가 'loading'이 되어 다른 conjunct가 대신 false를 만든다(하중 소실) →
  //      0틱 flush 전 구간을 보기 위해 수동 제어한다. 뮤턴트: lastQueried 절을 지우면 null 참조로 red.
  it('A2 적용된 area가 없으면 뷰포트를 받아도 false — 0틱 발사 전 구간(lastQueried 조건 하중)', async () => {
    // 하이드레이션으로 status는 'ready'지만 lastQueried는 아직 null인 구간(에러도 로딩도 아니다).
    const hydrated = bounds({ lat: 37.5 });
    loadCacheMock.mockResolvedValue(
      cachePayload({ areas: [{ bounds: hydrated, items: [item('a')] }] }),
    );
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    expect(result.current.status).toBe('ready');

    // 하이드레이션 area와 키가 다른 뷰포트 → 캐시 히트 없이 0틱 조회만 예약된다(아직 loading 아님).
    act(() => result.current.setBounds(bounds({ lat: 37.51 })));

    expect(result.current.status).toBe('ready');
    expect(result.current.researchAvailable).toBe(false);
  });

  it('뷰포트 미수신이면 선로딩이 성공해도 researchAvailable=false(눌러도 no-op인 버튼 방지)', async () => {
    // 선로딩만 성공하고 BOUNDS_CHANGED 전인 구간. 여기서 버튼이 뜨면 research()가 currentBounds null로
    //   no-op이라 "눌러도 아무 일도 안 일어나는 버튼"이 된다.
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.current.researchAvailable).toBe(false);
  });

  it('뷰포트를 한 번도 받지 못했으면 research()는 no-op(호출 0)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe('캐시 쓰기 (A3-11·A3-13)', () => {
  it('A3-13 조회 성공 3회 연속 → saveNearbyCache 1회(2s 후)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      result.current.research();
    });
    act(() => result.current.setBounds(bounds({ lat: 38.5 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(3);
    expect(saveCacheMock).not.toHaveBeenCalled(); // 아직 디바운스 창 안
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock.mock.calls[0][0].payload.areas).toHaveLength(3);
  });

  it('A3-13 언마운트 시 대기 중 쓰기는 flush된다(취소 아님) — M12', async () => {
    const { result, unmount } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    expect(saveCacheMock).not.toHaveBeenCalled();
    unmount();
    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock.mock.calls[0][0].userId).toBe('u1');
  });

  // qa-logic L5 — 퇴화(0폭) 뷰포트의 span을 캐시에 박으면 다음 세션 선로딩이 0폭 bbox로 조회한다.
  //   첫 emit이 relayout 직전에 튀는 등 실제로 0폭이 올 수 있어 기록 자체를 막는다(기록 1회권은 소진).
  it('퇴화(0폭) 뷰포트의 span은 캐시에 기록하지 않는다 — L5', async () => {
    const degenerate: Bounds = { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.5, lng: 127.0 } };
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(degenerate));
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(saveCacheMock).toHaveBeenCalled();
    expect(saveCacheMock.mock.calls[0][0].payload.span).toBeNull();
  });

  it('A3-11 세션 첫 setBounds의 span만 payload에 기록된다', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5, span: 0.02 })));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5, span: 0.5 }))); // 사용자 줌아웃
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(saveCacheMock).toHaveBeenCalled();
    const { span } = saveCacheMock.mock.calls[0][0].payload;
    expect(span.lat).toBeCloseTo(0.02, 6);
    expect(span.lng).toBeCloseTo(0.02, 6);
  });
});

describe('비용 가드레일 C1~C9 (invoke 상한을 테스트가 강제)', () => {
  it('C1 캐시 hit 재진입 + 선로딩 → invoke 0', async () => {
    const bbox = bounds({ lat: 37.5 });
    loadCacheMock.mockResolvedValue(cachePayload({ areas: [{ bounds: bbox, items: [item('a')] }] }));
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.preload({ bbox }));
    await settle();
    act(() => result.current.setBounds(bbox));
    await settle();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('C2 캐시 miss + 선로딩 + INIT bbox 임계 미만 → invoke 1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5 + 0.002 })));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('C3 캐시 miss + 선로딩 스킵(신호 없음) → 첫 bounds에서 invoke 1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('C4 캐시 miss + 선로딩 + INIT bbox 임계 초과(보정) → invoke 2(유일한 순증 경로·상한)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    await settle();
    act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('C5 임의 진입 후 팬·줌 10회 → 추가 invoke 0', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    searchMock.mockClear();
    for (let i = 0; i < 10; i += 1) {
      act(() => result.current.setBounds(bounds({ lat: 37.5 + i * 0.3, span: 0.02 + i * 0.01 })));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('C6 팬 10회 후 버튼 1탭 → 추가 invoke 1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    searchMock.mockClear();
    for (let i = 0; i < 10; i += 1) {
      act(() => result.current.setBounds(bounds({ lat: 37.5 + (i + 1) * 0.3 })));
    }
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('C7 버튼 연타 5회(in-flight) → invoke 1', async () => {
    searchMock.mockImplementation(() => new Promise(() => {})); // 영원히 pending
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    act(() => {
      result.current.research();
      result.current.research();
      result.current.research();
      result.current.research();
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('C8 같은 area로 되돌아와 버튼 탭 → 추가 invoke 0(양자화 캐시 히트)', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await settle();
    act(() => result.current.setBounds(bounds({ lat: 38.0 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      result.current.research();
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('C9 첫 emit + 60ms 재emit(mapHtml 이중 emit) → invoke 1', async () => {
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    await act(async () => {
      jest.advanceTimersByTime(60);
    });
    act(() => result.current.setBounds(bounds({ lat: 37.5 })));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
  });
});

describe('계측 배선 (W0 A0-2)', () => {
  it('조회 1회에 invoke:start·invoke:end가 각각 1건 기록된다(__DEV__ 번들)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { result } = renderHook(() => useNearbyPlaces());
    act(() => result.current.setBounds(bounds()));
    await settle();
    const events = logSpy.mock.calls.map((c) => String(c[0]));
    expect(events.filter((e) => e.includes('invoke:start'))).toHaveLength(1);
    expect(events.filter((e) => e.includes('invoke:end'))).toHaveLength(1);
    const endCall = logSpy.mock.calls.find((c) => String(c[0]).includes('invoke:end'));
    expect(endCall?.[1]).toMatchObject({ count: 1, ok: true });
    logSpy.mockRestore();
  });
});
