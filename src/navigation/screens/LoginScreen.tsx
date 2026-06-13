// src/navigation/screens/LoginScreen.tsx
// 로그인 화면 골격 — 킷 mk-auth.jsx:85-115 LoginScreen 번역.
//   상단 비주얼(그라데이션 + AppMark 108 + 워드마크 + 카피) + 하단 소셜 버튼 + 약관 문구.
//   비주얼/레이아웃만 담당 — onGoogle/onApple/authenticating/loginError는 props 계약(developer가 useAuth로 주입).
//   web→RN 변환:
//     · linear-gradient(160deg,#EAF0FF 0%,bg 70%) → expo-linear-gradient(authVisualGradient, 세로 근사 + locations[0,0.7]).
//     · AppMark boxShadow(컬러 그림자 rgba(42,85,230,.26)) → RN 근사(accentShadow + offset). 컬러 섀도우는 iOS만 충실.
//     · <br/> 줄바꿈 → '\n'. <u> 밑줄 약관 → Text underline(비활성 placeholder, 링크 라우팅은 out-of-scope).
//   showApple 기본값 = Platform.OS==='ios'(Android는 Apple 버튼 비노출 — plan E5).
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { AppMark, SocialButton, Text } from '@/components';
import { authVisualGradient, useTheme } from '@/theme';

export type LoginScreenProps = {
  /** 진행 중인 provider — 해당 버튼 로딩 + 두 버튼 모두 disabled. null이면 입력 대기. */
  authenticating: 'google' | 'apple' | null;
  /** 로그인 시도 실패 인라인 메시지(취소 시 null). 전체 error 화면 전환이 아님(plan §3.1). */
  loginError: string | null;
  /** Google 로그인 시도 콜백 — developer가 useAuth().signInWithGoogle 주입. */
  onGoogle: () => void;
  /** Apple 로그인 시도 콜백 — developer가 useAuth().signInWithApple 주입(iOS 전용). */
  onApple: () => void;
  /** Apple 버튼 노출 여부. 기본 iOS만 true(Android 비노출 — plan E5). */
  showApple?: boolean;
};

// 킷 상단 비주얼 카피(mk-auth:99-101) — <br/> → '\n'.
const LOGIN_COPY = '데이트하며 다닌 맛집을\n사진·메모·위치로 둘이 함께 기록해요.';
// 킷 그라데이션 160deg 근사(거의 수직, 약간 좌하향) + stops 0%/70%(mk-auth:91).
const GRADIENT_START = { x: 0.2, y: 0 } as const;
const GRADIENT_END = { x: 0, y: 1 } as const;
const GRADIENT_LOCATIONS = [0, 0.7] as const;

export const LoginScreen = ({
  authenticating,
  loginError,
  onGoogle,
  onApple,
  showApple = Platform.OS === 'ios',
}: LoginScreenProps) => {
  const theme = useTheme();
  const busy = authenticating !== null;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.color.bg }]} edges={['top', 'bottom']}>
      {/* 상단 비주얼 — 그라데이션 + AppMark + 워드마크 + 카피(킷 mk-auth:89-103) */}
      <LinearGradient
        testID="login-visual-gradient"
        colors={authVisualGradient}
        locations={GRADIENT_LOCATIONS}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.visual}
      >
        <AppMark
          size={108}
          radius={28}
          style={{
            // 킷 boxShadow 0 14px 34px rgba(42,85,230,.26) 근사(컬러 그림자 — iOS 충실, Android elevation 근사).
            shadowColor: theme.color.accentShadow,
            shadowOpacity: 1,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 7 },
            elevation: 8,
          }}
        />
        <View style={styles.copyBlock}>
          <View style={styles.wordmarkRow}>
            <Text variant="emptyTitle" color="fg" style={styles.wordmark}>
              muklog
            </Text>
            <Text style={styles.wordmarkEmoji}>🍽️</Text>
          </View>
          <Text variant="bodySm" color="fgWeak" style={styles.copy}>
            {LOGIN_COPY}
          </Text>
        </View>
      </LinearGradient>

      {/* 하단 버튼 영역(킷 mk-auth:106-112) */}
      <View style={styles.actions}>
        {loginError ? (
          <Text variant="bodySm" color="error" style={styles.error}>
            {loginError}
          </Text>
        ) : null}
        {showApple ? (
          <SocialButton
            variant="apple"
            onPress={onApple}
            loading={authenticating === 'apple'}
            disabled={busy}
          />
        ) : null}
        <SocialButton
          variant="google"
          onPress={onGoogle}
          loading={authenticating === 'google'}
          disabled={busy}
        />
        <Text variant="caption" color="fgAssistive" style={styles.terms}>
          {'계속하면 '}
          <Text variant="caption" color="fgAssistive" style={styles.termsLink}>
            서비스 약관
          </Text>
          {' 및 '}
          <Text variant="caption" color="fgAssistive" style={styles.termsLink}>
            개인정보 처리방침
          </Text>
          {'에\n동의하는 것으로 간주돼요.'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // 킷: 상단 비주얼 flex 1, center, gap 20, padding 0 32(mk-auth:89-92).
  visual: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
  },
  copyBlock: { alignItems: 'center' },
  // 킷 워드마크: muklog(800/34) + 🍽️(23), baseline 정렬 gap 7(mk-auth:95-98).
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  wordmark: { fontSize: 34, letterSpacing: -1 },
  wordmarkEmoji: { fontSize: 23 },
  // 킷 카피 600/15.5/1.6, margin-top 14, center(mk-auth:99).
  copy: { textAlign: 'center', marginTop: 14, fontSize: 15.5, lineHeight: 25 },
  // 킷: 버튼 영역 flex none, padding 0 24 40, gap 11(mk-auth:106).
  actions: { paddingHorizontal: 24, paddingBottom: 40, gap: 11 },
  error: { textAlign: 'center' },
  // 킷 약관 500/11.5/1.6, center, margin 10 12 0(mk-auth:109).
  terms: { textAlign: 'center', marginTop: 10, marginHorizontal: 12, lineHeight: 18 },
  termsLink: { textDecorationLine: 'underline' },
});
