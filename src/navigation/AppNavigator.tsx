// src/navigation/AppNavigator.tsx
// 인증 완료 후 스택. Onboarding(placeholder) ↔ RoomTabs.
// ⚠️ 초기 라우트는 임시 dev 플래그로 결정 — invite-room에서 방 멤버십 조회 기반 분기로 교체.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RoomTabs } from './RoomTabs';
import { DEV_NAV } from './devFlags';
import { Routes, type AppStackParamList } from './routes';
import { OnboardingScreen } from './screens/OnboardingScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  const initialRouteName = DEV_NAV.initial === 'room' ? Routes.RoomTabs : Routes.Onboarding;

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.Onboarding} component={OnboardingScreen} />
      <Stack.Screen name={Routes.RoomTabs} component={RoomTabs} />
    </Stack.Navigator>
  );
}
