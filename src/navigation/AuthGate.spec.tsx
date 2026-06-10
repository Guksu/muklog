// src/navigation/AuthGate.spec.tsx
// 루트 게이트 — AuthState 3분기 렌더(멀티 로그 전환: 멤버십 게이트 없이 HomeTabs 직행).
//   loading → SplashView / error → AuthErrorView(retry) / authenticated → MyLogsProvider+AppNavigator.
// (plan §4.2 / §5 T6, C7) NavigationContainer·AppNavigator·MyLogsProvider·useAuth 모킹(네비 컨테이너는 단위 대상 아님).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

// MyLogsProvider: children passthrough + 주입 userId 캡처(게이트가 인증 userId를 넘기는지 검증).
const mockMyLogsProvider = jest.fn();
jest.mock('@/features/room', () => ({
  MyLogsProvider: (props: { userId: string; children: React.ReactNode }) => {
    mockMyLogsProvider(props.userId);
    return props.children;
  },
}));

// NavigationContainer: passthrough.
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

// AppNavigator: 마커로 대체(HomeTabs 직행 여부는 AppNavigator 자체 책임 → 여기선 렌더만 확인).
jest.mock('./AppNavigator', () => ({
  AppNavigator: () => {
    const RN = require('react-native');
    return <RN.Text>APP_NAVIGATOR</RN.Text>;
  },
}));

import { useAuth } from '@/features/auth';
import { AuthGate } from './AuthGate';

const useAuthMock = useAuth as jest.Mock;

beforeEach(() => {
  useAuthMock.mockReset();
  mockMyLogsProvider.mockReset();
});

describe('AuthGate', () => {
  it('loading이면 SplashView(준비 중…)를 표시한다', () => {
    useAuthMock.mockReturnValue({ state: { status: 'loading' }, retry: jest.fn() });
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('준비 중…')).toBeTruthy();
  });

  it('error면 메시지와 "다시 시도"를 표시하고, 누르면 retry를 호출한다', () => {
    const retry = jest.fn();
    useAuthMock.mockReturnValue({ state: { status: 'error', message: '연결 실패' }, retry });
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('연결에 문제가 있어요')).toBeTruthy();
    expect(screen.getByText('연결 실패')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(retry).toHaveBeenCalled();
  });

  it('authenticated면 게이트 없이 AppNavigator를 렌더하고 MyLogsProvider에 userId를 주입한다 (C7)', () => {
    useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('APP_NAVIGATOR')).toBeTruthy();
    expect(mockMyLogsProvider).toHaveBeenCalledWith('u1');
  });
});
