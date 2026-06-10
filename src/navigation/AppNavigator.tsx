// src/navigation/AppNavigator.tsx
// 인증 완료 후 스택. 멀티 로그 전환(multi-log-home): 게이트 제거로 항상 HomeTabs로 직행한다.
//   HomeTabs(탭, headerShown false) / Profile(헤더 표시) / LogScreen(헤더 "로그").
//   ⚠️ Onboarding 라우트 제거(게이트 삭제). JoinLog(로그 입장)는 join UI 트리밍으로 미등록(차기 log-invite).
//   initialRouteName prop 불필요(항상 HomeTabs).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '@/theme';

import { HomeTabs } from './HomeTabs';
import { Routes, type AppStackParamList } from './routes';
import { LogScreen } from './screens/LogScreen';
import { ProfileScreen } from './screens/ProfileScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export const AppNavigator = () => {
  const theme = useTheme();
  // 헤더 표시 상세 화면 공통 옵션(뒤로가기 표시). 토큰만 사용.
  const detailHeaderOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.color.bg },
    headerTitleStyle: { color: theme.color.fg, fontFamily: theme.typography.h3.fontFamily },
    headerTintColor: theme.color.fg,
    headerShadowVisible: false,
  };
  return (
    <Stack.Navigator initialRouteName={Routes.HomeTabs} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.HomeTabs} component={HomeTabs} />
      <Stack.Screen
        name={Routes.Profile}
        component={ProfileScreen}
        options={{ ...detailHeaderOptions, title: '프로필' }}
      />
      <Stack.Screen
        name={Routes.LogScreen}
        component={LogScreen}
        options={{ ...detailHeaderOptions, title: '로그' }}
      />
    </Stack.Navigator>
  );
}
