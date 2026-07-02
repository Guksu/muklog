// src/components/Text.tsx
// 토큰 typography + 시맨틱 컬러를 적용하는 공용 텍스트. raw 색/숫자 색 하드코딩 금지.
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorToken, TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  /** 타이포 토큰 변형(typography 키). 기본 'body'. */
  variant?: TypographyVariant;
  /** 시맨틱 컬러 별칭(color 토큰 키). 기본 'fg'. */
  color?: ColorToken;
};

export const Text = ({ variant = 'body', color = 'fg', style, ...rest }: TextProps) => {
  const theme = useTheme();
  const base: TextStyle = {
    ...theme.typography[variant],
    color: theme.color[color],
  };
  return <RNText style={[base, style]} {...rest} />;
}
