// src/navigation/screens/LoginScreen.spec.tsx
// 로그인 화면 골격 — 킷 mk-auth.jsx:85-115 LoginScreen 정합(상단 비주얼 + 하단 소셜 버튼 + 약관).
//   비주얼/레이아웃만 담당. 핸들러·상태는 developer가 useAuth로 주입(props 계약).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LoginScreen } from './LoginScreen';

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
      screen.getByText('데이트하며 다닌 맛집을\n사진·메모·위치로 둘이 함께 기록해요.'),
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
});
