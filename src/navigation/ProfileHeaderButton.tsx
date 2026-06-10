// src/navigation/ProfileHeaderButton.tsx
// HomeTabs 헤더 우측의 프로필 진입 버튼 (plan §4 / P8).
//   탭 화면 헤더에서 누르면 부모 스택의 Profile 라우트로 이동한다(새 탭 만들지 않음 — 헤더 진입).
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from './routes';

export const ProfileHeaderButton = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="프로필"
      onPress={() => navigation.navigate(Routes.Profile)}
      hitSlop={theme.spacing[8]}
      style={({ pressed }) => [
        styles.button,
        { paddingHorizontal: theme.spacing[12] },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text variant="bodySm" color="primary">
        프로필
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
