// src/features/map/components/MapLegend.tsx
// 지도 범례 — 킷 mk-home.jsx:281-284,306-312 Legend 재현 (map-tab 슬라이스 1).
//   "우리 맛집"(primary dot) / "주변 음식점"(웜그레이 dot, 킷 #B6ABA0=mapNearbyPin) 칩 2개.
//   현 MapTabScreen 인라인 LegendChip을 이 컴포넌트로 추출·정합(인라인 중복 제거).
//   킷 칩: rgba(255,255,255,.85)+backdrop-blur(6px) → RN blur 미지원, surface 불투명 근사(ui-spec 기록).
//   킷 칩 텍스트 700/11 → caption(12/Medium) 근사. dot 9×9 full radius.
//   위치(top/left 오프셋)는 부모(지도 오버레이)가 absolute로 배치 — 이 컴포넌트는 칩 묶음만(레이아웃 책임 분리).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

// 범례 3종 — 킷 mk-home:282-283은 우리 맛집·주변 음식점 2종뿐(위시 핀은 킷에 없음, map-wish-pins 신설).
//   위시 항목은 킷 위시 보이스("가보고 싶은 곳", mk-extra:195)를 주변/맛집과 평행한 짧은 명사구로 축약한 "가고 싶은 곳".
//   dot 색은 mapWishPin(앰버 #FFB23E) — 핀 색과 단일 출처. enum-style 상수로 고정.
const LEGEND_ITEMS: ReadonlyArray<{ dotColor: ColorToken; label: string }> = [
  { dotColor: 'primary', label: '우리 맛집' },
  { dotColor: 'mapWishPin', label: '가고 싶은 곳' },
  { dotColor: 'mapNearbyPin', label: '주변 음식점' },
];

const LegendChip = ({ dotColor, label }: { dotColor: ColorToken; label: string }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.full,
          gap: theme.spacing[6],
        },
      ]}
    >
      <View testID="map-legend-dot" style={[styles.dot, { backgroundColor: theme.color[dotColor] }]} />
      <Text variant="caption" color="fgWeak">
        {label}
      </Text>
    </View>
  );
};

export const MapLegend = () => {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing[8] }]}>
      {LEGEND_ITEMS.map((item) => (
        <LegendChip key={item.label} dotColor={item.dotColor} label={item.label} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // 킷 padding 5×10(mk-home:308).
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10 },
  // 킷 dot 9×9 full radius(mk-home:309).
  dot: { width: 9, height: 9, borderRadius: 4.5 },
});
