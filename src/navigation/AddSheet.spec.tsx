// src/navigation/AddSheet.spec.tsx
// + 액션시트 — 2개 액션 렌더 + onCreate/onJoin 위임 (plan §6.3 / §5 T7, AC6).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { AddSheet } from './AddSheet';

const setup = (overrides?: { visible?: boolean }) => {
  const onClose = jest.fn();
  const onCreate = jest.fn();
  const onJoin = jest.fn();
  renderWithTheme(
    <AddSheet
      visible={overrides?.visible ?? true}
      onClose={onClose}
      onCreate={onCreate}
      onJoin={onJoin}
      creating={false}
    />,
  );
  return { onClose, onCreate, onJoin };
};

describe('AddSheet', () => {
  it('visible=true면 "새 로그 만들기"·"초대코드로 들어가기" 2개 액션을 렌더한다 (AC6)', () => {
    setup();
    expect(screen.getByText('새 로그 만들기')).toBeTruthy();
    expect(screen.getByText('초대코드로 들어가기')).toBeTruthy();
  });

  it('visible=false면 액션을 렌더하지 않는다', () => {
    setup({ visible: false });
    expect(screen.queryByText('새 로그 만들기')).toBeNull();
  });

  it('"새 로그 만들기" 탭 시 onCreate를 호출한다', () => {
    const { onCreate } = setup();
    fireEvent.press(screen.getByText('새 로그 만들기'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('"초대코드로 들어가기" 탭 시 onJoin을 호출한다', () => {
    const { onJoin } = setup();
    fireEvent.press(screen.getByText('초대코드로 들어가기'));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});
