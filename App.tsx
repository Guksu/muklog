// App.tsx — 앱 루트.
// 책임: (1) SUIT 폰트 로드 + SplashScreen 제어, (2) 프로바이더 트리 구성, (3) AuthGate 마운트.
//
// 프로바이더 순서(바깥→안): GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ToastProvider
//   → QueryClientProvider → AuthProvider → AuthGate.
//   - ThemeProvider가 AuthProvider보다 바깥: AuthGate의 Splash/Error 화면도 테마 토큰을 쓴다.
//   - ToastProvider가 AuthProvider/AuthGate(=네비게이터) 바깥: 화면 전환·언마운트와 무관히 루트 단일 <Toast>를 유지(언마운트 레이스 해소).
//     SafeArea/Theme 안: 토큰·하단 inset 사용.
//   - QueryClientProvider가 AuthProvider 바깥(query-cache §3.9): 조회 캐시가 인증 상태 전이·리렌더와 무관하게
//     한 인스턴스로 살아 있어야 한다. 계정 전환 시의 비움은 useClearCachesOnSignOut이 명시적으로 한다.
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';
import { AppVersionGate } from '@/features/appVersion';
import { AuthProvider } from '@/features/auth';
import { usePushReceive } from '@/features/notif/usePushReceive';
import { OtaUpdateGate } from '@/features/ota';
import { AuthGate } from '@/navigation';
import { ToastProvider } from '@/components';
import { ThemeProvider } from '@/theme';
import { fontMap } from '@/theme/fonts';

// 폰트 로드 전까지 네이티브 스플래시 유지.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* 이미 숨겨졌거나 사용 불가한 환경 — 무시 */
});

// 폰트 로드가 비정상적으로 지연될 때 영구 스플래시를 막는 안전장치.
const FONT_LOAD_TIMEOUT_MS = 8000;

const App = () => {
  const [ready, setReady] = useState(false);

  // 푸시 수신 UX 전역 구동(push-receive-ux T6). 핸들러·탭 리스너는 인증 무관 전역 —
  //   콜드스타트 탭이 로그인 전 도착해도 대기 큐에 저장되고, authenticated+nav ready 시점(AuthGate onReady)에 소비된다.
  usePushReceive();

  useEffect(function loadFonts() {
    let cancelled = false;

    const onFontTimeout = () => {
      if (!cancelled) {
        console.warn('[fonts] 로드 타임아웃 — 시스템 폰트로 진입합니다.');
        setReady(true);
      }
    };
    const timeout = setTimeout(onFontTimeout, FONT_LOAD_TIMEOUT_MS);

    Font.loadAsync(fontMap)
      .catch((err) => {
        // 폰트 누락/로드 실패 → 시스템 폰트 fallback 후 진입(영구 스플래시 방지).
        console.warn('[fonts] 로드 실패 — 시스템 폰트로 진입합니다.', err);
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setReady(true);
        }
      });

    return function cancelFontLoad() {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // 일반 함수(컨벤션상 useCallback 지양). onLayout은 ready가 true가 된 뒤의 첫 레이아웃에서 스플래시를 숨긴다.
  const onLayoutRootView = async () => {
    if (ready) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  };

  if (!ready) {
    // 폰트 로드 중에는 네이티브 스플래시가 떠 있다(아무것도 렌더하지 않음).
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider scheme="light">
          <ToastProvider>
            {/* 조회 캐시 — 모듈 스코프 싱글턴(리렌더로 캐시가 날아가지 않도록). query-cache §3.9 */}
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <StatusBar style="dark" />
                {/* 버전 게이트 — AuthGate 상위(로그인 전에도 강제 차단 노출). checking/none→자식, force→차단, suggest→+모달. */}
                <AppVersionGate>
                  {/* OTA 게이트 — 스토어 게이트 안쪽(force면 미마운트 = 확인·대역폭 0). children은 항상 렌더. */}
                  <OtaUpdateGate>
                    <AuthGate />
                  </OtaUpdateGate>
                </AppVersionGate>
              </AuthProvider>
            </QueryClientProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
