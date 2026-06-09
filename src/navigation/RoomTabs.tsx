// src/navigation/RoomTabs.tsx
// 방 진입 후 탭 네비게이터. 디폴트 탭 = Muklog (architecture.md §4).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/theme';

import { Routes, type RoomTabParamList } from './routes';
import { MapTabScreen } from './screens/MapTabScreen';
import { MuklogTabScreen } from './screens/MuklogTabScreen';

const Tab = createBottomTabNavigator<RoomTabParamList>();

export function RoomTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      // 디폴트 탭 = Muklog
      initialRouteName={Routes.MuklogTab}
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.bg },
        headerTitleStyle: { color: theme.color.fg, fontFamily: theme.typography.h3.fontFamily },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.fgWeak,
        tabBarStyle: { backgroundColor: theme.color.bg, borderTopColor: theme.color.border },
        tabBarLabelStyle: { fontFamily: theme.typography.caption.fontFamily, fontSize: theme.typography.caption.fontSize },
      }}
    >
      <Tab.Screen
        name={Routes.MuklogTab}
        component={MuklogTabScreen}
        options={{ title: '먹로그' }}
      />
      <Tab.Screen
        name={Routes.MapTab}
        component={MapTabScreen}
        options={{ title: '지도' }}
      />
    </Tab.Navigator>
  );
}
