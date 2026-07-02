// src/components/MemberBadge.tsx
// 멤버 배지(혼자/N명) — 킷 mk-ui.jsx:143-155 MemberBadge 정합 (AC4 / plan §3.4).
//   memberCount>=2 → "N명"(primaryWeak 배경 + accentStrong 텍스트).
//   memberCount<=1 → "혼자"(surfaceAlt 배경 + fgWeak 텍스트 — plan 결정. 킷 --text-alternative≈fgMuted 대비 가독성 우선).
//   신 사양: 이모지(💑/🙋) 없음 — 텍스트만. 700/11.5(badge typography), pad 3/9/3/7, radius full.
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type MemberBadgeProps = {
  /** 로그 멤버 수. 2 이상이면 커플("N명"), 1 이하면 솔로("혼자"). */
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
      <Text variant="badge" color={couple ? 'accentStrong' : 'fgWeak'}>
        {memberCount <= 1 ? '혼자' : `${memberCount}명`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // 킷 pad 3/9/3/7(컨트롤 내부 수치). 이모지 제거로 gap 불필요 → 정리.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 9,
  },
});
