// src/features/map/mergeMapMarkers.spec.ts
// saved + nearby 머지 + 좌표 근접(epsilon) dedup 단위 테스트 (plan §3.4·§5-1 mergeMapMarkers).
//   saved 우선 / saved와 좌표 근접한 nearby 제외 / 비겹침 모두 유지 / epsilon 경계 / 빈 배열.
import { MERGE_DEDUP_EPSILON, mergeMapMarkers } from './mergeMapMarkers';
import { type MapMarker } from './types';

const saved = (over?: Partial<MapMarker>): MapMarker => ({
  id: 'm1',
  lat: 37.5,
  lng: 127.0,
  emoji: '🍝',
  saved: true,
  ...over,
});
const nearby = (over?: Partial<MapMarker>): MapMarker => ({
  id: 'k1',
  lat: 37.5,
  lng: 127.0,
  emoji: '🍜',
  saved: false,
  ...over,
});

describe('mergeMapMarkers', () => {
  it('겹치지 않는 saved+nearby를 모두 포함한다(색 분기 보존)', () => {
    const savedList = [saved({ id: 'm1', lat: 37.50, lng: 127.00 })];
    const nearbyList = [
      nearby({ id: 'k1', lat: 37.60, lng: 127.10 }),
      nearby({ id: 'k2', lat: 37.70, lng: 127.20 }),
    ];
    const merged = mergeMapMarkers({ saved: savedList, nearby: nearbyList });
    expect(merged).toHaveLength(3);
    expect(merged.filter((m) => m.saved)).toHaveLength(1);
    expect(merged.filter((m) => !m.saved)).toHaveLength(2);
  });

  it('saved와 좌표가 근접(epsilon 내)한 nearby는 제외한다(saved 우선, 중복 핀 0)', () => {
    const savedList = [saved({ id: 'm1', lat: 37.5, lng: 127.0 })];
    const nearbyList = [
      nearby({ id: 'dup', lat: 37.5 + MERGE_DEDUP_EPSILON / 2, lng: 127.0 }), // 근접 → 제외
      nearby({ id: 'far', lat: 38.0, lng: 128.0 }), // 유지
    ];
    const merged = mergeMapMarkers({ saved: savedList, nearby: nearbyList });
    expect(merged.map((m) => m.id).sort()).toEqual(['far', 'm1']);
  });

  it('epsilon 경계 바깥(살짝 멀면) nearby를 유지한다', () => {
    const savedList = [saved({ id: 'm1', lat: 37.5, lng: 127.0 })];
    const nearbyList = [nearby({ id: 'edge', lat: 37.5 + MERGE_DEDUP_EPSILON * 2, lng: 127.0 })];
    const merged = mergeMapMarkers({ saved: savedList, nearby: nearbyList });
    expect(merged.map((m) => m.id).sort()).toEqual(['edge', 'm1']);
  });

  it('saved가 비면 nearby 그대로 반환한다', () => {
    const nearbyList = [nearby({ id: 'k1' })];
    expect(mergeMapMarkers({ saved: [], nearby: nearbyList })).toEqual(nearbyList);
  });

  it('nearby가 비면 saved 그대로 반환한다', () => {
    const savedList = [saved({ id: 'm1' })];
    expect(mergeMapMarkers({ saved: savedList, nearby: [] })).toEqual(savedList);
  });

  it('둘 다 비면 빈 배열을 반환한다', () => {
    expect(mergeMapMarkers({ saved: [], nearby: [] })).toEqual([]);
  });
});
