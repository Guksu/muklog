// src/components/Sheet.spec.tsx
// 공용 하단 시트 — visible 토글·title/children 렌더·딤 배경 탭 onClose·패널 탭 미닫힘 (plan §6.4 / §5 T4).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('visible=false면 children을 렌더하지 않는다', () => {
    renderWithTheme(
      <Sheet visible={false} onClose={() => {}} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.queryByText('무엇을 할까요?')).toBeNull();
    expect(screen.queryByText('액션')).toBeNull();
  });

  it('visible=true면 title과 children을 렌더한다', () => {
    renderWithTheme(
      <Sheet visible onClose={() => {}} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.getByText('무엇을 할까요?')).toBeTruthy();
    expect(screen.getByText('액션')).toBeTruthy();
  });

  it('딤 배경(backdrop) 탭 시 onClose를 호출한다', () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('패널 내부 탭은 onClose를 호출하지 않는다', () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-panel'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
