// src/features/map/nearbyPreloadBbox/nearbyPreloadBbox.spec.ts
// 선로딩 bbox 추정 — 지도 부팅 전에 "지도가 그려질 자리"를 계산한다 (map-pin-loading plan §4.2·W2 A2-4·A2-5, B5).
//   센터 우선순위가 initialRegion과 **어긋나면** 선로딩이 지도와 다른 동네를 미리 받는다 → 같은 표를 양쪽에서 단언한다.
import { initialRegion } from '../initialRegion';
import { type MuklogPin } from '../types';

import { NEARBY_FALLBACK_SPAN, nearbyPreloadBbox } from './nearbyPreloadBbox';

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

const span = { lat: 0.02, lng: 0.02 };

describe('nearbyPreloadBbox (A2-4·A2-5)', () => {
  it('폴백 span은 이 모듈이 단일 출처다(level 5 근사, §10 D1 이월 교정 대상)', () => {
    expect(NEARBY_FALLBACK_SPAN).toEqual({ lat: 0.018, lng: 0.022 });
  });

  it('A2-4 coords가 있으면 그 좌표를 중심으로 span/2씩 벌린 bbox', () => {
    const bbox = nearbyPreloadBbox({ coords: { lat: 37.5, lng: 127.0 }, pins: [], span });
    expect(bbox).toEqual({
      sw: { lat: 37.49, lng: 126.99 },
      ne: { lat: 37.51, lng: 127.01 },
    });
  });

  it('A2-4 coords가 없고 핀이 있으면 핀 bbox 중심', () => {
    const bbox = nearbyPreloadBbox({
      coords: null,
      pins: [pin({ lat: 37.4, lng: 126.9 }), pin({ muklogId: 'm2', lat: 37.6, lng: 127.1 })],
      span,
    });
    expect(bbox?.sw).toEqual({ lat: 37.49, lng: 126.99 });
    expect(bbox?.ne).toEqual({ lat: 37.51, lng: 127.01 });
  });

  it('A2-4 coords·핀 둘 다 없으면 null — DEFAULT_REGION(서울시청)으로 추정하지 않는다', () => {
    expect(nearbyPreloadBbox({ coords: null, pins: [], span })).toBeNull();
  });

  it('B5 센터 우선순위가 initialRegion과 동일하다(현재위치 → 핀 bbox 중심)', () => {
    const cases: { coords: { lat: number; lng: number } | null; pins: MuklogPin[] }[] = [
      { coords: { lat: 37.55, lng: 126.97 }, pins: [pin({ lat: 35.1, lng: 129.0 })] },
      { coords: null, pins: [pin({ lat: 35.1, lng: 129.0 }), pin({ muklogId: 'm2', lat: 35.3, lng: 129.2 })] },
      { coords: null, pins: [pin({ lat: 37.5, lng: 127.0 })] },
    ];
    cases.forEach(({ coords, pins }) => {
      const region = initialRegion({ coords, pins });
      const bbox = nearbyPreloadBbox({ coords, pins, span });
      expect(bbox).not.toBeNull();
      // bbox 중심 == initialRegion 센터(같은 우선순위·같은 계산).
      expect((bbox!.sw.lat + bbox!.ne.lat) / 2).toBeCloseTo(region.lat, 10);
      expect((bbox!.sw.lng + bbox!.ne.lng) / 2).toBeCloseTo(region.lng, 10);
    });
  });

  it('A2-5 반환 bbox의 span이 인자 span과 일치하고 sw < ne로 정렬된다', () => {
    const bbox = nearbyPreloadBbox({
      coords: { lat: 37.5, lng: 127.0 },
      pins: [],
      span: { lat: 0.018, lng: 0.022 },
    });
    expect(bbox!.ne.lat - bbox!.sw.lat).toBeCloseTo(0.018, 10);
    expect(bbox!.ne.lng - bbox!.sw.lng).toBeCloseTo(0.022, 10);
    expect(bbox!.sw.lat).toBeLessThan(bbox!.ne.lat);
    expect(bbox!.sw.lng).toBeLessThan(bbox!.ne.lng);
  });

  it('A2-5 극단 좌표(±90/±180 근처)에서도 NaN을 내지 않는다', () => {
    const bbox = nearbyPreloadBbox({ coords: { lat: -89.99, lng: 179.99 }, pins: [], span });
    expect(bbox).not.toBeNull();
    [bbox!.sw.lat, bbox!.sw.lng, bbox!.ne.lat, bbox!.ne.lng].forEach((n) => {
      expect(Number.isFinite(n)).toBe(true);
    });
  });

  it('센터가 비유한(NaN·Infinity)이면 null — 확실히 틀릴 조회를 미리 태우지 않는다', () => {
    expect(nearbyPreloadBbox({ coords: { lat: Number.NaN, lng: 127 }, pins: [], span })).toBeNull();
    expect(
      nearbyPreloadBbox({ coords: null, pins: [pin({ lat: Infinity })], span }),
    ).toBeNull();
  });

  it('span이 비유한이면 null(폭 없는 조회 방지)', () => {
    expect(
      nearbyPreloadBbox({
        coords: { lat: 37.5, lng: 127 },
        pins: [],
        span: { lat: Number.NaN, lng: 0.02 },
      }),
    ).toBeNull();
  });
});
