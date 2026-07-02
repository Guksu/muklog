// src/navigation/HomeTabs.tsx
// 인증 후 홈 탭 네비게이터 (was RoomTabs). 디폴트 탭 = 먹로그(LogList).
// ui-redesign 충실화: 기본 네비 헤더(title+headerRight) → 커스텀 HomeHeader(워드마크+버블+ 아바타) 공통 적용.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components';
import { useMyLogsContext } from '@/features/room';
import { useTheme } from '@/theme';

import { HomeHeader } from '../HomeHeader';
import { Routes, type HomeTabParamList } from '../routes';
import { LogListScreen } from '../screens/LogListScreen';
import { MapTabScreen } from '../screens/MapTabScreen';
import { buildTabBarStyle, shouldHideTabBar } from '../tabBarStyle';

const Tab = createBottomTabNavigator<HomeTabParamList>();

export const HomeTabs = () => {
  const theme = useTheme();
  // #1 Android GNB safe-area: 하단 inset을 직접 읽어 탭바 하단 패딩·높이에 반영(buildTabBarStyle).
  //   react-navigation 자동 inset은 Android(비 edge-to-edge)에서 bottom=0으로 보고돼 GNB가 시스템 내비바에 가려졌다.
  const insets = useSafeAreaInsets();
  // 킷 §3: 첫 실행(로그 0개) = 온보딩 집중 → 하단 탭바 숨김(헤더는 유지). 로그 합류/생성 시 탭바 복귀.
  const { state: logsState } = useMyLogsContext();
  const hideTabBar = shouldHideTabBar({ logsState });
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
        // 킷 mk-ui:183 비주얼 토큰 + 하단 safe-area inset 명시 적용(#1). 상세는 tabBarStyle.ts.
        //   첫 실행 빈 상태(hideTabBar)면 display:none으로 바 숨김(킷 §3 showTabs).
        tabBarStyle: hideTabBar ? { display: 'none' } : buildTabBarStyle({ insets, theme }),
        // 킷 라벨 11px, SemiBold(비활성 600 근사 — react-navigation은 focus별 weight 변경 어려움).
        tabBarLabelStyle: {
          fontFamily: 'SUIT-SemiBold',
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
