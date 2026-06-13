// src/navigation/screens/SplashView.spec.tsx
// 스플래시 — 킷 mk-auth.jsx:53-74 SplashScreen 정합(그라데이션 + AppMark + 워드마크 + 태그라인 + 스피너).
//   AuthGate loading 상태에서 소비. props 없는 기존 계약 유지.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { SplashView } from './SplashView';

describe('SplashView', () => {
  it('브랜드 마크와 워드마크를 렌더한다', () => {
    renderWithTheme(<SplashView />);
    expect(screen.getByTestId('app-mark')).toBeTruthy();
    expect(screen.getByText('muklog')).toBeTruthy();
  });

  it('킷 태그라인 "둘이 함께 쌓는 맛집 지도"를 표시한다', () => {
    renderWithTheme(<SplashView />);
    expect(screen.getByText('둘이 함께 쌓는 맛집 지도')).toBeTruthy();
  });

  it('로딩 스피너(ActivityIndicator)를 표시한다', () => {
    renderWithTheme(<SplashView />);
    expect(screen.getByTestId('splash-spinner')).toBeTruthy();
  });
});
