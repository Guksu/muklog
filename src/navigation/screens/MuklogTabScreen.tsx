// src/navigation/screens/MuklogTabScreen.tsx
// 먹로그 탭 자리 (placeholder). 카드 리스트는 muklog-list 스프린트.
import React from 'react';
import { View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { DEV_NAV } from '../devFlags';
import { Routes, type AppStackParamList } from '../routes';

export function MuklogTabScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  return (
    <Screen center>
      <Text variant="h3" color="fgWeak" style={{ textAlign: 'center' }}>
        먹로그가 여기 표시됩니다
      </Text>

      {DEV_NAV.showToggle ? (
        <View style={{ marginTop: theme.spacing[32], width: '100%' }}>
          <Text variant="caption" color="fgMuted" style={{ textAlign: 'center', marginBottom: theme.spacing[8] }}>
            dev 전용 (invite-room에서 제거)
          </Text>
          <Button
            title="◀ 온보딩으로 이동"
            variant="secondary"
            onPress={() => navigation.navigate(Routes.Onboarding)}
          />
        </View>
      ) : null}
    </Screen>
  );
}
