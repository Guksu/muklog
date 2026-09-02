// src/navigation/AppNavigator.spec.tsx
// 스택 네비게이터의 화면 옵션 계약 — 네이티브 헤더 전역 숨김 + 화면 배경 토큰(motion-pass-1 qa-visual F4).
//   화면이 잠시 투명해지는 순간(SwapTransition 전환)에 react-navigation 기본 배경 rgb(242,242,242)가
//   비치지 않아야 한다 → 네비게이터가 앱 배경 토큰을 깔고 있는지 screenOptions로 잠근다.
//   Navigator/Screen과 화면 모듈은 스텁 — 이 스펙이 보는 것은 "어떤 옵션으로 스택을 여는가" 하나다.
import React from 'react';
import { type ViewStyle } from 'react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

const mockNavigatorProps: Record<string, unknown>[] = [];

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: (props: Record<string, unknown>) => {
      mockNavigatorProps.push(props);
      return null;
    },
    Screen: () => null,
  }),
}));

jest.mock('../HomeTabs', () => ({ HomeTabs: () => null }));
jest.mock('../screens/JoinLogScreen', () => ({ JoinLogScreen: () => null }));
jest.mock('../screens/LogScreen', () => ({ LogScreen: () => null }));
jest.mock('../screens/NotifSettingsScreen', () => ({ NotifSettingsScreen: () => null }));
jest.mock('../screens/MuklogDetailRoute', () => ({ MuklogDetailRoute: () => null }));
jest.mock('../screens/MuklogEditorRoute', () => ({ MuklogEditorRoute: () => null }));
jest.mock('../screens/ProfileScreen', () => ({ ProfileScreen: () => null }));
jest.mock('../screens/RoomCreatedRoute', () => ({ RoomCreatedRoute: () => null }));

import { AppNavigator } from './AppNavigator';

const screenOptions = () => {
  renderWithTheme(<AppNavigator />);
  return mockNavigatorProps[mockNavigatorProps.length - 1].screenOptions as {
    headerShown: boolean;
    contentStyle?: ViewStyle;
  };
};

beforeEach(() => {
  mockNavigatorProps.length = 0;
});

describe('AppNavigator — 화면 옵션 계약', () => {
  it('네이티브 헤더를 전역으로 숨긴다(화면이 자체 헤더를 그린다)', () => {
    expect(screenOptions().headerShown).toBe(false);
  });

  it('화면 배경을 앱 배경 토큰으로 깐다 — 전환 중 네비게이터 기본 회색이 비치지 않는다 (F4)', () => {
    expect(screenOptions().contentStyle?.backgroundColor).toBe(themes.light.color.bg);
  });

  it('배경에 raw 색상을 하드코딩하지 않는다(토큰 경유)', () => {
    const background = screenOptions().contentStyle?.backgroundColor;
    // react-navigation v7 기본 배경(rgb(242,242,242))이 그대로 남아 있으면 안 된다.
    expect(background).not.toBe('rgb(242, 242, 242)');
    expect(background).toBeDefined();
  });
});
