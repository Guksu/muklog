// src/navigation/screens/SplashView.tsx
// 폰트/세션 로딩 중 화면. 무한 로딩처럼 보이지 않도록 인디케이터 + 안내 문구.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export const SplashView = () => {
  const theme = useTheme();
  return (
    <Screen center>
      <View style={styles.box}>
        <ActivityIndicator color={theme.color.primary} />
        <Text variant="bodySm" color="fgWeak" style={{ marginTop: theme.spacing[12] }}>
          준비 중…
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center' },
});
