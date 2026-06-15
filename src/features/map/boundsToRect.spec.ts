// src/features/map/boundsToRect.spec.ts
// BOUNDS_CHANGED sw/ne → Edge 요청 본문 직렬화 단위 테스트 (plan §3.4·§5-1 boundsToRect).
//   유틸은 패스스루(직렬화 단위 고정). 역전/NaN 가드는 useNearbyPlaces 책임 — 여기선 패스스루임을 명시.
import { boundsToRect } from './boundsToRect';

describe('boundsToRect', () => {
  it('sw/ne를 그대로 통과시킨다(Edge 요청 본문 직렬화)', () => {
    const sw = { lat: 37.5, lng: 126.9 };
    const ne = { lat: 37.6, lng: 127.1 };
    expect(boundsToRect({ sw, ne })).toEqual({ sw, ne });
  });

  it('값을 변형하지 않는다(역전/NaN 가드는 호출측 책임 — 유틸은 패스스루)', () => {
    const sw = { lat: 99, lng: 99 };
    const ne = { lat: 0, lng: 0 };
    expect(boundsToRect({ sw, ne })).toEqual({ sw, ne });
  });
});
