// src/navigation/homeHeaderVisibility/homeHeaderVisibility.spec.ts
// 홈 탭 헤더 표시 정책 단위 테스트 (map-headerless plan §5-1 T1-1~T1-3).
//   "어느 탭이 헤더를 갖는가"의 단일 출처를 못 박는다 — 지도 탭만 예외, 나머지는 전부 표시.
import { Routes } from '../routes';

import { shouldShowHomeHeader } from './homeHeaderVisibility';

describe('shouldShowHomeHeader', () => {
  it('T1-1: 지도 탭은 헤더를 표시하지 않는다(지도가 상태바까지 차오름)', () => {
    expect(shouldShowHomeHeader({ routeName: Routes.MapTab })).toBe(false);
  });

  it('T1-2: 먹로그 탭은 헤더를 표시한다(워드마크·+·아바타 유지)', () => {
    expect(shouldShowHomeHeader({ routeName: Routes.LogList })).toBe(true);
  });

  it('T1-3: 미지의 라우트명은 헤더 표시로 폴백한다(신규 탭이 생겨도 기존 동작 유지)', () => {
    expect(shouldShowHomeHeader({ routeName: 'UnknownTab' })).toBe(true);
  });
});
