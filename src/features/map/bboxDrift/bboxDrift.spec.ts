// src/features/map/bboxDrift/bboxDrift.spec.ts
// bbox 드리프트 정규화 판정 — 재검색 버튼 노출/보정 조회의 단일 판별자 (map-pin-loading plan §4.1·W2 A2-1~A2-3, M5).
//   임계는 "도 단위 절대값"이 아니라 **뷰포트 폭 배수**다 — 줌 레벨이 달라도 같은 의미를 갖게 하려는 것이
//   구 최소이동 임계(도 단위 1e-3)를 대체하는 이유다(레벨 1에선 화면 전체, 레벨 8에선 1픽셀이던 임계).
import {
  NEARBY_RESEARCH_DRIFT,
  NEARBY_RESEARCH_ZOOM_RATIO,
  bboxDrift,
  bboxSpan,
  exceedsResearchThreshold,
  type Bounds,
} from './bboxDrift';

/** 중심(lat,lng)과 span(폭)으로 bbox를 만든다 — 이동/줌을 독립적으로 조작하기 위한 헬퍼. */
const box = ({
  lat = 37.5,
  lng = 127.0,
  spanLat = 0.02,
  spanLng = 0.02,
}: { lat?: number; lng?: number; spanLat?: number; spanLng?: number } = {}): Bounds => ({
  sw: { lat: lat - spanLat / 2, lng: lng - spanLng / 2 },
  ne: { lat: lat + spanLat / 2, lng: lng + spanLng / 2 },
});

describe('bboxSpan', () => {
  it('bbox의 변 길이(절대값)를 낸다', () => {
    const span = bboxSpan({ bounds: box({ spanLat: 0.02, spanLng: 0.03 }) });
    expect(span.lat).toBeCloseTo(0.02, 10);
    expect(span.lng).toBeCloseTo(0.03, 10);
  });

  it('코너가 뒤집힌(역전) bbox도 절대값으로 낸다(판정은 호출부 책임)', () => {
    const inverted: Bounds = { sw: { lat: 37.6, lng: 127.1 }, ne: { lat: 37.5, lng: 127.0 } };
    const span = bboxSpan({ bounds: inverted });
    expect(span.lat).toBeCloseTo(0.1, 10);
    expect(span.lng).toBeCloseTo(0.1, 10);
  });
});

describe('bboxDrift (정규화 이동·줌)', () => {
  it('중심 이동을 뷰포트 폭 배수로 낸다(0.02 폭에서 0.006 이동 = 0.3)', () => {
    const drift = bboxDrift({ prev: box(), next: box({ lat: 37.5 + 0.006 }) });
    expect(drift.shift).toBeCloseTo(0.3, 10);
    expect(drift.zoom).toBeCloseTo(1, 10);
  });

  it('lat·lng 중 큰 쪽 이동을 택한다', () => {
    const drift = bboxDrift({
      prev: box(),
      next: box({ lat: 37.5 + 0.002, lng: 127.0 + 0.01 }),
    });
    expect(drift.shift).toBeCloseTo(0.5, 10); // 0.01/0.02 = 0.5 > 0.002/0.02 = 0.1
  });

  it('줌 변화는 확대·축소 어느 방향이든 1 이상 배수로 낸다', () => {
    expect(bboxDrift({ prev: box(), next: box({ spanLat: 0.04, spanLng: 0.04 }) }).zoom).toBeCloseTo(
      2,
      10,
    );
    expect(bboxDrift({ prev: box(), next: box({ spanLat: 0.01, spanLng: 0.01 }) }).zoom).toBeCloseTo(
      2,
      10,
    );
  });

  it('A2-3 퇴화 bbox(폭 0)면 shift·zoom이 Infinity — NaN을 내지 않는다', () => {
    const degenerate: Bounds = { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.5, lng: 127.0 } };
    const drift = bboxDrift({ prev: degenerate, next: box() });
    expect(drift.shift).toBe(Infinity);
    expect(drift.zoom).toBe(Infinity);
    expect(Number.isNaN(drift.shift)).toBe(false);
    expect(Number.isNaN(drift.zoom)).toBe(false);
  });

  it('양쪽 모두 퇴화(폭 0·이동 0)여도 NaN이 아니라 Infinity다(0/0 방어)', () => {
    const degenerate: Bounds = { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.5, lng: 127.0 } };
    const drift = bboxDrift({ prev: degenerate, next: degenerate });
    expect(drift.shift).toBe(Infinity);
    expect(drift.zoom).toBe(Infinity);
  });
});

describe('exceedsResearchThreshold (A2-1·A2-2, M5)', () => {
  it('상수는 이 모듈이 단일 출처다(drift 0.35 · zoom 1.6)', () => {
    expect(NEARBY_RESEARCH_DRIFT).toBe(0.35);
    expect(NEARBY_RESEARCH_ZOOM_RATIO).toBe(1.6);
  });

  it('A2-1 폭 0.02에서 0.006 이동(0.3배)은 false, 0.008 이동(0.4배)은 true', () => {
    expect(exceedsResearchThreshold({ prev: box(), next: box({ lat: 37.5 + 0.006 }) })).toBe(false);
    expect(exceedsResearchThreshold({ prev: box(), next: box({ lat: 37.5 + 0.008 }) })).toBe(true);
  });

  it('임계 경계값은 포함이다(>= 0.35 · >= 1.6) — 단위 폭 bbox로 부동소수 잡음 없이 확인', () => {
    // 폭 1도(중심 0) 기준 → 이동 0.35 = 정확히 임계, 폭 1.6 = 정확히 줌 임계.
    const unit: Bounds = { sw: { lat: -0.5, lng: -0.5 }, ne: { lat: 0.5, lng: 0.5 } };
    const shifted: Bounds = { sw: { lat: -0.15, lng: -0.5 }, ne: { lat: 0.85, lng: 0.5 } };
    const zoomed: Bounds = { sw: { lat: -0.8, lng: -0.8 }, ne: { lat: 0.8, lng: 0.8 } };
    expect(bboxDrift({ prev: unit, next: shifted }).shift).toBeCloseTo(NEARBY_RESEARCH_DRIFT, 10);
    expect(exceedsResearchThreshold({ prev: unit, next: shifted })).toBe(true);
    expect(bboxDrift({ prev: unit, next: zoomed }).zoom).toBeCloseTo(
      NEARBY_RESEARCH_ZOOM_RATIO,
      10,
    );
    expect(exceedsResearchThreshold({ prev: unit, next: zoomed })).toBe(true);
  });

  it('A2-2 이동 0이어도 줌 2배면 true — zoom 축을 무시하면 죽는다(M5)', () => {
    expect(
      exceedsResearchThreshold({ prev: box(), next: box({ spanLat: 0.04, spanLng: 0.04 }) }),
    ).toBe(true);
    expect(bboxDrift({ prev: box(), next: box({ spanLat: 0.04, spanLng: 0.04 }) }).shift).toBe(0);
  });

  it('A2-2 줌 1.5배(임계 미만)는 false — 미세 줌은 흡수한다', () => {
    expect(
      exceedsResearchThreshold({ prev: box(), next: box({ spanLat: 0.03, spanLng: 0.03 }) }),
    ).toBe(false);
  });

  it('줌아웃(축소) 방향도 대칭으로 켜진다(1/2배)', () => {
    expect(
      exceedsResearchThreshold({ prev: box(), next: box({ spanLat: 0.01, spanLng: 0.01 }) }),
    ).toBe(true);
  });

  it('A2-3 퇴화 bbox는 방어적으로 true(재검색 허용)', () => {
    const degenerate: Bounds = { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.5, lng: 127.0 } };
    expect(exceedsResearchThreshold({ prev: degenerate, next: box() })).toBe(true);
  });

  it('동일 bbox는 false(이동·줌 0)', () => {
    expect(exceedsResearchThreshold({ prev: box(), next: box() })).toBe(false);
  });

  it('구 최소이동 임계(도 단위 1e-3) 크기의 미세 이동은 켜지지 않는다(의도 승격 — 처분표 #10)', () => {
    expect(exceedsResearchThreshold({ prev: box(), next: box({ lat: 37.5 + 0.00005 }) })).toBe(
      false,
    );
    expect(exceedsResearchThreshold({ prev: box(), next: box({ lat: 37.5 + 1e-3 }) })).toBe(false);
  });
});
