// src/navigation/HomeTabs.tsx
// 인증 후 홈 탭 네비게이터 (was RoomTabs). 디폴트 탭 = 먹로그(LogList).
// ui-redesign 충실화: 기본 네비 헤더(title+headerRight) → 커스텀 HomeHeader(워드마크+버블+ 아바타) 공통 적용.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Icon, IconName } from '@/components';
import { useTheme } from '@/theme';

import { HomeHeader } from './HomeHeader';
import { Routes, type HomeTabParamList } from './routes';
import { LogListScreen } from './screens/LogListScreen';
import { MapTabScreen } from './screens/MapTabScreen';

const Tab = createBottomTabNavigator<HomeTabParamList>();

export const HomeTabs = () => {
  const theme = useTheme();
  return (
    <Tab.Navigator
      // 디폴트 탭 = 먹로그(LogList)
      initialRouteName={Routes.LogList}
      screenOptions={{
        // 먹로그·지도 탭 공통 커스텀 헤더(mk-home HomeHeader 재현). title/headerRight 대체.
        header: () => <HomeHeader />,
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.color.primary,
        // 킷 MkTabBar 비활성 라벨 = text-alternative(fgMuted).
        tabBarInactiveTintColor: theme.color.fgMuted,
        tabBarStyle: { backgroundColor: theme.color.bg, borderTopColor: theme.color.hairline },
        tabBarLabelStyle: {
          fontFamily: theme.typography.caption.fontFamily,
          fontSize: theme.typography.caption.fontSize,
        },
      }}
    >
      <Tab.Screen
        name={Routes.LogList}
        component={LogListScreen}
        options={{
          title: '먹로그',
          // react-navigation 라이브러리 콜백 contract → 객체 인자 예외(컨벤션 §매개변수).
          tabBarIcon: ({ focused, size }) => (
            <Icon
              name={focused ? IconName.BubbleFill : IconName.Bubble}
              size={size}
              color={focused ? 'primary' : 'fgAssistive'}
            />
          ),
        }}
      />
      <Tab.Screen
        name={Routes.MapTab}
        component={MapTabScreen}
        options={{
          title: '지도',
          tabBarIcon: ({ focused, size }) => (
            <Icon name={IconName.Location} size={size} color={focused ? 'primary' : 'fgWeak'} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
