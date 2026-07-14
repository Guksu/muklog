// src/features/map/mergeMapMarkers.spec.ts
// saved + wish + nearby 3-way 머지 + 좌표 근접(epsilon) dedup 단위 테스트 (map-wish-pins §3.5 / T5).
//   우선순위 saved > wish > nearby. saved 전부 / wish(saved 비근접) / nearby(saved·wish 어느 쪽과도 비근접).
import { MERGE_DEDUP_EPSILON, mergeMapMarkers } from './mergeMapMarkers';
import { MapPinKind, type MapMarker } from '../types';

const saved = (over?: Partial<MapMarker>): MapMarker => ({
  id: 'm1',
  lat: 37.5,
  lng: 127.0,
  emoji: '🍝',
  kind: MapPinKind.Saved,
  ...over,
});
const wish = (over?: Partial<MapMarker>): MapMarker => ({
  id: 'w1',
  lat: 37.5,
  lng: 127.0,
  emoji: '🍜',
  kind: MapPinKind.Wish,
  ...over,
});
const nearby = (over?: Partial<MapMarker>): MapMarker => ({
  id: 'k1',
  lat: 37.5,
  lng: 127.0,
  emoji: '🍜',
  kind: MapPinKind.Nearby,
  ...over,
});

describe('mergeMapMarkers (3-way)', () => {
  it('겹치지 않는 saved+wish+nearby를 모두 포함한다(kind 분기 보존)', () => {
    const savedList = [saved({ id: 'm1', lat: 37.50, lng: 127.00 })];
    const wishList = [wish({ id: 'w1', lat: 37.60, lng: 127.10 })];
    const nearbyList = [nearby({ id: 'k1', lat: 37.70, lng: 127.20 })];
    const merged = mergeMapMarkers({ saved: savedList, wish: wishList, nearby: nearbyList });
    expect(merged).toHaveLength(3);
    expect(merged.filter((m) => m.kind === MapPinKind.Saved)).toHaveLength(1);
    expect(merged.filter((m) => m.kind === MapPinKind.Wish)).toHaveLength(1);
    expect(merged.filter((m) => m.kind === MapPinKind.Nearby)).toHaveLength(1);
  });

  it('우선순위 순서로 반환한다(saved 먼저, wish, nearby)', () => {
    const merged = mergeMapMarkers({
      saved: [saved({ id: 'm1', lat: 37.50, lng: 127.00 })],
      wish: [wish({ id: 'w1', lat: 37.60, lng: 127.10 })],
      nearby: [nearby({ id: 'k1', lat: 37.70, lng: 127.20 })],
    });
    expect(merged.map((m) => m.id)).toEqual(['m1', 'w1', 'k1']);
  });

  it('saved와 좌표 근접한 wish는 제외한다(saved 우선 — 다녀온 곳이 위시를 가림)', () => {
    const savedList = [saved({ id: 'm1', lat: 37.5, lng: 127.0 })];
    const wishList = [
      wish({ id: 'dup', lat: 37.5 + MERGE_DEDUP_EPSILON / 2, lng: 127.0 }), // 근접 → 제외
      wish({ id: 'far', lat: 38.0, lng: 128.0 }), // 유지
    ];
    const merged = mergeMapMarkers({ saved: savedList, wish: wishList, nearby: [] });
    expect(merged.map((m) => m.id).sort()).toEqual(['far', 'm1']);
  });

  it('wish와 좌표 근접한 nearby는 제외한다(wish 우선 — 내 위시가 일반 핀을 가림)', () => {
    const wishList = [wish({ id: 'w1', lat: 37.5, lng: 127.0 })];
    const nearbyList = [
      nearby({ id: 'dup', lat: 37.5 + MERGE_DEDUP_EPSILON / 2, lng: 127.0 }), // 근접 → 제외
      nearby({ id: 'far', lat: 38.0, lng: 128.0 }), // 유지
    ];
    const merged = mergeMapMarkers({ saved: [], wish: wishList, nearby: nearbyList });
    expect(merged.map((m) => m.id).sort()).toEqual(['far', 'w1']);
  });

  it('saved와 좌표 근접한 nearby도 제외한다(회귀 — saved>nearby)', () => {
    const savedList = [saved({ id: 'm1', lat: 37.5, lng: 127.0 })];
    const nearbyList = [
      nearby({ id: 'dup', lat: 37.5 + MERGE_DEDUP_EPSILON / 2, lng: 127.0 }),
      nearby({ id: 'far', lat: 38.0, lng: 128.0 }),
    ];
    const merged = mergeMapMarkers({ saved: savedList, wish: [], nearby: nearbyList });
    expect(merged.map((m) => m.id).sort()).toEqual(['far', 'm1']);
  });

  it('epsilon 경계 바깥(살짝 멀면) 근접 판정 안 함 — 전부 유지', () => {
    const savedList = [saved({ id: 'm1', lat: 37.5, lng: 127.0 })];
    const wishList = [wish({ id: 'edge', lat: 37.5 + MERGE_DEDUP_EPSILON * 2, lng: 127.0 })];
    const merged = mergeMapMarkers({ saved: savedList, wish: wishList, nearby: [] });
    expect(merged.map((m) => m.id).sort()).toEqual(['edge', 'm1']);
  });

  it('saved·wish가 비면 nearby 그대로 반환한다', () => {
    const nearbyList = [nearby({ id: 'k1' })];
    expect(mergeMapMarkers({ saved: [], wish: [], nearby: nearbyList })).toEqual(nearbyList);
  });

  it('셋 다 비면 빈 배열을 반환한다', () => {
    expect(mergeMapMarkers({ saved: [], wish: [], nearby: [] })).toEqual([]);
  });
});
