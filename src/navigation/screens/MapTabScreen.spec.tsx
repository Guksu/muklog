// src/navigation/screens/MapTabScreen.spec.tsx
// 지도 탭 셸 — 킷 mk-home MapScreen 범례("우리 맛집"/"주변 음식점") 정합 (FLAG-2).
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapTabScreen } from './MapTabScreen';

describe('MapTabScreen', () => {
  it('범례 라벨(우리 맛집/주변 음식점)을 렌더한다', () => {
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
    expect(screen.getByText('주변 음식점')).toBeTruthy();
  });
});
