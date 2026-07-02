// src/features/map/pinsCache/pinsCache.spec.ts
// 먹로그 핀 로컬 캐시 단위 테스트 (map-pins-cache plan §5 T1·T2, §5-1, §7 보안 경계면).
//   save→load 왕복·빈 pins[] 경계·miss/파싱실패/버전불일치/형불량 → null(throw 0)·계정 격리(A키↔B조회)·빈 userId no-op.
//   AsyncStorage는 네이티브라 단위 대상 아님 → 상태 있는 인메모리 모킹으로 직렬화/키 계약만 검증(pendingPick 패턴 계승).
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...a: unknown[]) => mockSetItem(...a),
    getItem: (...a: unknown[]) => mockGetItem(...a),
  },
}));

import {
  PINS_CACHE_VERSION,
  pinsCacheKey,
  loadCachedPins,
  saveCachedPins,
} from './pinsCache';
import { type MuklogPin } from '../types';

const pin = (over?: Partial<MuklogPin>): MuklogPin => ({
  muklogId: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

// 인메모리 스토어로 실제 AsyncStorage 왕복을 흉내 — save→load·계정 격리 검증용.
const store = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockSetItem.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  mockGetItem.mockImplementation(async (key: string) => store.get(key) ?? null);
});

describe('pinsCache (T1·T2)', () => {
  it('pinsCacheKey는 muklog:map-pins:v{버전}:{userId} 형식을 만든다', () => {
    expect(pinsCacheKey({ userId: 'u1' })).toBe(`muklog:map-pins:v${PINS_CACHE_VERSION}:u1`);
    expect(PINS_CACHE_VERSION).toBe(1);
  });

  it('saveCachedPins는 {version:1, pins}를 키에 직렬화 저장한다', async () => {
    const pins = [pin(), pin({ muklogId: 'm2' })];
    await saveCachedPins({ userId: 'u1', pins });
    expect(mockSetItem).toHaveBeenCalledWith(
      pinsCacheKey({ userId: 'u1' }),
      JSON.stringify({ version: 1, pins }),
    );
  });

  it('save→load 왕복 — 저장한 핀을 그대로 복원한다', async () => {
    const pins = [pin(), pin({ muklogId: 'm2', category: null, area: null, rating: null })];
    await saveCachedPins({ userId: 'u1', pins });
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toEqual(pins);
  });

  it('빈 pins[] 경계 — 왕복해도 빈 배열을 복원한다(에러 아님)', async () => {
    await saveCachedPins({ userId: 'u1', pins: [] });
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toEqual([]);
  });

  it('키 없음(miss)이면 null', async () => {
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('JSON 파싱 실패면 null(throw 안 함)', async () => {
    store.set(pinsCacheKey({ userId: 'u1' }), '{not json');
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('버전 불일치면 null(구 캐시 자동 무시)', async () => {
    store.set(
      pinsCacheKey({ userId: 'u1' }),
      JSON.stringify({ version: PINS_CACHE_VERSION + 1, pins: [pin()] }),
    );
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('pins가 배열이 아니면 null', async () => {
    store.set(pinsCacheKey({ userId: 'u1' }), JSON.stringify({ version: 1, pins: 'nope' }));
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('핀 최소형(muklogId·lat·lng) 불량이면 null', async () => {
    store.set(
      pinsCacheKey({ userId: 'u1' }),
      JSON.stringify({ version: 1, pins: [{ muklogId: 'm1', lat: 'x', lng: 127 }] }),
    );
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('getItem이 throw해도 null로 흡수한다(절대 throw 안 함)', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(loadCachedPins({ userId: 'u1' })).resolves.toBeNull();
  });

  it('계정 격리 — userId A로 저장한 캐시를 B로 조회하면 null(교차 노출 0)', async () => {
    await saveCachedPins({ userId: 'A', pins: [pin()] });
    await expect(loadCachedPins({ userId: 'A' })).resolves.toEqual([pin()]);
    await expect(loadCachedPins({ userId: 'B' })).resolves.toBeNull();
  });

  it('빈 userId면 read/write 모두 no-op(스토리지 미접촉)', async () => {
    await expect(loadCachedPins({ userId: '' })).resolves.toBeNull();
    expect(mockGetItem).not.toHaveBeenCalled();

    await saveCachedPins({ userId: '', pins: [pin()] });
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
