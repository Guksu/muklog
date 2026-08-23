// src/features/map/bboxDrift/bboxDrift.ts
// bbox 드리프트 정규화 — "이 지역에서 검색" 노출과 첫 화면 보정 조회의 단일 판별자 (map-pin-loading plan §4.1).
//
// 생산자: BOUNDS_CHANGED로 들어온 현재 뷰포트 + 직전 조회 bbox. 소비자: useNearbyPlaces(researchAvailable·보정 판정).
// 왜 정규화인가: 이동량을 도(degree) 절대값으로 재면 같은 임계가 줌 레벨마다 다른 의미가 된다
//   (레벨 1에선 화면 전체, 레벨 8에선 1픽셀). 뷰포트 폭 배수로 재면 "화면의 몇 할이 새 영역인가"라는
//   사용자가 실제로 느끼는 양이 되어 줌 레벨과 무관해진다 — 구 최소이동 임계(도 단위 1e-3)를 대체한 이유다.
import { type Coords } from '../types';

/** 지도 뷰포트 bbox(남서·북동 코너) — nearby 계열 모듈의 공용 좌표 계약. */
export type Bounds = { sw: Coords; ne: Coords };

/** bbox의 변 길이(도). 뷰포트 폭 = 줌 레벨과 기기 화면의 함수. */
export type BboxSpan = { lat: number; lng: number };

/** 재검색 임계 — 뷰포트 폭의 35%가 새 영역이면 "다른 동네를 보고 있다"로 본다(미세 팬·관성은 흡수). */
export const NEARBY_RESEARCH_DRIFT = 0.35;
/** 줌 임계 — 카카오 레벨 1단(≈2배)보다 낮게 잡아 한 단 줌인/아웃이면 켜진다. */
export const NEARBY_RESEARCH_ZOOM_RATIO = 1.6;

/**
 * bbox의 변(span)을 낸다 — 0폭 방어 없이 절대값만 내고 판정은 호출부가 한다.
 * @param bounds 대상 bbox
 * @returns lat·lng 변 길이(도, 항상 0 이상)
 */
export const bboxSpan = ({ bounds }: { bounds: Bounds }): BboxSpan => ({
  lat: Math.abs(bounds.ne.lat - bounds.sw.lat),
  lng: Math.abs(bounds.ne.lng - bounds.sw.lng),
});

/** bbox 중심 좌표. */
const centerOf = ({ bounds }: { bounds: Bounds }): Coords => ({
  lat: (bounds.sw.lat + bounds.ne.lat) / 2,
  lng: (bounds.sw.lng + bounds.ne.lng) / 2,
});

/** 한 축의 정규화 이동량. 기준 폭이 0이면 비교 자체가 무의미하므로 Infinity(0/0의 NaN 방어). */
const shiftRatio = ({ moved, base }: { moved: number; base: number }): number =>
  base > 0 ? moved / base : Infinity;

/** 한 축의 줌 배수(확대·축소 대칭, 항상 1 이상). 어느 한쪽이 0이면 Infinity. */
const zoomRatio = ({ prev, next }: { prev: number; next: number }): number =>
  prev > 0 && next > 0 ? Math.max(next / prev, prev / next) : Infinity;

/**
 * 직전 bbox 대비 이동·줌 변화를 뷰포트 폭 배수로 정규화한다(도 단위 절대값이 아님 — 줌 레벨 무관 판정).
 * @param prev 직전에 조회한 bbox
 * @param next 현재 뷰포트 bbox
 * @returns shift(중심 이동 / 직전 폭) · zoom(폭 배수, 1 이상). 퇴화 bbox는 Infinity(NaN 없음)
 */
export const bboxDrift = ({
  prev,
  next,
}: {
  prev: Bounds;
  next: Bounds;
}): { shift: number; zoom: number } => {
  const prevSpan = bboxSpan({ bounds: prev });
  const nextSpan = bboxSpan({ bounds: next });
  const prevCenter = centerOf({ bounds: prev });
  const nextCenter = centerOf({ bounds: next });

  const shift = Math.max(
    shiftRatio({ moved: Math.abs(nextCenter.lat - prevCenter.lat), base: prevSpan.lat }),
    shiftRatio({ moved: Math.abs(nextCenter.lng - prevCenter.lng), base: prevSpan.lng }),
  );
  const zoom = Math.max(
    zoomRatio({ prev: prevSpan.lat, next: nextSpan.lat }),
    zoomRatio({ prev: prevSpan.lng, next: nextSpan.lng }),
  );

  return { shift, zoom };
};

/**
 * 재검색(버튼 노출·보정 조회)이 필요한 만큼 뷰포트가 달라졌는지 판정한다 — 이동·줌 **둘 중 하나만** 넘어도 true.
 * @param prev 직전에 조회한 bbox
 * @param next 현재 뷰포트 bbox
 * @returns 임계 초과 여부
 */
export const exceedsResearchThreshold = ({ prev, next }: { prev: Bounds; next: Bounds }): boolean => {
  const drift = bboxDrift({ prev, next });
  return drift.shift >= NEARBY_RESEARCH_DRIFT || drift.zoom >= NEARBY_RESEARCH_ZOOM_RATIO;
};
