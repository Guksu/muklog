// src/navigation/screens/LogScreen.spec.tsx
// 로그 상세(최소 stub) — route.params.roomId 표시 placeholder + roomId 누락 방어. (plan §4.7 / §5 T10, C10)
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockParams: { current: unknown } = { current: { roomId: 'r1' } };
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams.current }),
}));

import { LogScreen } from './LogScreen';

describe('LogScreen', () => {
  it('roomId가 있으면 준비 중 placeholder와 roomId를 표시한다', () => {
    mockParams.current = { roomId: 'r-123' };
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그 화면 (준비 중)')).toBeTruthy();
    expect(screen.getByText(/r-123/)).toBeTruthy();
  });

  it('roomId가 없으면(직접 진입 등) 안전 메시지를 표시한다 (크래시 방지)', () => {
    mockParams.current = {};
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('params 자체가 undefined여도 안전 메시지를 표시한다', () => {
    mockParams.current = undefined;
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });
});
