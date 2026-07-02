// src/features/map/initialRegion.spec.ts
// 초기 지도 영역 계산 단위 테스트 (plan §3.4·§5-1 initialRegion).
//   coords 우선 / coords null+핀 다수→bbox 중심 / 핀 1개→그 핀(0폭 안전) / 둘 다 없으면 DEFAULT_REGION.
import { DEFAULT_REGION, initialRegion } from './initialRegion';
import { type MuklogPin } from '../types';

const pin = (lat: number, lng: number): MuklogPin => ({
  muklogId: `m${lat}`,
  roomId: 'r1',
  placeName: '가게',
  category: null,
  area: null,
  rating: null,
  lat,
  lng,
});

describe('initialRegion', () => {
  it('coords가 있으면 coords 중심을 쓴다(핀 유무 무관)', () => {
    const region = initialRegion({
      coords: { lat: 35.1, lng: 129.0 },
      pins: [pin(37.5, 127.0)],
    });
    expect(region.lat).toBe(35.1);
    expect(region.lng).toBe(129.0);
  });

  it('coords가 null이고 핀이 여러 개면 bbox 중심을 쓴다', () => {
    const region = initialRegion({
      coords: null,
      pins: [pin(37.0, 127.0), pin(38.0, 128.0)],
    });
    expect(region.lat).toBe(37.5);
    expect(region.lng).toBe(127.5);
  });

  it('coords가 null이고 핀이 1개면 그 핀 중심을 쓴다(0폭 bbox 안전)', () => {
    const region = initialRegion({ coords: null, pins: [pin(37.5665, 126.978)] });
    expect(region.lat).toBe(37.5665);
    expect(region.lng).toBe(126.978);
  });

  it('coords도 핀도 없으면 DEFAULT_REGION(서울시청)을 쓴다', () => {
    const region = initialRegion({ coords: null, pins: [] });
    expect(region).toEqual(DEFAULT_REGION);
  });

  it('DEFAULT_REGION은 유효한 서울 좌표·zoom을 갖는다', () => {
    expect(DEFAULT_REGION.lat).toBeGreaterThan(37);
    expect(DEFAULT_REGION.lat).toBeLessThan(38);
    expect(DEFAULT_REGION.lng).toBeGreaterThan(126);
    expect(DEFAULT_REGION.lng).toBeLessThan(128);
    expect(DEFAULT_REGION.zoom).toBeGreaterThan(0);
  });
});
