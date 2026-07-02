// src/components/SocialButton.spec.tsx
// 소셜 로그인 버튼 — 킷 mk-auth.jsx:118-158 SocialButton/AppleLogo/GoogleLogo 정합.
//   apple(검정 무테) / google(흰+lineStrong 보더), 54h, radius control(14), 700/16, 좌측 로고.
//   누르면 onPress 호출만(실제 OAuth는 developer). loading/disabled 시 콜백 차단.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { SocialButton } from './SocialButton';

describe('SocialButton', () => {
  it('apple variant는 "Apple로 계속하기" 레이블을 렌더한다', () => {
    renderWithTheme(<SocialButton variant="apple" onPress={() => {}} />);
    expect(screen.getByText('Apple로 계속하기')).toBeTruthy();
  });

  it('google variant는 "Google로 계속하기" 레이블을 렌더한다', () => {
    renderWithTheme(<SocialButton variant="google" onPress={() => {}} />);
    expect(screen.getByText('Google로 계속하기')).toBeTruthy();
  });

  it('누르면 onPress를 1회 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(<SocialButton variant="google" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled면 눌러도 onPress를 호출하지 않는다', () => {
    const onPress = jest.fn();
    renderWithTheme(<SocialButton variant="google" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading이면 스피너를 노출하고 onPress를 호출하지 않는다(중복 탭 방지)', () => {
    const onPress = jest.fn();
    renderWithTheme(<SocialButton variant="apple" onPress={onPress} loading />);
    expect(screen.getByTestId('social-button-spinner')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
