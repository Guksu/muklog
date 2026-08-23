// src/features/map/nearbyCache/nearbyCache.spec.ts
// 주변 핀 로컬 캐시 — userId 격리·버전·TTL 부분 폐기·조용한 miss (map-pin-loading plan §4.3·W1 A1-1~A1-6, M6·M7).
//   pinsCache.spec의 케이스 구조를 미러한다(계정 격리가 이 스프린트의 유일한 보안면 — B3).
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...a: unknown[]) => mockSetItem(...a),
    getItem: (...a: unknown[]) => mockGetItem(...a),
  },
}));

import { pinsCacheKey } from '../pinsCache';
import { type NearbyPlaceItem } from '../types';

import {
  NEARBY_CACHE_AREA_CAP,
  NEARBY_CACHE_TTL_MS,
  NEARBY_CACHE_VERSION,
  NEARBY_CACHE_WRITE_DEBOUNCE_MS,
  loadNearbyCache,
  nearbyCacheKey,
  saveNearbyCache,
  type NearbyCacheArea,
  type NearbyCachePayload,
} from './nearbyCache';

const item = (id: string): NearbyPlaceItem => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 100,
});

const area = (over?: Partial<NearbyCacheArea>): NearbyCacheArea => ({
  key: '37.49,126.99,37.51,127.01',
  bounds: { sw: { lat: 37.49, lng: 126.99 }, ne: { lat: 37.51, lng: 127.01 } },
  items: [item('1')],
  ...over,
});

const payload = (over?: Partial<NearbyCachePayload>): NearbyCachePayload => ({
  version: NEARBY_CACHE_VERSION,
  savedAt: Date.now(),
  span: { lat: 0.02, lng: 0.02 },
  areas: [area()],
  ...over,
});

// 인메모리 스토어로 실제 AsyncStorage 왕복을 흉내 — save→load·계정 격리 검증용(pinsCache.spec 선례).
const store = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockSetItem.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  mockGetItem.mockImplementation(async (key: string) => store.get(key) ?? null);
});

describe('nearbyCache 키·상수 (A1-6)', () => {
  it('A1-6 키는 muklog:map-nearby:v1:{userId}이며 pinsCacheKey와 충돌하지 않는다', () => {
    expect(nearbyCacheKey({ userId: 'u1' })).toBe(`muklog:map-nearby:v${NEARBY_CACHE_VERSION}:u1`);
    expect(NEARBY_CACHE_VERSION).toBe(1);
    expect(nearbyCacheKey({ userId: 'u1' })).not.toBe(pinsCacheKey({ userId: 'u1' }));
  });

  it('상수는 이 모듈이 단일 출처다(TTL 24h · area cap 8 · 쓰기 디바운스 2s)', () => {
    expect(NEARBY_CACHE_TTL_MS).toBe(86_400_000);
    expect(NEARBY_CACHE_AREA_CAP).toBe(8);
    expect(NEARBY_CACHE_WRITE_DEBOUNCE_MS).toBe(2000);
  });
});

describe('nearbyCache 왕복 (A1-1·A1-4·A1-5)', () => {
  it('save→load 왕복 — 저장한 payload를 그대로 복원한다', async () => {
    const p = payload();
    await saveNearbyCache({ userId: 'u1', payload: p });
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toEqual(p);
  });

  it('A1-1 빈 userId면 read/write 모두 no-op(스토리지 미접촉) — M6', async () => {
    await expect(loadNearbyCache({ userId: '' })).resolves.toBeNull();
    expect(mockGetItem).not.toHaveBeenCalled();

    await saveNearbyCache({ userId: '', payload: payload() });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('A1-4 계정 격리 — A로 저장한 캐시를 B로 조회하면 null(교차 노출 0) — M6', async () => {
    await saveNearbyCache({ userId: 'A', payload: payload() });
    await expect(loadNearbyCache({ userId: 'A' })).resolves.not.toBeNull();
    await expect(loadNearbyCache({ userId: 'B' })).resolves.toBeNull();
  });

  it('A1-5 setItem이 reject해도 save는 throw하지 않는다(best-effort)', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('storage full'));
    await expect(saveNearbyCache({ userId: 'u1', payload: payload() })).resolves.toBeUndefined();
  });

  it('빈 areas[] 경계 — 왕복해도 빈 배열을 복원한다(에러 아님)', async () => {
    await saveNearbyCache({ userId: 'u1', payload: payload({ areas: [] }) });
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded?.areas).toEqual([]);
  });

  it('area cap 초과분은 저장 시 가장 오래된 것부터 퇴출된다(≈24KB 상한 유지)', async () => {
    const many = Array.from({ length: NEARBY_CACHE_AREA_CAP + 3 }, (_, i) =>
      area({ key: `k${i}`, items: [item(`i${i}`)] }),
    );
    await saveNearbyCache({ userId: 'u1', payload: payload({ areas: many }) });
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded?.areas).toHaveLength(NEARBY_CACHE_AREA_CAP);
    expect(loaded?.areas.map((a) => a.key)).not.toContain('k0'); // 최고참 퇴출
    expect(loaded?.areas.map((a) => a.key)).toContain(`k${NEARBY_CACHE_AREA_CAP + 2}`); // 최신 유지
  });
});

describe('nearbyCache 조용한 miss (A1-2)', () => {
  it('키 없음(miss)이면 null', async () => {
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('JSON 파싱 실패면 null(throw 안 함)', async () => {
    store.set(nearbyCacheKey({ userId: 'u1' }), '{not json');
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('버전 불일치면 null(구 캐시 자동 무시)', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify({ ...payload(), version: NEARBY_CACHE_VERSION + 1 }),
    );
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('areas가 배열이 아니면 null', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify({ ...payload(), areas: 'nope' }),
    );
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('area 형(키·bounds 유한수·items 배열) 위반이면 null', async () => {
    const bad = [
      { ...area(), key: 7 },
      { ...area(), bounds: { sw: { lat: 'x', lng: 126.9 }, ne: { lat: 37.5, lng: 127 } } },
      { ...area(), bounds: { sw: { lat: 37.4, lng: 126.9 } } },
      { ...area(), items: 'nope' },
    ];
    for (const broken of bad) {
      store.set(nearbyCacheKey({ userId: 'u1' }), JSON.stringify({ ...payload(), areas: [broken] }));
      await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
    }
  });

  it('item 최소형(kakaoPlaceId·lat·lng) 위반이면 null', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify({
        ...payload(),
        areas: [area({ items: [{ kakaoPlaceId: 'k1', lat: 'x', lng: 127 } as never] })],
      }),
    );
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('getItem이 throw해도 null로 흡수한다(절대 throw 안 함)', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('savedAt이 숫자가 아니면(NaN 포함) miss — E18', async () => {
    store.set(nearbyCacheKey({ userId: 'u1' }), JSON.stringify({ ...payload(), savedAt: 'x' }));
    await expect(loadNearbyCache({ userId: 'u1' })).resolves.toBeNull();
  });

  it('span이 형 불량이면 areas는 살리고 span만 null로 떨군다(전체 miss 아님)', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify({ ...payload(), span: { lat: 'x', lng: 0.02 } }),
    );
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded?.span).toBeNull();
    expect(loaded?.areas).toHaveLength(1);
  });
});

describe('nearbyCache TTL (A1-3, M7)', () => {
  it('A1-3 TTL 초과면 areas는 폐기하되 span은 보존한다(부분 폐기 ≠ miss) — M7', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify(payload({ savedAt: Date.now() - NEARBY_CACHE_TTL_MS - 1 })),
    );
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded).not.toBeNull();
    expect(loaded?.areas).toEqual([]);
    expect(loaded?.span).toEqual({ lat: 0.02, lng: 0.02 });
  });

  it('TTL 이내면 areas가 그대로 살아 있다', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify(payload({ savedAt: Date.now() - NEARBY_CACHE_TTL_MS + 60_000 })),
    );
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded?.areas).toHaveLength(1);
  });

  it('E18 savedAt이 미래(시계 조작)여도 만료로 보지 않는다', async () => {
    store.set(
      nearbyCacheKey({ userId: 'u1' }),
      JSON.stringify(payload({ savedAt: Date.now() + 10 * NEARBY_CACHE_TTL_MS })),
    );
    const loaded = await loadNearbyCache({ userId: 'u1' });
    expect(loaded?.areas).toHaveLength(1);
  });
});
