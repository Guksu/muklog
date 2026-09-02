// src/components/Chip.tsx
// 칩(카테고리·필터) — 킷 mk-ui.jsx:120-136 MkChip 정합 (A3).
//   selected: primary 배경 + primaryFg(#fff) 텍스트, 보더 없음.
//   unselected: surface 배경 + fgWeak 텍스트 + 헤어라인 보더(--line).
//   radius full, pad 8×13, gap 5, 600/13.5(SemiBold), emoji 옵션(14). 가로 스크롤 행에서 재사용.
import React from 'react';
import { StyleSheet, Text as RNText, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { MotionPressable } from '../MotionPressable';
import { Text } from '../Text';

// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.85;

export type ChipProps = {
  /** 칩 라벨(예: 카테고리명·"전체"). */
  label: string;
  /** 선택 상태. */
  selected?: boolean;
  /** 탭 콜백. */
  onPress?: () => void;
  /** 라벨 앞 이모지(옵션). */
  emoji?: string;
  /** 테스트/접근성 식별자. */
  testID?: string;
};

export const Chip = ({ label, selected = false, onPress, emoji, testID }: ChipProps) => {
  const theme = useTheme();
  const container: ViewStyle = {
    backgroundColor: selected ? theme.color.primary : theme.color.surface,
    borderColor: theme.color.hairline,
    borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
    borderRadius: theme.radius.full,
  };
  return (
    <MotionPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      pressSize="md"
      pressedOpacity={PRESSED_OPACITY}
      style={[styles.chip, container]}
    >
      {emoji ? <RNText style={styles.emoji}>{emoji}</RNText> : null}
      {/* 킷 600/13.5 — SemiBold(spotCount) family에 fontSize 13.5 오버라이드. */}
      <Text variant="spotCount" color={selected ? 'primaryFg' : 'fgWeak'} style={styles.label}>
        {label}
      </Text>
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  // 킷 pad 8×13, gap 5(컨트롤 내부 수치).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  emoji: { fontSize: 14 },
  label: { fontSize: 13.5 },
});
