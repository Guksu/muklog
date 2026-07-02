// src/components/Chip.spec.tsx
// 칩(카테고리·필터) — 킷 mk-ui.jsx:120-136 MkChip 정합 (A3).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { Chip } from './Chip';

const lightColor = themes.light.color;

describe('Chip', () => {
  it('label과 emoji를 렌더하고 onPress를 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(<Chip label="파스타" emoji="🍝" onPress={onPress} />);
    expect(screen.getByText('파스타')).toBeTruthy();
    expect(screen.getByText('🍝')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('선택 시 primary 배경 + primaryFg 텍스트다(킷 selected)', () => {
    renderWithTheme(<Chip label="전체" selected />);
    expect(flatBg(screen.getByRole('button'))).toBe(lightColor.primary);
    expect(screen.getByText('전체').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.primaryFg })]),
    );
  });

  it('미선택 시 surface 배경 + fgWeak 텍스트 + 헤어라인 보더다(킷 unselected)', () => {
    renderWithTheme(<Chip label="카페" />);
    const node = screen.getByRole('button');
    expect(flatBg(node)).toBe(lightColor.surface);
    expect(flatStyle(node).borderColor).toBe(lightColor.hairline);
    expect(screen.getByText('카페').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.fgWeak })]),
    );
  });

  it('selected는 accessibilityState.selected로 노출된다(접근성)', () => {
    renderWithTheme(<Chip label="전체" selected />);
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(true);
  });
});

const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;
const flatBg = (node: { props: { style: unknown } }) => flatStyle(node).backgroundColor;
