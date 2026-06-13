// src/navigation/screens/SplashView.tsx
// 폰트/세션 로딩 중 화면 — 킷 mk-auth.jsx:53-74 SplashScreen 정합.
//   그라데이션 배경(160deg,#EAF0FF→#FFF 60%) + AppMark 120 + 워드마크(muklog 🍽️) + 태그라인 + 스피너(하단).
//   AuthGate loading 상태에서 소비(props 없는 기존 계약 유지).
//   web→RN 변환:
//     · linear-gradient → expo-linear-gradient(authVisualGradient, 세로 근사 + locations[0,0.6]).
//     · 킷 진입 애니메이션(mkPop/mkFade)·Spinner 회전 애니메이션은 RN 미재현(근사: 정적 + ActivityIndicator).
//       사유: 무한 로딩 표시는 ActivityIndicator로 충분, 진입 모션은 비주얼 충실도 핵심 아님(스킬 §5 근사 허용).
//     · AppMark boxShadow(컬러 그림자 rgba(42,85,230,.28)) → RN accentShadow 근사(iOS 충실).
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppMark, Text } from '@/components';
import { authVisualGradient, useTheme } from '@/theme';

// 킷 태그라인(mk-auth:67).
const SPLASH_TAGLINE = '둘이 함께 쌓는 맛집 지도';
// 킷 그라데이션 160deg 근사 + stops 0%/60%(mk-auth:57).
const GRADIENT_START = { x: 0.2, y: 0 } as const;
const GRADIENT_END = { x: 0, y: 1 } as const;
const GRADIENT_LOCATIONS = [0, 0.6] as const;

export const SplashView = () => {
  const theme = useTheme();
  return (
    <LinearGradient
      testID="splash-gradient"
      colors={authVisualGradient}
      locations={GRADIENT_LOCATIONS}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={styles.root}
    >
      <View style={styles.center}>
        <AppMark
          size={120}
          radius={32}
          style={{
            // 킷 boxShadow 0 16px 40px rgba(42,85,230,.28) 근사(컬러 그림자 — iOS 충실).
            shadowColor: theme.color.accentShadow,
            shadowOpacity: 1,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        />
        <View style={styles.wordmarkRow}>
          <Text variant="display" color="fg" style={styles.wordmark}>
            muklog
          </Text>
          <Text style={styles.wordmarkEmoji}>🍽️</Text>
        </View>
        <Text variant="bodySm" color="fgWeak" style={styles.tagline}>
          {SPLASH_TAGLINE}
        </Text>
      </View>
      {/* 킷: 스피너는 하단 absolute(mk-auth:69). */}
      <ActivityIndicator
        testID="splash-spinner"
        color={theme.color.primary}
        style={styles.spinner}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // 킷: 전체 center, gap 22(mk-auth:55-57). 스피너는 하단 absolute라 center 블록과 분리.
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 22 },
  // 킷 워드마크 800/38 + 🍽️ 26, baseline gap 8(mk-auth:62-64).
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  wordmark: { fontSize: 38, letterSpacing: -1 },
  wordmarkEmoji: { fontSize: 26 },
  // 킷 태그라인 600/15(mk-auth:66).
  tagline: { fontSize: 15 },
  // 킷: bottom 54(mk-auth:69).
  spinner: { position: 'absolute', bottom: 54 },
});
