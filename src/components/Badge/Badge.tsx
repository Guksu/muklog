// src/components/Badge.tsx
// 공용 배지 — pill 라벨(멤버 배지 등) (plan §5-7, T10 / muklog 킷 MemberBadge 정합).
//   tone: primary(accent-weak 배경 + accentStrong 텍스트) / neutral(surfaceAlt 배경 + fgWeak 텍스트).
//   typography 'badge'(700/11.5 근사). 스타일은 토큰만(raw hex 0).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from '../Text';

type BadgeTone = 'primary' | 'neutral';

export type BadgeProps = {
  /** 배지 문구(짧은 라벨). */
  label: string;
  /** 색조. 기본 'primary'. */
  tone?: BadgeTone;
  /** 테스트/접근성용 식별자. */
  testID?: string;
};

export const Badge = ({ label, tone = 'primary', testID }: BadgeProps) => {
  const theme = useTheme();
  const bg = tone === 'primary' ? theme.color.primaryWeak : theme.color.surfaceAlt;
  const container: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[10],
  };
  return (
    <View testID={testID} style={[styles.badge, container]}>
      <Text variant="badge" color={tone === 'primary' ? 'accentStrong' : 'fgWeak'}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
});
