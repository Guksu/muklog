// src/navigation/screens/OnboardingScreen.tsx
// 방 진입 전 분기 화면 (placeholder). 실제 방 생성/입장 로직은 invite-room 스프린트.
import React from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { DEV_NAV } from '../devFlags';
import { Routes, type AppStackParamList } from '../routes';

export function OnboardingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  const notImplemented = (label: string) =>
    Alert.alert('준비 중', `"${label}" 기능은 invite-room 스프린트에서 구현됩니다.`);

  return (
    <Screen center>
      <Text variant="h1" color="fg" style={{ textAlign: 'center' }}>
        muklog
      </Text>
      <Text
        variant="body"
        color="fgWeak"
        style={{ textAlign: 'center', marginTop: theme.spacing[8], marginBottom: theme.spacing[40] }}
      >
        커플이 다닌 맛집을 함께 기록해요
      </Text>

      <View style={{ width: '100%', gap: theme.spacing[12] }}>
        <Button title="방 만들기" onPress={() => notImplemented('방 만들기')} />
        <Button
          title="초대코드 입력"
          variant="secondary"
          onPress={() => notImplemented('초대코드 입력')}
        />
      </View>

      {DEV_NAV.showToggle ? (
        <View style={{ marginTop: theme.spacing[32], width: '100%' }}>
          <Text variant="caption" color="fgMuted" style={{ textAlign: 'center', marginBottom: theme.spacing[8] }}>
            dev 전용 (invite-room에서 제거)
          </Text>
          <Button
            title="▶ 방 화면으로 이동"
            variant="secondary"
            onPress={() => navigation.navigate(Routes.RoomTabs)}
          />
        </View>
      ) : null}
    </Screen>
  );
}
