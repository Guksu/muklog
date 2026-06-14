// src/navigation/screens/MapTabScreen.tsx
// 지도 탭 셸 — 킷 mk-home.jsx:247-327 MapScreen 중 헤더/범례 셸만 선반영 (FLAG-2).
//   헤더("지도" 워드마크)는 HomeTabs의 HomeHeader가 제공. 이 화면은 지도 영역 + 범례(우리 맛집/주변 음식점).
//   실제 지도 렌더링·핀·선택 스팟 카드는 map-tab 스프린트(Kakao Map SDK)에서 — 여기선 정적 셸.
//   범례 dot 색: 우리 맛집=primary(킷 --mk-accent), 주변 음식점=fgMuted(킷 #B6ABA0 웜그레이 근사 — 전용 토큰 없음, 실지도 스프린트에서 정밀화).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

const LegendChip = ({ dotColor, label }: { dotColor: ColorToken; label: string }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.legendChip,
        { backgroundColor: theme.color.surface, borderRadius: theme.radius.full, gap: theme.spacing[6] },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.color[dotColor] }]} />
      <Text variant="caption" color="fgWeak">
        {label}
      </Text>
    </View>
  );
};

export const MapTabScreen = () => {
  const theme = useTheme();
  return (
    <View style={[styles.map, { backgroundColor: theme.color.surfaceAlt }]}>
      {/* 범례 — 킷 mk-home:281-284(top 14 / left 16, gap 8). */}
      <View style={[styles.legend, { top: theme.spacing[14], left: theme.spacing[16], gap: theme.spacing[8] }]}>
        <LegendChip dotColor="primary" label="우리 맛집" />
        <LegendChip dotColor="fgMuted" label="주변 음식점" />
      </View>

      {/* 지도 영역 플레이스홀더 — 실제 Kakao Map은 map-tab 스프린트. */}
      <View style={[styles.hint, { gap: theme.spacing[8] }]}>
        <Icon name={IconName.Location} size={32} color="fgAssistive" />
        <Text variant="bodySm" color="fgMuted" style={styles.center}>
          지도는 곧 제공돼요
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  map: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  legend: { position: 'absolute', flexDirection: 'row' },
  legendChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  hint: { alignItems: 'center' },
  center: { textAlign: 'center' },
});
