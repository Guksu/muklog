// src/features/map/initialRegion.ts
// 초기 지도 영역(센터) 계산 (plan §3.4·§6 좌표 이상치·§7 경계면).
//   생산자: useLocationPermission(coords) + useMuklogPins(pins). 소비자: 지도뷰 INIT center.
//   우선순위: 현재위치 → 핀 bbox 중심 → DEFAULT_REGION(서울시청). 슬라이스 2 viewport 계산의 순수 기반.
import { type Coords, type MuklogPin, type Region } from '../types';

/** 현재위치·핀 모두 없을 때 안전 기본값(서울시청). zoom은 라이브러리 무관 정수 스케일. */
export const DEFAULT_REGION: Region = { lat: 37.5665, lng: 126.978, zoom: 5 };

/** 기본 줌 — 단일 위치/현재위치 센터링 시 사용. */
const DEFAULT_ZOOM = DEFAULT_REGION.zoom;

/**
 * 초기 지도 센터 영역을 계산한다.
 * coords가 있으면 그 중심, 없으면 핀들의 bounding box 중심, 둘 다 없으면 DEFAULT_REGION.
 * 핀 1개(0폭 bbox)·극단 좌표에도 NaN 없이 안전하다.
 * @param coords 현재위치(granted일 때만, 아니면 null)
 * @param pins 좌표 있는 먹로그 핀 목록(빈 배열 가능)
 * @returns 지도 INIT에 실을 센터 Region
 */
export const initialRegion = ({
  coords,
  pins,
}: {
  coords: Coords | null;
  pins: MuklogPin[];
}): Region => {
  if (coords) {
    return { lat: coords.lat, lng: coords.lng, zoom: DEFAULT_ZOOM };
  }

  if (pins.length === 0) {
    return DEFAULT_REGION;
  }

  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  return { lat, lng, zoom: DEFAULT_ZOOM };
};
