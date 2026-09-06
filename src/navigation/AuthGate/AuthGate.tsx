// src/navigation/AuthGate.tsx
// 루트 게이트. useAuth()의 AuthState 5분기를 화면으로 매핑한다(social-auth §3.4).
//   loading                    → SplashView
//   unauthenticated/authenticating → LoginScreen(소셜 로그인 — 동일 화면, 버튼 인라인 로딩으로 점멸 방지)
//   error                      → AuthErrorView(부트스트랩 실패 — 재시도)
//   authenticated              → MyLogsProvider + NavigationContainer + AppNavigator(HomeTabs 직행)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth, useClearCachesOnSignOut } from '@/features/auth';
import { LocationPrewarm } from '@/features/map/LocationPrewarm';
import { MapPrewarm } from '@/features/map/MapPrewarm';
import { ProfileProvider } from '@/features/profile';
import { MyLogsProvider } from '@/features/room';
// 알림 딥링크 소비(push-receive-ux T5) — nav 준비(authenticated 트리 렌더) 시 대기 큐를 1회 소비.
import { consumePendingDeepLink } from '@/features/notif/deepLinkRouter';

import { navigationRef } from '../navigationRef';
import { AppNavigator } from '../AppNavigator';
import { AuthErrorView } from '../screens/AuthErrorView';
import { LoginScreen } from '../screens/LoginScreen';
import { SplashView } from '../screens/SplashView';

export const AuthGate = () => {
  const { state, retry, loginError, signInWithGoogle, signInWithApple } = useAuth();

  // 로그아웃(authenticated → unauthenticated) 시 조회·서명 URL 캐시를 비운다(query-cache §3.8).
  //   여기가 QueryClientProvider 안쪽이면서 인증 상태를 아는 유일한 지점이라 두 세계를 잇는 자리다.
  //   분기 전에 무조건 호출 — 로그인 화면으로 넘어간 뒤에도 마운트가 유지돼야 전이를 관찰할 수 있다.
  useClearCachesOnSignOut({ status: state.status });

  // NavigationContainer 준비 완료 시점 — 콜드스타트/로그인 전 도착해 대기 중이던 알림 딥링크를 소비한다(§3.4 D4).
  const handleNavReady = () => consumePendingDeepLink();

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
        // ProfileProvider — 본인 닉/아바타를 단일 상태로 공유(#2). ProfileScreen 변경이 HomeHeader·LogList 등
        //   모든 소비자에 즉시 전파되도록 인증 트리 최상위에서 1회 마운트(MyLogsProvider와 동급 위치).
        <ProfileProvider userId={state.userId}>
          <MyLogsProvider userId={state.userId}>
            <NavigationContainer ref={navigationRef} onReady={handleNavReady}>
              <AppNavigator />
            </NavigationContainer>
            {/* 지도 WebView 프리워머(map-prewarm) — 인증 사용자에서만 마운트. 숨김 1×1, 권한·RPC 미보유.
                유휴 시점에 SDK를 미리 부팅해 지도탭 첫 진입 체감 지연을 줄인다(인스턴스 비공유). */}
            <MapPrewarm />
            {/* 위치 선취득 워머(map-initial-location) — 인증 사용자에서만 마운트. 렌더 산출물 없음(null).
                권한이 이미 허용된 경우에만 OS 캐시 위치를 1회 읽어(GPS 미기동·프롬프트 0) 메모리에 담아둔다
                → 지도탭 첫 진입의 렌더 1이 서울시청 폴백 대신 내 동네로 시작한다. */}
            <LocationPrewarm />
          </MyLogsProvider>
        </ProfileProvider>
      );
    default: {
      // 빠짐없는 분기 보장(컴파일 타임): 새로운 status가 추가되면 여기서 타입 에러.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
};
