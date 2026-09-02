// src/components/Button.tsx
// 버튼 — 킷 mk-ui.jsx:79-104 MkButton 정합 (A2).
//   variant: primary(accent bg + accentShadow 그림자) / soft(primaryWeak + accentStrong) / ghost(투명 + fgWeak)
//            / secondary(surface + hairline 보더 — 기존 소비처 호환 보존).
//   size: lg/md/sm — 킷 pad·fontSize 실값(컨트롤 내부 레이아웃 수치, enum-style 상수).
//   leftIcon(아이콘+텍스트 gap 8), full(가로 채움), loading/disabled(opacity 0.45) 상태.
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

import { Icon, IconName } from '../Icon';
import { MotionPressable } from '../MotionPressable';
import { Text } from '../Text';

type Variant = 'primary' | 'soft' | 'ghost' | 'secondary';
type Size = 'lg' | 'md' | 'sm';

// 킷 MkButton 사이즈별 pad·fontSize 실값(컨트롤 내부 수치 — 4px 그리드 밖이라 토큰화 안 함).
//   lineHeight = round(fontSize × 1.2)(킷 lineHeight 1.2).
// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0). 축소 연출은 MotionPressable이 얹는다.
const PRESSED_OPACITY = 0.85;

const BUTTON_SIZE = {
  lg: { paddingVertical: 16, paddingHorizontal: 22, fontSize: 17, lineHeight: 20, iconSize: 20 },
  md: { paddingVertical: 13, paddingHorizontal: 18, fontSize: 16, lineHeight: 19, iconSize: 19 },
  sm: { paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, lineHeight: 17, iconSize: 17 },
} as const;

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  /** 텍스트 앞 아이콘(IconName). 색은 variant 텍스트색을 따른다. */
  leftIcon?: IconName;
  /** true면 부모 폭을 채운다(alignSelf stretch). */
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export const Button = ({
  title,
  variant = 'primary',
  size = 'md',
  leftIcon,
  full = false,
  loading = false,
  disabled = false,
  style,
  ...rest
}: ButtonProps) => {
  const theme = useTheme();
  const isInactive = disabled || loading;
  const dim = BUTTON_SIZE[size];

  // variant별 배경/텍스트색 토큰.
  const bg: string =
    variant === 'primary'
      ? theme.color.primary
      : variant === 'soft'
        ? theme.color.primaryWeak
        : variant === 'secondary'
          ? theme.color.surface
          : 'transparent';
  const fgToken: ColorToken =
    variant === 'primary'
      ? 'primaryFg'
      : variant === 'soft'
        ? 'accentStrong'
        : variant === 'secondary'
          ? 'fg'
          : 'fgWeak';

  // 킷: primary만 accentShadow 그림자(떠 있는 CTA). 나머지는 그림자 없음.
  const primaryShadow: ViewStyle =
    variant === 'primary' && !isInactive
      ? {
          shadowColor: theme.color.accentShadow,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }
      : {};

  const container: ViewStyle = {
    backgroundColor: bg,
    borderColor: theme.color.hairline,
    borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
    borderRadius: theme.radius.control,
    paddingVertical: dim.paddingVertical,
    paddingHorizontal: dim.paddingHorizontal,
    opacity: isInactive ? 0.45 : 1,
    // full이면 명시적으로 부모 폭을 채운다. 미지정 시 alignSelf를 강제하지 않아 기존 소비처(stretch 부모) 레이아웃을 보존한다.
    alignSelf: full ? 'stretch' : undefined,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryShadow,
  };

  const labelStyle: TextStyle = { fontSize: dim.fontSize, lineHeight: dim.lineHeight };

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      pressSize="md"
      pressedOpacity={PRESSED_OPACITY}
      style={[container, style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={theme.color[fgToken]} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <Icon name={leftIcon} size={dim.iconSize} color={fgToken} /> : null}
          <Text variant="button" color={fgToken} style={labelStyle}>
            {title}
          </Text>
        </View>
      )}
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  // 킷 gap 8(아이콘↔텍스트).
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
