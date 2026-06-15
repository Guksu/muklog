// src/features/map/components/MapLocateButton.spec.tsx
// 지도 현재위치 FAB — 킷 mk-home.jsx:289-298 "내 위치로 이동" 버튼 재현(map-locate-button, T9).
//   비주얼·배치(46×46/그림자/우하단)는 디바이스 스모크·qa-visual. 여기선 렌더·onPress·접근성만 단언.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapLocateButton } from './MapLocateButton';

describe('MapLocateButton', () => {
  it('내 위치로 이동 버튼(접근성 라벨)을 렌더한다', () => {
    renderWithTheme(<MapLocateButton onPress={() => {}} />);
    expect(screen.getByLabelText('내 위치로 이동')).toBeTruthy();
  });

  it('locate 아이콘을 렌더한다', () => {
    renderWithTheme(<MapLocateButton onPress={() => {}} />);
    expect(screen.getByTestId('icon-locate')).toBeTruthy();
  });

  it('탭하면 onPress 콜백을 1회 호출한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapLocateButton onPress={handlePress} />);
    fireEvent.press(screen.getByLabelText('내 위치로 이동'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });
});
