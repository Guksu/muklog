// src/theme/ThemeProvider.tsx
// 테마 주입 + useTheme() 훅. MVP는 light 고정.
// 다크는 토큰에 정의돼 있으나(themes.dark) 토글 UI는 후속 스프린트.
import React, { createContext, useContext } from 'react';

import { themes, type Theme } from './tokens';

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
  /** MVP는 'light' 고정. 다크 토글은 후속 스프린트에서 useColorScheme 등으로 연결. */
  scheme?: 'light' | 'dark';
};

export const ThemeProvider = ({ children, scheme = 'light' }: ThemeProviderProps) => {
  // themes.light/dark는 동일 구조이나 `as const`로 색상 문자열 리터럴 타입이 서로 달라
  // 직접 대입이 안 된다(둘 다 Theme 형태). light 기준 타입으로 정규화한다.
  // (단순 인덱싱이라 useMemo 불필요 — 컨벤션상 useMemo 지양.)
  const value = themes[scheme] as Theme;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * 현재 테마 객체({ color, spacing, radius, shadow, typography })를 반환.
 * Provider 바깥에서 호출하면 명확히 throw 한다(런타임 undefined 접근 방지).
 */
export const useTheme = (): Theme => {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme()는 <ThemeProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
