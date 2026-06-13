// src/navigation/AuthGate.tsx
// 루트 게이트. useAuth()의 AuthState 5분기를 화면으로 매핑한다(social-auth §3.4).
//   loading                    → SplashView
//   unauthenticated/authenticating → LoginScreen(소셜 로그인 — 동일 화면, 버튼 인라인 로딩으로 점멸 방지)
//   error                      → AuthErrorView(부트스트랩 실패 — 재시도)
//   authenticated              → MyLogsProvider + NavigationContainer + AppNavigator(HomeTabs 직행)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '@/features/auth';
import { MyLogsProvider } from '@/features/room';

import { AppNavigator } from './AppNavigator';
import { AuthErrorView } from './screens/AuthErrorView';
import { LoginScreen } from './screens/LoginScreen';
import { SplashView } from './screens/SplashView';

export const AuthGate = () => {
  const { state, retry, loginError, signInWithGoogle, signInWithApple } = useAuth();

  switch (state.status) {
    case 'loading':
      return <SplashView />;
    case 'unauthenticated':
    case 'authenticating':
      // 동일 LoginScreen 유지(화면 점멸 방지). authenticating이면 해당 버튼만 로딩(LoginScreen 내부 처리).
      return (
        <LoginScreen
          authenticating={state.status === 'authenticating' ? state.provider : null}
          loginError={loginError}
          onGoogle={() => void signInWithGoogle()}
          onApple={() => void signInWithApple()}
        />
      );
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
};
