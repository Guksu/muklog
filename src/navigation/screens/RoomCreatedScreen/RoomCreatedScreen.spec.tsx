// src/navigation/screens/RoomCreatedScreen.spec.tsx
// 로그 생성 완료 축하 화면 — 킷 mk-home CreatedScreen(273-289) 재현.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { RoomCreatedScreen } from './RoomCreatedScreen';

describe('RoomCreatedScreen', () => {
  const baseProps = { inviteCode: 'MK7P3A', onEnter: jest.fn(), onLater: jest.fn() };

  it('축하 카피와 초대코드를 렌더한다', () => {
    renderWithTheme(<RoomCreatedScreen {...baseProps} />);
    expect(screen.getByText('우리 로그가 만들어졌어요')).toBeTruthy();
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

  // 🎉 스케일 팝(motion-pass-1 M5②) — 궤적이 아니라 "감소 모션에서 이동을 걸지 않는다"는 계약만 본다.
  it('🎉는 축하 연출로 스케일이 걸린다', () => {
    renderWithTheme(<RoomCreatedScreen {...baseProps} />);
    const style = StyleSheet.flatten(screen.getByText('🎉').props.style) as Record<string, unknown>;
    expect(style.transform).toBeDefined();
  });

  it('감소 모션이면 🎉에 transform을 걸지 않는다(fe-craft #8)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    renderWithTheme(<RoomCreatedScreen {...baseProps} />);
    await waitFor(() => {
      const style = StyleSheet.flatten(screen.getByText('🎉').props.style) as Record<
        string,
        unknown
      >;
      expect(style.transform).toBeUndefined();
    });
    jest.restoreAllMocks();
  });
});