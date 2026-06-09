// src/navigation/AppNavigator.tsx
// 인증·멤버십 완료 후 스택. Onboarding ↔ RoomTabs.
// 초기 라우트는 멤버십 게이트가 결정해 prop으로 주입(no-room→Onboarding / in-room→RoomTabs).
//   두 화면 모두 등록 → Onboarding 성공 시 navigation.reset(RoomTabs)로 같은 네비게이터 내 전이 가능.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RoomTabs } from './RoomTabs';
import { Routes, type AppStackParamList } from './routes';
import { OnboardingScreen } from './screens/OnboardingScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export const AppNavigator = ({
  initialRouteName,
}: {
  initialRouteName: keyof AppStackParamList;
}) => {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.Onboarding} component={OnboardingScreen} />
      <Stack.Screen name={Routes.RoomTabs} component={RoomTabs} />
    </Stack.Navigator>
  );
}
