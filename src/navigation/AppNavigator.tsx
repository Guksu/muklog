// src/navigation/AppNavigator.tsx
// 인증 완료 후 스택. 멀티 로그 전환(multi-log-home): 게이트 제거로 항상 HomeTabs로 직행한다.
//   HomeTabs(탭, headerShown false) / Profile(헤더 표시) / JoinLog(헤더 "초대코드 입장").
//   LogScreen은 네이티브 헤더를 숨긴다(headerShown false) — 킷 mk-log:18-29처럼 화면이 자체 헤더
//     (chevron-left 뒤로가기 + 아바타 겹침 + 로그명)를 그린다. 네이티브 "로그" 헤더와 이중 헤더 방지.
//   ⚠️ Onboarding 라우트 제거(게이트 삭제).
//   initialRouteName prop 불필요(항상 HomeTabs).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeTabs } from './HomeTabs';
import { Routes, type AppStackParamList } from './routes';
import { JoinLogScreen } from './screens/JoinLogScreen';
import { LogScreen } from './screens/LogScreen';
import { MuklogDetailRoute } from './screens/MuklogDetailRoute';
import { MuklogEditorRoute } from './screens/MuklogEditorRoute';
import { ProfileScreen } from './screens/ProfileScreen';
import { RoomCreatedRoute } from './screens/RoomCreatedRoute';

const Stack = createNativeStackNavigator<AppStackParamList>();

export const AppNavigator = () => {
  // 모든 스택 화면이 자체 헤더(SubBar/HomeHeader/LogScreen 헤더)를 그린다 → 네이티브 헤더 전역 숨김.
  return (
    <Stack.Navigator initialRouteName={Routes.HomeTabs} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.HomeTabs} component={HomeTabs} />
      {/* Profile·JoinLog은 화면 자체 SubBar(킷 mk-log:428 / mk-home:150)를 그린다 → 네이티브 헤더 숨김(이중 헤더 방지, FLAG-4). */}
      <Stack.Screen
        name={Routes.Profile}
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.LogScreen}
        component={LogScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.JoinLog}
        component={JoinLogScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.MuklogDetail}
        component={MuklogDetailRoute}
        options={{ headerShown: false }}
      />
      {/* FLAG-1: 먹로그 에디터(풀스크린, 자체 SubBar) — 작성/편집 겸용. 네이티브 헤더 숨김(이중 헤더 방지). */}
      <Stack.Screen
        name={Routes.MuklogEditor}
        component={MuklogEditorRoute}
        options={{ headerShown: false }}
      />
      {/* FLAG-3: 로그 생성 완료 축하(자체 SubBar). 네이티브 헤더 숨김. */}
      <Stack.Screen
        name={Routes.RoomCreated}
        component={RoomCreatedRoute}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
