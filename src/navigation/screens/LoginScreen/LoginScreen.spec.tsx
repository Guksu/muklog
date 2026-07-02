// src/navigation/screens/LoginScreen.spec.tsx
// 로그인 화면 골격 — 킷 mk-auth.jsx:85-115 LoginScreen 정합(상단 비주얼 + 하단 소셜 버튼 + 약관).
//   비주얼/레이아웃만 담당. 핸들러·상태는 developer가 useAuth로 주입(props 계약).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LoginScreen } from './LoginScreen';

// 약관/개인정보 링크 탭 → 인앱 브라우저(openBrowserAsync) 모킹.
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
});

const baseProps = {
  authenticating: null as 'google' | 'apple' | null,
  loginError: null as string | null,
  onGoogle: () => {},
  onApple: () => {},
};

describe('LoginScreen', () => {
  it('상단 비주얼(워드마크 + 카피)을 렌더한다', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple />);
    expect(screen.getByText('먹로그')).toBeTruthy();
    expect(
      screen.getByText('함께 다녀온 맛집을\n차곡차곡 모아봐요.'),
    ).toBeTruthy();
  });

  it('showApple=true면 Apple·Google 버튼 둘 다 렌더한다(iOS)', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple />);
    expect(screen.getByText('Apple로 계속하기')).toBeTruthy();
    expect(screen.getByText('Google로 계속하기')).toBeTruthy();
  });

  it('showApple=false면 Apple 버튼 비노출, Google만 렌더한다(Android)', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple={false} />);
    expect(screen.queryByText('Apple로 계속하기')).toBeNull();
    expect(screen.getByText('Google로 계속하기')).toBeTruthy();
  });

  it('Google/Apple 버튼 탭 시 각 콜백을 1회 호출한다', () => {
    const onGoogle = jest.fn();
    const onApple = jest.fn();
    renderWithTheme(
      <LoginScreen {...baseProps} showApple onGoogle={onGoogle} onApple={onApple} />,
    );
    fireEvent.press(screen.getByText('Google로 계속하기'));
    fireEvent.press(screen.getByText('Apple로 계속하기'));
    expect(onGoogle).toHaveBeenCalledTimes(1);
    expect(onApple).toHaveBeenCalledTimes(1);
  });

  it('authenticating=google이면 두 버튼 모두 disabled — 탭해도 콜백 미호출(중복 차단)', () => {
    const onGoogle = jest.fn();
    const onApple = jest.fn();
    renderWithTheme(
      <LoginScreen
        {...baseProps}
        showApple
        authenticating="google"
        onGoogle={onGoogle}
        onApple={onApple}
      />,
    );
    fireEvent.press(screen.getByText('Apple로 계속하기'));
    expect(onApple).not.toHaveBeenCalled();
    // google 버튼은 로딩 스피너로 전환되어 텍스트가 사라진다.
    expect(screen.queryByText('Google로 계속하기')).toBeNull();
    expect(screen.getByTestId('social-button-spinner')).toBeTruthy();
  });

  it('loginError가 있으면 인라인 에러 메시지를 표시한다', () => {
    renderWithTheme(
      <LoginScreen {...baseProps} showApple loginError="네트워크 연결을 확인해 주세요." />,
    );
    expect(screen.getByText('네트워크 연결을 확인해 주세요.')).toBeTruthy();
  });

  it('약관 문구를 표시한다', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple />);
    expect(
      screen.getByText(/서비스 약관.*개인정보 처리방침/s),
    ).toBeTruthy();
  });

  it('"서비스 약관" 탭 → 이용약관 URL을 인앱 브라우저로 연다', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple />);
    fireEvent.press(screen.getByLabelText('서비스 약관 열기'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://guksu.github.io/muklog-privacy/terms.html',
    );
  });

  it('"개인정보 처리방침" 탭 → 개인정보처리방침 URL을 인앱 브라우저로 연다', () => {
    renderWithTheme(<LoginScreen {...baseProps} showApple />);
    fireEvent.press(screen.getByLabelText('개인정보 처리방침 열기'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://guksu.github.io/muklog-privacy/privacy.html',
    );
  });
});
