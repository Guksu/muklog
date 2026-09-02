// src/components/IconButton.tsx
// 둥근 아이콘 버튼(헤더용) — 킷 mk-ui.jsx:106-118 MkIconBtn 정합 (A7).
//   40×40 원형, 아이콘 size 기본 22, color/bg 토큰. badge=accent 도트(top7/right8, 8×8, bg색 2px 링).
//   아이콘 단독 버튼이므로 accessibilityLabel 필수(접근성).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

import { Icon, IconName } from '../Icon';
import { MotionPressable } from '../MotionPressable';

// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.6;

export type IconButtonProps = {
  /** 렌더할 아이콘(IconName). */
  name: IconName;
  /** 탭 콜백. */
  onPress?: () => void;
  /** 아이콘 한 변(px). 기본 22(킷). 컨테이너는 40×40 고정. */
  size?: number;
  /** 아이콘 색 토큰. 기본 'fg'. */
  color?: ColorToken;
  /** 배경 토큰. 미지정 시 투명. */
  bg?: ColorToken;
  /** accent 도트 배지 표시 여부. */
  badge?: boolean;
  /** 아이콘 단독 버튼의 접근성 라벨(필수). */
  accessibilityLabel: string;
  /** 테스트 식별자. */
  testID?: string;
};

export const IconButton = ({
  name,
  onPress,
  size = 22,
  color = 'fg',
  bg,
  badge = false,
  accessibilityLabel,
  testID,
}: IconButtonProps) => {
  const theme = useTheme();
  const container: ViewStyle = {
    backgroundColor: bg ? theme.color[bg] : 'transparent',
    borderRadius: theme.radius.full,
  };
  // 배지 링: 헤더 배경색(bg)으로 2px 테두리 → 도트가 떠 보이게(킷 box-shadow 0 0 0 2px --mk-bg 근사).
  const badgeStyle: ViewStyle = {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.bg,
  };
  return (
    <MotionPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      pressSize="sm"
      pressedOpacity={PRESSED_OPACITY}
      style={[styles.button, container]}
    >
      <Icon name={name} size={size} color={color} />
      {badge ? <View testID="icon-button-badge" style={[styles.badge, badgeStyle]} /> : null}
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  // 킷 40×40 원형.
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 킷 도트 top7/right8, 8×8, 2px 링.
  badge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
});
