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
        //   탭별 워드마크: 지도 탭 "지도"(킷 mk-home:261), 그 외 "먹로그"(:82). route 라이브러리 콜백 contract.
        header: ({ route }) => <HomeHeader title={route.name === Routes.MapTab ? '지도' : '먹로그'} />,
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.color.primary,
        // 킷 MkTabBar 비활성 라벨 = text-alternative(fgMuted).
        tabBarInactiveTintColor: theme.color.fgMuted,
        // 킷 mk-ui:183 — 바 배경 surface(다크 정합), 상단 구분선 line-alt(hairlineAlt), paddingTop 9(≈spacing[8]).
        //   하단 패딩(킷 22)은 react-navigation이 home-indicator safe-area inset으로 자동 처리.
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.hairlineAlt,
          paddingTop: theme.spacing[8],
        },
        // 킷 라벨 11px, SemiBold(비활성 600 근사 — react-navigation은 focus별 weight 변경 어려움).
        tabBarLabelStyle: {
          fontFamily: 'Pretendard-SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name={Routes.LogList}
        component={LogListScreen}
        options={{
          title: '먹로그',
          // react-navigation 라이브러리 콜백 contract → 객체 인자 예외(컨벤션 §매개변수).
          // 킷 mk-ui:192 아이콘 25px 고정.
          tabBarIcon: ({ focused }) => (
            <Icon
              name={focused ? IconName.BubbleFill : IconName.Bubble}
              size={25}
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
          // 킷 mk-ui:192 — 비활성 아이콘색 text-assistive(fgAssistive, 먹로그 탭과 통일), 25px 고정.
          tabBarIcon: ({ focused }) => (
            <Icon name={IconName.Location} size={25} color={focused ? 'primary' : 'fgAssistive'} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
