// App.spec.tsx
// 앱 루트 배선 스모크 (app-version-gate plan §4.1·§5 T7) — AppVersionGate가 AuthGate를 감싸 트리에 존재하는지 가드.
//   목적: 배선 누락(App.tsx가 AuthGate를 그대로 렌더)이 런타임에만 드러나던 사각지대를 테스트로 회귀 방지.
//   무거운 leaf(폰트·스플래시·프로바이더·게이트·게이트 자식)는 패스스루/스텁으로 대체하고 "래핑 구조"만 검증.
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react-native';

// 폰트/스플래시 — 즉시 resolve(ready 전환) + 모듈 로드 시 preventAutoHide 호출 안전.
jest.mock('expo-font', () => ({ loadAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/theme/fonts', () => ({ fontMap: {} }));

// 프로바이더 — 전부 패스스루(children 그대로 렌더)로 트리 무게 제거.
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/features/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// 푸시 수신 훅(push-receive-ux T6) — 구동 여부만 관찰(SDK 접촉은 usePushReceive 유닛에서 검증).
jest.mock('@/features/notif/usePushReceive', () => ({ usePushReceive: jest.fn() }));
import { usePushReceive } from '@/features/notif/usePushReceive';
const usePushReceiveMock = usePushReceive as jest.Mock;

// 검증 대상 배선 — AppVersionGate가 children(AuthGate)을 감싸는지.
jest.mock('@/features/appVersion', () => ({
  AppVersionGate: ({ children }: { children: React.ReactNode }) => {
    const { View: RnView, Text: RnText } = require('react-native');
    return (
      <RnView testID="app-version-gate">
        <RnText>gate</RnText>
        {children}
      </RnView>
    );
  },
}));
jest.mock('@/navigation', () => {
  const { View: RnView } = require('react-native');
  return { AuthGate: () => <RnView testID="auth-gate" /> };
});

import App from './App';

describe('App 루트 배선 (T7)', () => {
  it('AppVersionGate가 AuthGate를 감싸 앱 트리에 마운트된다(게이트 배선 회귀 가드)', async () => {
    render(<App />);

    // 폰트 로드(즉시 resolve) → ready 전환 후 트리 렌더.
    await waitFor(() => expect(screen.getByTestId('app-version-gate')).toBeTruthy());

    // AuthGate가 AppVersionGate 내부(자식)에 존재해야 한다 — 래핑 구조 확정.
    const gate = screen.getByTestId('app-version-gate');
    expect(within(gate).getByTestId('auth-gate')).toBeTruthy();
  });

  it('AC21: 앱 부팅 시 usePushReceive를 1회 구동한다(전역 수신 UX 배선)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-version-gate')).toBeTruthy());
    expect(usePushReceiveMock).toHaveBeenCalled();
  });
});
