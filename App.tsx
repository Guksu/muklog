// App.tsx — 앱 루트.
// 책임: (1) SUIT 폰트 로드 + SplashScreen 제어, (2) 프로바이더 트리 구성, (3) AuthGate 마운트.
//
// 프로바이더 순서(바깥→안): GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ToastProvider → AuthProvider → AuthGate.
//   - ThemeProvider가 AuthProvider보다 바깥: AuthGate의 Splash/Error 화면도 테마 토큰을 쓴다.
//   - ToastProvider가 AuthProvider/AuthGate(=네비게이터) 바깥: 화면 전환·언마운트와 무관히 루트 단일 <Toast>를 유지(언마운트 레이스 해소).
//     SafeArea/Theme 안: 토큰·하단 inset 사용.
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from '@/features/auth';
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
            <AuthProvider>
              <StatusBar style="dark" />
              <AuthGate />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
