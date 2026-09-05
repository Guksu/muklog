// src/components/SegmentControl.spec.tsx
// iOS 스타일 세그먼트 컨트롤 — 킷 mk-log.jsx:56-72 정합. 라벨+카운트·선택 상태·onChange 분기 검증(plan TC-6 비주얼).
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { SegmentControl } from './SegmentControl';

const segments = [
  { key: 'log', label: '기록', count: 3 },
  { key: 'wish', label: '위시리스트', count: 2 },
];

describe('SegmentControl', () => {
  it('각 세그먼트를 "라벨 N" 형태(카운트 포함)로 표시한다', () => {
    renderWithTheme(<SegmentControl segments={segments} selected="log" onChange={jest.fn()} />);
    expect(screen.getByText('기록 3')).toBeTruthy();
    expect(screen.getByText('위시리스트 2')).toBeTruthy();
  });

  it('선택된 세그먼트만 accessibilityState.selected=true다', () => {
    renderWithTheme(<SegmentControl segments={segments} selected="wish" onChange={jest.fn()} />);
    expect(screen.getByLabelText('위시리스트 2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('기록 3').props.accessibilityState.selected).toBe(false);
  });

  it('세그먼트 탭 시 onChange({ key })를 호출한다', () => {
    const onChange = jest.fn();
    renderWithTheme(<SegmentControl segments={segments} selected="log" onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('위시리스트 2'));
    expect(onChange).toHaveBeenCalledWith({ key: 'wish' });
  });

  it('count가 undefined면 라벨만 표시한다(범용)', () => {
    renderWithTheme(
      <SegmentControl
        segments={[
          { key: 'a', label: '에이' },
          { key: 'b', label: '비' },
        ]}
        selected="a"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('에이')).toBeTruthy();
    expect(screen.getByText('비')).toBeTruthy();
  });
});

// ── 미부여 회귀 가드 N4(motion-press-c T6 / ui-spec §5-3) ────────────────────────
//   세그먼트 칸은 라벨을 가진 탭 타깃이라 "빠뜨렸다"고 오인하기 쉽다 — 미부여가 판정임을 잠근다.
//   role은 'button'이 아니라 'tab'이라 role 기반 쿼리를 쓰지 않는다(ui-spec §8-5).
describe('SegmentControl — 세그먼트 칸 눌림 피드백 미부여 가드(motion-press-c N4)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('N4: 감소 모션 OFF에서도 세그먼트 칸의 flatten style에 transform이 없다', () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(false));
    renderWithTheme(<SegmentControl segments={segments} selected="log" onChange={jest.fn()} />);
    const flat = StyleSheet.flatten(
      screen.getByLabelText('기록 3').props.style,
    ) as Record<string, unknown>;
    expect(flat.transform).toBeUndefined();
  });
});
