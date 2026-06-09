// src/navigation/AuthGate.tsx
// 루트 게이트. useAuth()의 AuthState 3분기를 화면으로 매핑한다.
//   loading       → SplashView
//   error         → AuthErrorView(재시도)
//   authenticated → AppNavigator (NavigationContainer 안)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '@/features/auth';

import { AppNavigator } from './AppNavigator';
import { AuthErrorView } from './screens/AuthErrorView';
import { SplashView } from './screens/SplashView';

export function AuthGate() {
  const { state, retry } = useAuth();

  switch (state.status) {
    case 'loading':
      return <SplashView />;
    case 'error':
      return <AuthErrorView message={state.message} onRetry={retry} />;
    case 'authenticated':
      return (
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      );
    default: {
      // 빠짐없는 분기 보장(컴파일 타임): 새로운 status가 추가되면 여기서 타입 에러.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
