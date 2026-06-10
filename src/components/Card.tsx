// src/components/Card.tsx
// 공용 카드 surface — muklog LogCard 소프트 웜 섀도우(보더 대신 그림자), card radius(22) (plan §5-6, T9 / ui-redesign 보정).
//   onPress 가 있으면 Pressable, 없으면 View. 스타일은 토큰만(raw hex 0).
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

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
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed ? styles.pressed : null, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
});
