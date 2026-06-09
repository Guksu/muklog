// src/navigation/MembershipGate.tsx
// 멤버십 기반 분기 (plan §4, C7·C8). AuthGate(authenticated) 하위에서 MembershipProvider로 감싸 사용.
//   loading  → SplashView
//   error    → 에러 뷰(재시도 = refresh)
//   no-room  → AppNavigator initialRoute = Onboarding
//   in-room  → AppNavigator initialRoute = RoomTabs
//
// ⚠️ no-room / in-room 은 동일 JSX 노드(NavigationContainer)로 렌더한다.
//    → refresh로 no-room→in-room 전이 시 NavigationContainer가 언마운트되지 않아
//      Onboarding의 navigation.reset(RoomTabs)가 그대로 유지된다.
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { useMembershipContext } from '@/features/room';

import { AppNavigator } from './AppNavigator';
import { Routes } from './routes';
import { AuthErrorView } from './screens/AuthErrorView';
import { SplashView } from './screens/SplashView';

export const MembershipGate = () => {
  const { state, refresh } = useMembershipContext();

  switch (state.status) {
    case 'loading':
      return <SplashView />;
    case 'error':
      return <AuthErrorView message={state.message} onRetry={() => void refresh()} />;
    case 'no-room':
    case 'in-room': {
      const initialRouteName = state.status === 'in-room' ? Routes.RoomTabs : Routes.Onboarding;
      return (
        <NavigationContainer>
          <AppNavigator initialRouteName={initialRouteName} />
        </NavigationContainer>
      );
    }
    default: {
      // 빠짐없는 분기 보장(컴파일 타임).
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
