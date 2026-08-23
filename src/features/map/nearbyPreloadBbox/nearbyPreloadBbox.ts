// src/features/map/nearbyPreloadBbox/nearbyPreloadBbox.ts
// 선로딩 bbox 추정 — 지도(WebView) 부팅 전에 "지도가 그려질 자리"를 계산한다 (map-pin-loading plan §4.2).
//
// 생산자: useLocationPermission(coords) + useMuklogPins(pins) — initialRegion과 **동일한 입력·동일한 우선순위**.
// 소비자: MapTabScreen(마운트 1회) → useNearbyPlaces.preload({ bbox }).
//
// 왜 bbox가 아니라 span만 영속하는가: 지도 센터는 initialRegion({coords, pins})로 마운트 시점에 이미 알 수 있다.
//   세션 간 안정적인 건 센터가 아니라 **뷰포트 폭(span)** 이다 — 기기 화면과 줌 레벨의 함수라서.
//   센터를 매번 새로 계산하면 여행·이동 후에도 어긋나지 않는다(직전 세션 bbox를 통째로 복원하면 어긋난다).
// DEFAULT_REGION(서울시청) 폴백은 **추정하지 않는다** — 신호가 없을 때 확실히 틀릴 조회를 미리 태우는 건
//   비용만 쓰고 화면은 못 채운다. null로 스킵하고 첫 BOUNDS_CHANGED가 진짜 뷰포트로 조회하게 둔다.
import { type BboxSpan, type Bounds } from '../bboxDrift';
import { type Coords, type MuklogPin } from '../types';

/** 폴백 뷰포트 span(도) — 카카오 level 5(=initialRegion DEFAULT_ZOOM)의 6인치 기기 근사값.
 *  ⚠ 실측 이월(plan §10 D1): 세션 첫 BOUNDS_CHANGED의 실제 span으로 교정한다(캐시에 관측값이 있으면 그쪽이 우선). */
export const NEARBY_FALLBACK_SPAN: BboxSpan = { lat: 0.018, lng: 0.022 };

/** 유한 좌표 여부 — 추정 실패를 null로 되돌리기 위한 최소 방어. */
const isFiniteCoords = ({ coords }: { coords: Coords }): boolean =>
  Number.isFinite(coords.lat) && Number.isFinite(coords.lng);

/**
 * 탭 진입 즉시(지도 부팅 전) 조회할 bbox를 추정한다.
 * 센터는 initialRegion과 같은 우선순위(현재위치 → 핀 bbox 중심)로 잡고, 둘 다 없으면 추정하지 않는다.
 * @param coords 현재위치(없으면 null)
 * @param pins 좌표 있는 먹로그 핀 목록(빈 배열 가능)
 * @param span 적용할 뷰포트 폭(캐시 관측값 또는 NEARBY_FALLBACK_SPAN)
 * @returns 추정 bbox 또는 null(신호 없음/비유한 입력 — 선로딩 스킵)
 */
export const nearbyPreloadBbox = ({
  coords,
  pins,
  span,
}: {
  coords: Coords | null;
  pins: MuklogPin[];
  span: BboxSpan;
}): Bounds | null => {
  if (!Number.isFinite(span.lat) || !Number.isFinite(span.lng)) return null;

  let center: Coords | null = null;
  if (coords) {
    center = coords;
  } else if (pins.length > 0) {
    const lats = pins.map((p) => p.lat);
    const lngs = pins.map((p) => p.lng);
    center = {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }
  if (!center || !isFiniteCoords({ coords: center })) return null;

  const halfLat = Math.abs(span.lat) / 2;
  const halfLng = Math.abs(span.lng) / 2;
  return {
    sw: { lat: center.lat - halfLat, lng: center.lng - halfLng },
    ne: { lat: center.lat + halfLat, lng: center.lng + halfLng },
  };
};
