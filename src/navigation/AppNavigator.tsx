// src/navigation/AppNavigator.tsx
// 인증 완료 후 스택. 멀티 로그 전환(multi-log-home): 게이트 제거로 항상 HomeTabs로 직행한다.
//   HomeTabs(탭, headerShown false) / Profile(헤더 표시) / JoinLog(헤더 "초대코드 입장").
//   LogScreen은 네이티브 헤더를 숨긴다(headerShown false) — 킷 mk-log:18-29처럼 화면이 자체 헤더
//     (chevron-left 뒤로가기 + 아바타 겹침 + 로그명)를 그린다. 네이티브 "로그" 헤더와 이중 헤더 방지.
//   ⚠️ Onboarding 라우트 제거(게이트 삭제).
//   initialRouteName prop 불필요(항상 HomeTabs).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '@/theme';

import { HomeTabs } from './HomeTabs';
import { Routes, type AppStackParamList } from './routes';
import { JoinLogScreen } from './screens/JoinLogScreen';
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.JoinLog}
        component={JoinLogScreen}
        options={{ ...detailHeaderOptions, title: '초대코드 입장' }}
      />
    </Stack.Navigator>
  );
}
