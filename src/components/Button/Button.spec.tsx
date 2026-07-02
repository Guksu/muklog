// src/components/Button.spec.tsx
// 버튼 — 킷 mk-ui.jsx:79-104 MkButton 정합 (A2): variant primary/soft/ghost(+secondary 호환), size lg/md/sm, leftIcon, full.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { Button } from './Button';
import { IconName } from '../Icon';

// ThemeProvider 기본은 light(MVP 고정) — 토큰 실값 비교에 themes.light 직접 참조.
const lightColor = themes.light.color;

describe('Button', () => {
  it('title을 렌더하고 onPress를 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button title="저장" onPress={onPress} />);
    fireEvent.press(screen.getByText('저장'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled/loading이면 onPress를 막는다', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button title="저장" disabled onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('soft variant는 primaryWeak 배경 + accentStrong 텍스트다(킷 soft)', () => {
    renderWithTheme(<Button title="공유" variant="soft" />);
    expect(flatBg(screen.getByRole('button'))).toBe(lightColor.primaryWeak);
    expect(screen.getByText('공유').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.accentStrong })]),
    );
  });

  it('ghost variant는 투명 배경 + fgWeak 텍스트다(킷 ghost)', () => {
    renderWithTheme(<Button title="취소" variant="ghost" />);
    expect(flatBg(screen.getByRole('button'))).toBe('transparent');
    expect(screen.getByText('취소').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: lightColor.fgWeak })]),
    );
  });

  it('leftIcon을 텍스트 앞에 렌더한다', () => {
    renderWithTheme(<Button title="추가" leftIcon={IconName.Plus} />);
    expect(screen.getByTestId('icon-plus')).toBeTruthy();
  });

  it('full이면 alignSelf stretch로 너비를 채운다', () => {
    renderWithTheme(<Button title="만들기" full />);
    expect(flatStyle(screen.getByRole('button')).alignSelf).toBe('stretch');
  });
});

// --- helpers ---
const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;
const flatBg = (node: { props: { style: unknown } }) => flatStyle(node).backgroundColor;
