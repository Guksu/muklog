// src/navigation/AuthGate.tsx
// 루트 게이트. useAuth()의 AuthState 3분기를 화면으로 매핑한다.
// 멀티 로그 전환(multi-log-home): 멤버십 게이트(MembershipGate) 제거 → 인증 후 곧바로 HomeTabs 직행.
//   loading       → SplashView
//   error         → AuthErrorView(재시도)
//   authenticated → MyLogsProvider + NavigationContainer + AppNavigator(HomeTabs 직행, 온보딩/멤버십 분기 없음)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '@/features/auth';
import { MyLogsProvider } from '@/features/room';

import { AppNavigator } from './AppNavigator';
import { AuthErrorView } from './screens/AuthErrorView';
import { SplashView } from './screens/SplashView';

export const AuthGate = () => {
  const { state, retry } = useAuth();

  switch (state.status) {
    case 'loading':
      return <SplashView />;
    case 'error':
      return <AuthErrorView message={state.message} onRetry={retry} />;
    case 'authenticated':
      return (
        <MyLogsProvider userId={state.userId}>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </MyLogsProvider>
      );
    default: {
      // 빠짐없는 분기 보장(컴파일 타임): 새로운 status가 추가되면 여기서 타입 에러.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
