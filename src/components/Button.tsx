// src/components/Button.tsx
// 토큰 color/radius/spacing 기반 버튼. loading/disabled 상태를 시각적으로 구분.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isInactive = disabled || loading;

  const bg =
    variant === 'primary' ? theme.color.primary : theme.color.surface;
  const fg =
    variant === 'primary' ? theme.color.primaryFg : theme.color.fg;
  const borderColor =
    variant === 'primary' ? theme.color.primary : theme.color.border;

  const container: ViewStyle = {
    backgroundColor: bg,
    borderColor,
    borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing[14],
    paddingHorizontal: theme.spacing[20],
    opacity: isInactive ? 0.5 : 1,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      style={({ pressed }) => [container, pressed && !isInactive ? styles.pressed : null, style]}
      {...rest}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={fg} />
        </View>
      ) : (
        <Text variant="body" color={variant === 'primary' ? 'primaryFg' : 'fg'}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
