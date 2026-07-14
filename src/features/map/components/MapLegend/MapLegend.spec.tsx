// src/features/map/components/MapLegend.spec.tsx
// 지도 범례 — 킷 mk-home.jsx:281-284,306-312 Legend 재현 + 위시 항목(map-wish-pins).
//   "우리 맛집"(primary) / "가고 싶은 곳"(앰버 mapWishPin) / "주변 음식점"(웜그레이) 칩 3개를 지도 좌상단에 가로 배치.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapLegend } from './MapLegend';

describe('MapLegend', () => {
  it('세 범례 라벨을 렌더한다(우리 맛집/가고 싶은 곳/주변 음식점)', () => {
    renderWithTheme(<MapLegend />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
    expect(screen.getByText('가고 싶은 곳')).toBeTruthy();
    expect(screen.getByText('주변 음식점')).toBeTruthy();
  });

  it('세 개의 dot을 렌더한다', () => {
    renderWithTheme(<MapLegend />);
    expect(screen.getAllByTestId('map-legend-dot')).toHaveLength(3);
  });
});
