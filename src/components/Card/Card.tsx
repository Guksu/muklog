// src/components/Card.tsx
// 공용 카드 surface — muklog LogCard 소프트 웜 섀도우(보더 대신 그림자), card radius(22) (plan §5-6, T9 / ui-redesign 보정).
//   onPress 가 있으면 Pressable, 없으면 View. 스타일은 토큰만(raw hex 0).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { MotionPressable } from '../MotionPressable';

// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.7;

export type CardProps = {
  children: React.ReactNode;
  /** 누름 가능 카드(리스트 행 등). 주면 Pressable 로 래핑. */
  onPress?: () => void;
  /** 테스트/접근성용 식별자. */
  testID?: string;
  /** 접근성 라벨(누름 카드일 때 권장). */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export const Card = ({ children, onPress, testID, accessibilityLabel, style }: CardProps) => {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing[16],
    ...theme.shadow.card,
  };

  if (onPress) {
    return (
      <MotionPressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        pressSize="lg"
        pressedOpacity={PRESSED_OPACITY}
        style={[base, style]}
      >
        {children}
      </MotionPressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {children}
    </View>
  );
};
