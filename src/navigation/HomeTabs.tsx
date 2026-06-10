// src/navigation/HomeTabs.tsx
// 인증 후 홈 탭 네비게이터 (was RoomTabs). 디폴트 탭 = 먹로그(LogList).
// 멀티 로그 전환(multi-log-home): 헤더 우측에 [+버튼][프로필버튼]을 가로로 공존시킨다.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/theme';

import { PlusHeaderButton } from './PlusHeaderButton';
import { ProfileHeaderButton } from './ProfileHeaderButton';
import { Routes, type HomeTabParamList } from './routes';
import { LogListScreen } from './screens/LogListScreen';
import { MapTabScreen } from './screens/MapTabScreen';

const Tab = createBottomTabNavigator<HomeTabParamList>();

// 헤더 우측 [+][프로필] 가로 배치. 토큰 spacing만 사용.
const HomeHeaderRight = () => {
  const theme = useTheme();
  return (
    <View style={[styles.headerRight, { gap: theme.spacing[4] }]}>
      <PlusHeaderButton />
      <ProfileHeaderButton />
    </View>
  );
};

export const HomeTabs = () => {
  const theme = useTheme();
  return (
    <Tab.Navigator
      // 디폴트 탭 = 먹로그(LogList)
      initialRouteName={Routes.LogList}
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.bg },
        headerTitleStyle: { color: theme.color.fg, fontFamily: theme.typography.h3.fontFamily },
        headerShadowVisible: false,
        // 헤더 우측에서 로그 추가(+) / 프로필 진입 공존.
        headerRight: () => <HomeHeaderRight />,
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.fgWeak,
        tabBarStyle: { backgroundColor: theme.color.bg, borderTopColor: theme.color.border },
        tabBarLabelStyle: {
          fontFamily: theme.typography.caption.fontFamily,
          fontSize: theme.typography.caption.fontSize,
        },
      }}
    >
      <Tab.Screen name={Routes.LogList} component={LogListScreen} options={{ title: '먹로그' }} />
      <Tab.Screen name={Routes.MapTab} component={MapTabScreen} options={{ title: '지도' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
