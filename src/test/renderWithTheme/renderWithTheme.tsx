// src/test/renderWithTheme.tsx
// 테스트 렌더 헬퍼 — ThemeProvider(useTheme)와 SafeAreaProvider(Screen의 SafeAreaView)로 감싼다.
// 콜로케이션 규칙 예외: 테스트 전용 헬퍼는 src/test/ 한 곳에 모은다(plan §5-1 (6) 메모).
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme';

import { ToastProvider } from '@/components';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// ToastProvider를 기본 포함 — 전역 토스트 이관 후(useToastController) 화면/컴포넌트 spec이 추가 래핑 없이 동작한다.
//   App.tsx의 실제 트리(SafeArea→Theme→ToastProvider)와 동일 순서로 둔다.
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={initialMetrics}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

/**
 * ThemeProvider + SafeAreaProvider로 감싼 채 컴포넌트를 렌더한다.
 * @param ui 렌더할 엘리먼트
 * @param options @testing-library/react-native RenderOptions(wrapper 제외)
 * @returns render 결과
 */
export const renderWithTheme = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });
