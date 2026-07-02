// src/features/appVersion/AppVersionRow/AppVersionRow.tsx
// Profile 앱 버전 행(app-version-gate T10) — 표시 전용 보조 텍스트.
//   킷 비종속 신설(킷 톤: caption/fgMuted 보조 텍스트, ProfileScreen 회원탈퇴 행과 동일 약톤).
//   버전 값은 props(현재 버전 취득=expo-constants는 developer 배선). 여기선 비주얼·문구만 소유.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components';

export type AppVersionRowProps = {
  /** 표시할 앱 버전 문자열(예: "1.0.0"). developer가 expo-constants 값으로 주입. */
  version: string;
};

export const AppVersionRow = ({ version }: AppVersionRowProps) => (
  <View testID="app-version-row" style={styles.row}>
    <Text variant="caption" color="fgMuted">
      앱 버전 {version}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  // 회원탈퇴 행(ProfileScreen deleteRow)과 동일한 최하단 보조 행 톤 — 중앙 정렬·비-pressable.
  row: { paddingVertical: 12, alignItems: 'center' },
});
