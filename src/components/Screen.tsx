// src/components/Screen.tsx
// SafeArea + 배경 토큰 래퍼. 모든 화면의 공통 컨테이너.
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export type ScreenProps = {
  children: React.ReactNode;
  /** 내용 가운데 정렬(placeholder/로딩 화면용). 기본 false. */
  center?: boolean;
  /** SafeArea 적용 엣지. 기본 상하좌우 전체. */
  edges?: readonly Edge[];
  style?: ViewStyle;
};

export function Screen({
  children,
  center = false,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
}: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.color.bg }]}
    >
      <View
        style={[
          styles.flex,
          { padding: theme.spacing[20] },
          center ? styles.center : null,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
