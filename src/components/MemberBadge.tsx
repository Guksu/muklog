// src/components/MemberBadge.tsx
// 멤버 배지(혼자/둘이) — 킷 mk-ui.jsx:138-152 MemberBadge 정합 (A4 / plan §3.4).
//   memberCount>=2 → 💑 "둘이"(primaryWeak 배경 + accentStrong 텍스트).
//   memberCount<2  → 🙋 "혼자"(surfaceAlt 배경 + fgWeak 텍스트 — plan 결정. 킷 --text-alternative≈fgMuted 대비 가독성 우선).
//   700/11.5(badge typography), pad 3/9/3/7, gap 4, radius full, 이모지 12.
import React from 'react';
import { StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type MemberBadgeProps = {
  /** 로그 멤버 수. 2 이상이면 커플("둘이"), 미만이면 솔로("혼자"). */
  memberCount: number;
  /** 테스트/접근성 식별자. */
  testID?: string;
};

export const MemberBadge = ({ memberCount, testID = 'member-badge' }: MemberBadgeProps) => {
  const theme = useTheme();
  const couple = memberCount >= 2;
  const container: ViewStyle = {
    backgroundColor: couple ? theme.color.primaryWeak : theme.color.surfaceAlt,
    borderRadius: theme.radius.full,
  };
  return (
    <View testID={testID} style={[styles.badge, container]}>
      <RNText style={styles.emoji}>{couple ? '💑' : '🙋'}</RNText>
      <Text variant="badge" color={couple ? 'accentStrong' : 'fgWeak'}>
        {couple ? '둘이' : '혼자'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // 킷 pad 3/9/3/7, gap 4(컨트롤 내부 수치).
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 9,
  },
  emoji: { fontSize: 12 },
});
