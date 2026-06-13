// src/navigation/AuthGate.spec.tsx
// 루트 게이트 — AuthState 3분기 렌더(멀티 로그 전환: 멤버십 게이트 없이 HomeTabs 직행).
//   loading → SplashView / error → AuthErrorView(retry) / authenticated → MyLogsProvider+AppNavigator.
// (plan §4.2 / §5 T6, C7) NavigationContainer·AppNavigator·MyLogsProvider·useAuth 모킹(네비 컨테이너는 단위 대상 아님).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

// LoginScreen: 마커 + 주입 props(authenticating/loginError) 캡처(게이트 배선 검증).
const mockLoginScreen = jest.fn();
jest.mock('./screens/LoginScreen', () => ({
  LoginScreen: (props: { authenticating: string | null; loginError: string | null }) => {
    mockLoginScreen(props);
    const RN = require('react-native');
    return <RN.Text>LOGIN_SCREEN</RN.Text>;
  },
}));

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

// useAuth 모킹 헬퍼 — 신규 메서드/필드 stub 포함(plan §3.2 표면).
const authValue = (state: unknown, overrides?: Record<string, unknown>) => ({
  state,
  retry: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
  loginError: null,
  ...overrides,
});

beforeEach(() => {
  useAuthMock.mockReset();
  mockMyLogsProvider.mockReset();
  mockLoginScreen.mockReset();
});

describe('AuthGate', () => {
  it('loading이면 SplashView(브랜드 스플래시)를 표시한다', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'loading' }));
    renderWithTheme(<AuthGate />);
    // 킷 SplashScreen 정합(social-auth ④): 워드마크 + 태그라인.
    expect(screen.getByText('둘이 함께 쌓는 맛집 지도')).toBeTruthy();
  });

  it('error면 메시지와 "다시 시도"를 표시하고, 누르면 retry를 호출한다', () => {
    const retry = jest.fn();
    useAuthMock.mockReturnValue(authValue({ status: 'error', message: '연결 실패' }, { retry }));
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('연결에 문제가 있어요')).toBeTruthy();
    expect(screen.getByText('연결 실패')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(retry).toHaveBeenCalled();
  });

  it('authenticated면 게이트 없이 AppNavigator를 렌더하고 MyLogsProvider에 userId를 주입한다 (C7)', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'authenticated', userId: 'u1' }));
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('APP_NAVIGATOR')).toBeTruthy();
    expect(mockMyLogsProvider).toHaveBeenCalledWith('u1');
  });

  it('unauthenticated면 LoginScreen을 렌더한다(authenticating=null, loginError 전달)', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'unauthenticated' }, { loginError: '네트워크 연결을 확인해 주세요.' }));
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('LOGIN_SCREEN')).toBeTruthy();
    expect(mockLoginScreen).toHaveBeenCalledWith(
      expect.objectContaining({ authenticating: null, loginError: '네트워크 연결을 확인해 주세요.' }),
    );
  });

  it('authenticating면 LoginScreen + 해당 provider 로딩(authenticating=provider) 전달', () => {
    useAuthMock.mockReturnValue(authValue({ status: 'authenticating', provider: 'google' }));
    renderWithTheme(<AuthGate />);
    expect(screen.getByText('LOGIN_SCREEN')).toBeTruthy();
    expect(mockLoginScreen).toHaveBeenCalledWith(
      expect.objectContaining({ authenticating: 'google', loginError: null }),
    );
  });

  it('LoginScreen에 onGoogle=signInWithGoogle / onApple=signInWithApple을 배선한다', () => {
    const signInWithGoogle = jest.fn();
    const signInWithApple = jest.fn();
    useAuthMock.mockReturnValue(
      authValue({ status: 'unauthenticated' }, { signInWithGoogle, signInWithApple }),
    );
    renderWithTheme(<AuthGate />);
    const props = mockLoginScreen.mock.calls[0][0];
    props.onGoogle();
    props.onApple();
    expect(signInWithGoogle).toHaveBeenCalled();
    expect(signInWithApple).toHaveBeenCalled();
  });
});
