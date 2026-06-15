// src/features/map/formatDistance.ts
// 거리(m, number|null) → 사용자 표기 문자열 순수 유틸 (plan §4·§7 경계면).
//   생산자: nearby-search distance(number|null). 소비자: MapTabScreen → NearbySpotCard distanceText.
//   규칙: <1000 "{n}m" / ≥1000 "{km}km"(소수1, 정수 km는 .0 생략) / null → ''(거리 조각 생략).
const METERS_PER_KM = 1000;

/**
 * 거리(미터)를 표기 문자열로 변환한다.
 * @param distance 거리(미터) 또는 null(결측)
 * @returns "320m" / "1.5km" / "1km" / "" (null)
 */
export const formatDistance = ({ distance }: { distance: number | null }): string => {
  if (distance === null || !Number.isFinite(distance)) return '';
  if (distance < METERS_PER_KM) return `${Math.round(distance)}m`;
  const km = distance / METERS_PER_KM;
  const rounded = Math.round(km * 10) / 10; // 소수1 반올림.
  // 정수 km는 .0 없이(1km), 아니면 소수1(1.5km).
  return `${Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)}km`;
};
