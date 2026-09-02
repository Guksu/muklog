// src/features/map/components/MapLocateButton.spec.tsx
// 지도 현재위치 FAB — 킷 mk-home.jsx:289-298 "내 위치로 이동" 버튼 재현(map-locate-button, T9).
//   비주얼·배치(46×46/그림자/우하단)는 디바이스 스모크·qa-visual. 여기선 렌더·onPress·접근성만 단언.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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

// ── 프레스 치환 B1(motion-press-final D2 / plan §5-1 T12·T18) ───────────────────────────
//   seam = 접근성 라벨로 조회한 노드의 (a) onPress 횟수 (b) flatten style의 transform 키 유무.
//   스케일 실값(0.92)은 motion.spec가 잠갔다 — 여기서 읽지 않는다(plan §5-2).
describe('MapLocateButton — 눌림 피드백 부착(motion-press-final B1, U30)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flattenButton = () =>
    StyleSheet.flatten(screen.getByLabelText('내 위치로 이동').props.style) as Record<
      string,
      unknown
    >;

  it('T12-a: 감소 모션 OFF — 눌림 모션(transform)이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(<MapLocateButton onPress={() => {}} />);
    await waitFor(() => expect(flattenButton().transform).toBeDefined());
  });

  it('T12-b: 감소 모션 ON — transform 없이 불투명도 피드백만 남는다(킷은 스케일만이라 바닥값이 필요하다)', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(<MapLocateButton onPress={() => {}} />);
    await waitFor(() => expect(flattenButton().opacity).toBeDefined());
    expect(flattenButton().transform).toBeUndefined();
  });

  it('T18: pressIn→pressOut→press를 3회 반복해도 onPress가 정확히 3회 발화한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapLocateButton onPress={handlePress} />);
    const button = screen.getByLabelText('내 위치로 이동');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent(button, 'pressIn');
      fireEvent(button, 'pressOut');
      fireEvent.press(button);
    }
    expect(handlePress).toHaveBeenCalledTimes(3);
  });

  it('D2-f: style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithTheme(<MapLocateButton onPress={() => {}} testID="map-locate-button" />);
    expect(warn).not.toHaveBeenCalled();
  });
});
