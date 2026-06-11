// src/components/IconButton.spec.tsx
// 둥근 아이콘 버튼 — 킷 mk-ui.jsx:106-118 MkIconBtn 정합 (A7).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { IconButton } from './IconButton';
import { IconName } from './Icon';

describe('IconButton', () => {
  it('아이콘을 렌더하고 onPress를 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <IconButton name={IconName.Plus} accessibilityLabel="추가" onPress={onPress} />,
    );
    expect(screen.getByTestId('icon-plus')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('추가'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('badge가 true면 도트를 렌더한다', () => {
    renderWithTheme(
      <IconButton name={IconName.Setting} accessibilityLabel="설정" badge onPress={() => {}} />,
    );
    expect(screen.getByTestId('icon-button-badge')).toBeTruthy();
  });

  it('badge가 없으면 도트를 렌더하지 않는다', () => {
    renderWithTheme(
      <IconButton name={IconName.Setting} accessibilityLabel="설정" onPress={() => {}} />,
    );
    expect(screen.queryByTestId('icon-button-badge')).toBeNull();
  });

  it('40×40 원형 컨테이너다(킷 사양)', () => {
    renderWithTheme(
      <IconButton name={IconName.Plus} accessibilityLabel="추가" onPress={() => {}} />,
    );
    const node = screen.getByLabelText('추가');
    const style = Object.assign(
      {},
      ...[].concat(node.props.style as never).filter(Boolean),
    ) as Record<string, number>;
    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
  });
});
