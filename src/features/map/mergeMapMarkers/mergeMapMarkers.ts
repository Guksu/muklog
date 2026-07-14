// src/features/map/mergeMapMarkers.ts
// saved(내 맛집) + wish(위시) + nearby(주변 음식점) 3-way 마커 머지 + 중복 제거 (map-wish-pins §3.5·§7 경계면).
//   생산자: pinsToMapMarkers(kind:saved) + wishToMapMarkers(kind:wish) + nearbyToMapMarkers(kind:nearby). 소비자: 지도뷰 SET_MARKERS.
//   우선순위 saved > wish > nearby: 다녀온 곳(먹로그)이 위시를 가리고, 내 위시가 일반 주변 핀을 가린다.
//   id 네임스페이스가 kind별로 달라 id 비교 불가 → 좌표근접(epsilon) dedup(중복 핀 금지). 정확 dedup(kakao_place_id)은 후속.
import { type MapMarker } from '../types';

/** 좌표 근접 dedup 임계(도 단위, ≈1e-4°≈11m). 같은 가게면 두 핀이 ~동일 좌표 → 낮은 우선순위 제외. */
export const MERGE_DEDUP_EPSILON = 1e-4;

/**
 * 두 좌표가 epsilon 내로 근접한지(같은 장소로 간주) 판정한다.
 * @param a 좌표 A
 * @param b 좌표 B
 * @returns lat/lng 차이가 둘 다 epsilon 이하면 true
 */
const isNear = ({ a, b }: { a: MapMarker; b: MapMarker }): boolean =>
  Math.abs(a.lat - b.lat) <= MERGE_DEDUP_EPSILON && Math.abs(a.lng - b.lng) <= MERGE_DEDUP_EPSILON;

/** candidate가 others 중 어느 하나와 좌표 근접한지. */
const isNearAny = ({ candidate, others }: { candidate: MapMarker; others: MapMarker[] }): boolean =>
  others.some((other) => isNear({ a: other, b: candidate }));

/**
 * saved + wish + nearby 마커를 우선순위(saved > wish > nearby)로 머지한다.
 * @param saved 내 맛집 마커(kind:saved) — 항상 전부 포함
 * @param wish 위시 마커(kind:wish) — saved와 좌표 근접하지 않은 것만 포함
 * @param nearby 주변 음식점 마커(kind:nearby) — saved·wish 어느 쪽과도 근접하지 않은 것만 포함
 * @returns 머지된 마커 배열(saved → 살아남은 wish → 살아남은 nearby)
 */
export const mergeMapMarkers = ({
  saved,
  wish,
  nearby,
}: {
  saved: MapMarker[];
  wish: MapMarker[];
  nearby: MapMarker[];
}): MapMarker[] => {
  const dedupedWish = wish.filter((candidate) => !isNearAny({ candidate, others: saved }));
  const dedupedNearby = nearby.filter(
    (candidate) =>
      !isNearAny({ candidate, others: saved }) && !isNearAny({ candidate, others: wish }),
  );
  return [...saved, ...dedupedWish, ...dedupedNearby];
};
