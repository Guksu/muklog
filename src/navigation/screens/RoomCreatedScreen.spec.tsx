// src/navigation/screens/RoomCreatedScreen.spec.tsx
// 로그 생성 완료 축하 화면 — 킷 mk-home CreatedScreen(196-214) 재현.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { RoomCreatedScreen } from './RoomCreatedScreen';

describe('RoomCreatedScreen', () => {
  const baseProps = { inviteCode: 'MK7P3A', onEnter: jest.fn(), onLater: jest.fn() };

  it('축하 카피와 초대코드를 렌더한다', () => {
    renderWithTheme(<RoomCreatedScreen {...baseProps} />);
    expect(screen.getByText('새 로그가 만들어졌어요')).toBeTruthy();
    expect(screen.getByText('MK7P3A')).toBeTruthy();
  });

  it('"로그 열기" 탭 시 onEnter를 호출한다', () => {
    const onEnter = jest.fn();
    renderWithTheme(<RoomCreatedScreen {...baseProps} onEnter={onEnter} />);
    fireEvent.press(screen.getByLabelText('로그 열기'));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('"나중에" 탭 시 onLater를 호출한다', () => {
    const onLater = jest.fn();
    renderWithTheme(<RoomCreatedScreen {...baseProps} onLater={onLater} />);
    fireEvent.press(screen.getByLabelText('나중에'));
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
