// src/features/map/components/MapResearchButton/MapResearchButton.spec.tsx
// "이 지역에서 검색" 재검색 pill — 킷 원본 없음(패턴 파생: MkButton sm 골격 + MapLocateButton 떠있는 레이어 스킨).
//   비주얼·배치(pill 높이/그림자/상단 중앙)는 디바이스 스모크·qa-visual. 여기선 렌더·카피·onPress·접근성만 단언.
//   ⚠ 노출 조건(researchAvailable)은 부모(MapTabScreen)가 소유 — 컴포넌트가 visible prop을 갖지 않음을 함께 잠근다.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapResearchButton } from './MapResearchButton';

describe('MapResearchButton', () => {
  it('"이 지역에서 검색" 라벨을 렌더한다(카피 단일 출처)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByText('이 지역에서 검색')).toBeTruthy();
  });

  it('버튼 role과 카피와 같은 접근성 라벨을 노출한다', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    const button = screen.getByLabelText('이 지역에서 검색');
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('search 아이콘을 렌더한다', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByTestId('icon-search')).toBeTruthy();
  });

  it('탭하면 onPress 콜백을 1회 호출한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapResearchButton onPress={handlePress} />);
    fireEvent.press(screen.getByLabelText('이 지역에서 검색'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('testID를 그대로 전달한다(부모 조건 렌더 검증용)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(screen.getByTestId('map-research-button')).toBeTruthy();
  });

  it('자기 노출 조건을 모른다 — 렌더되면 항상 보인다(visible prop 없음)', () => {
    // 부모가 researchAvailable로 조건 렌더하는 계약(plan §4.4·B10). 컴포넌트에 표시 상태가 새면
    // 노출 규칙이 두 곳(훅·컴포넌트)으로 갈라진다 — props 표면을 onPress/testID 2개로 잠근다.
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(screen.getByTestId('map-research-button')).toBeTruthy();
    expect(screen.queryByLabelText('이 지역에서 검색')).toBeTruthy();
  });
});

// ── 프레스 치환 B2(motion-press-final D3 / plan §5-1 T14·T15·T18) ──────────────────────
//   seam = 접근성 라벨로 조회한 노드의 (a) onPress 횟수 (b) hitSlop prop (c) transform 키 유무.
describe('MapResearchButton — 눌림 피드백 부착(motion-press-final B2, U30)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flattenPill = () =>
    StyleSheet.flatten(screen.getByLabelText('이 지역에서 검색').props.style) as Record<
      string,
      unknown
    >;

  it('T14: hitSlop이 렌더 노드에 그대로 전달된다(최소 터치 타깃 45pt 보존)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByLabelText('이 지역에서 검색').props.hitSlop).toEqual({
      top: 5,
      bottom: 5,
      left: 8,
      right: 8,
    });
  });

  it('T15-a: 감소 모션 OFF — 눌림 모션(transform)이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    await waitFor(() => expect(flattenPill().transform).toBeDefined());
  });

  it('T15-b: 감소 모션 ON — transform 없이 불투명도 피드백만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    await waitFor(() => expect(flattenPill().opacity).toBeDefined());
    expect(flattenPill().transform).toBeUndefined();
  });

  it('T18: pressIn→pressOut→press를 3회 반복해도 onPress가 정확히 3회 발화한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapResearchButton onPress={handlePress} />);
    const pill = screen.getByLabelText('이 지역에서 검색');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent(pill, 'pressIn');
      fireEvent(pill, 'pressOut');
      fireEvent.press(pill);
    }
    expect(handlePress).toHaveBeenCalledTimes(3);
  });

  it('D3-f: style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(warn).not.toHaveBeenCalled();
  });
});
