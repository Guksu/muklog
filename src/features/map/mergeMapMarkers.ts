// src/features/map/mergeMapMarkers.ts
// saved(내 맛집) + nearby(주변 음식점) 마커 머지 + 중복 제거 (plan §3.4·§9.3·§7 경계면).
//   생산자: pinsToMapMarkers(saved:true) + nearbyToMapMarkers(saved:false). 소비자: 지도뷰 SET_MARKERS.
//   규칙(§9.3 확정): saved 우선. saved.id=muklogId ≠ nearby.id=kakaoPlaceId라 id 비교 불가 →
//     saved 핀과 좌표가 근접(epsilon)한 nearby는 제외(중복 핀 금지). 정확 dedup(kakao_place_id)은 후속.
import { type MapMarker } from './types';

/** 좌표 근접 dedup 임계(도 단위, ≈1e-4°≈11m). saved/nearby가 같은 가게면 둘이 ~동일 좌표 → nearby 제외. */
export const MERGE_DEDUP_EPSILON = 1e-4;

/**
 * 두 좌표가 epsilon 내로 근접한지(같은 장소로 간주) 판정한다.
 * @param a 좌표 A
 * @param b 좌표 B
 * @returns lat/lng 차이가 둘 다 epsilon 이하면 true
 */
const isNear = ({ a, b }: { a: MapMarker; b: MapMarker }): boolean =>
  Math.abs(a.lat - b.lat) <= MERGE_DEDUP_EPSILON && Math.abs(a.lng - b.lng) <= MERGE_DEDUP_EPSILON;

/**
 * saved + nearby 마커를 머지한다. saved를 우선하고, saved와 좌표 근접한 nearby는 제외한다.
 * @param saved 내 맛집 마커(saved:true) — 항상 전부 포함
 * @param nearby 주변 음식점 마커(saved:false) — saved와 좌표 근접하지 않은 것만 포함
 * @returns 머지된 마커 배열(saved 먼저, 그다음 살아남은 nearby)
 */
export const mergeMapMarkers = ({
  saved,
  nearby,
}: {
  saved: MapMarker[];
  nearby: MapMarker[];
}): MapMarker[] => {
  const dedupedNearby = nearby.filter(
    (candidate) => !saved.some((savedMarker) => isNear({ a: savedMarker, b: candidate })),
  );
  return [...saved, ...dedupedNearby];
};
