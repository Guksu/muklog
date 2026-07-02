// src/features/appVersion/AppVersionRow/AppVersionRow.spec.tsx
// Profile 앱 버전 행(app-version-gate T10) — 표시 전용 프리젠테이션.
//   버전 문자열은 props(값 배선=developer/expo-constants). 여기선 렌더·비-pressable만 본다.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { AppVersionRow } from './AppVersionRow';

describe('AppVersionRow', () => {
  it('"앱 버전 {version}"을 렌더한다', () => {
    renderWithTheme(<AppVersionRow version="1.0.0" />);
    expect(screen.getByText('앱 버전 1.0.0')).toBeTruthy();
  });

  it('다른 버전 문자열도 그대로 표시한다', () => {
    renderWithTheme(<AppVersionRow version="2.3.1" />);
    expect(screen.getByText('앱 버전 2.3.1')).toBeTruthy();
  });

  it('표시 전용(비-pressable) — 버튼 롤이 아니다', () => {
    renderWithTheme(<AppVersionRow version="1.0.0" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
