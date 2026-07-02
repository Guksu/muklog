// src/components/SegmentControl.spec.tsx
// iOS 스타일 세그먼트 컨트롤 — 킷 mk-log.jsx:56-72 정합. 라벨+카운트·선택 상태·onChange 분기 검증(plan TC-6 비주얼).
import React from 'react';
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
