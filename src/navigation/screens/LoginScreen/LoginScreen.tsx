// src/navigation/screens/LoginScreen.tsx
// 로그인 화면 골격 — 킷 mk-auth.jsx:85-115 LoginScreen 번역.
//   상단 비주얼(그라데이션 + AppMark 108 + 워드마크 + 카피) + 하단 소셜 버튼 + 약관 문구.
//   비주얼/레이아웃만 담당 — onGoogle/onApple/authenticating/loginError는 props 계약(developer가 useAuth로 주입).
//   web→RN 변환: (brand-coral §1 웜 코럴 전환)
//     · linear-gradient(160deg,#FFF1EC 0%,bg 72%) → expo-linear-gradient(authVisualGradient 웜본, 세로 근사 + locations[0,0.72]).
//     · AppMark boxShadow(코럴 그림자 rgba(255,77,109,.24)) → RN brandShadow 근사(킷 mk-auth:80). 컬러 섀도우는 iOS만 충실/Android elevation 근사.
//     · <br/> 줄바꿈 → '\n'. <u> 밑줄 약관 → Text underline + onPress(expo-web-browser 인앱 브라우저로 약관/개인정보 열기, OAuth와 동일 패턴).
//   showApple 기본값 = Platform.OS==='ios'(Android는 Apple 버튼 비노출 — plan E5).
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

import { AppMark, SocialButton, Text } from '@/components';
// ⚠️ 임시 진단 — 원인 확정 후 이 import 와 아래 사용처를 함께 제거한다.
import { AUTH_DIAGNOSTICS_ENABLED, readAuthTrace } from '@/features/auth/authDiagnostics';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
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

// 킷 상단 비주얼 카피(mk-auth:86-87) — <br/> → '\n'.
const LOGIN_COPY = '함께 다녀온 맛집을\n차곡차곡 모아봐요.';
// 약관/개인정보 URL은 @/lib/legal 단일 출처(ProfileScreen과 공용).
// 인앱 브라우저로 열기(expo-web-browser, OAuth와 동일). 화살표 함수·props 무의존이라 모듈 레벨.
const openTerms = () => void WebBrowser.openBrowserAsync(TERMS_URL);
const openPrivacy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL);
// 킷 그라데이션 160deg(우상→좌하 대각) 근사 + stops 0%/72%(mk-auth:78).
const GRADIENT_START = { x: 0.15, y: 0 } as const;
const GRADIENT_END = { x: 0.85, y: 1 } as const;
const GRADIENT_LOCATIONS = [0, 0.72] as const;

export const LoginScreen = ({
  authenticating,
  loginError,
  onGoogle,
  onApple,
  showApple = Platform.OS === 'ios',
}: LoginScreenProps) => {
  const theme = useTheme();
  const busy = authenticating !== null;
  // ⚠️ 임시 진단 — 상태 변화(로그인 시도/실패)마다 재렌더되므로 최신 트레이스가 그대로 반영된다.
  const authTrace = readAuthTrace();

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
            // 킷 boxShadow 0 14px 34px rgba(255,77,109,.24) 근사(브랜드 코럴 그림자 — iOS 충실, Android elevation 근사, mk-auth:80).
            shadowColor: theme.color.brandShadow,
            shadowOpacity: 1,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 7 },
            elevation: 8,
          }}
        />
        <View style={styles.copyBlock}>
          <Text variant="emptyTitle" color="fg" style={styles.wordmark}>
            먹로그
          </Text>
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
        {/* ⚠️ 임시 진단 표시 — OAuth 실패 지점을 기기 화면에서 읽기 위함. 원인 확정 후 제거(authDiagnostics). */}
        {AUTH_DIAGNOSTICS_ENABLED && authTrace.length > 0 ? (
          <Text variant="caption" color="fgAssistive" style={styles.diagnostics}>
            {authTrace.join('\n')}
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
          <Text
            variant="caption"
            color="fgAssistive"
            style={styles.termsLink}
            accessibilityRole="link"
            accessibilityLabel="서비스 약관 열기"
            onPress={openTerms}
          >
            서비스 약관
          </Text>
          {' 및 '}
          <Text
            variant="caption"
            color="fgAssistive"
            style={styles.termsLink}
            accessibilityRole="link"
            accessibilityLabel="개인정보 처리방침 열기"
            onPress={openPrivacy}
          >
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
  // 킷 워드마크: 먹로그 단독(800/34)(mk-auth:94) — 킷에 이모지 없음(AppMark가 플레이풀 요소 담당).
  // HomeHeader 워드마크('먹로그' variant=wordmark, SUIT-Bold) 미러: emptyTitle 변형도 SUIT-Bold(동일 weight)로 앱 전역 워드마크 일관성 확보.
  // lineHeight=40(킷 /1=34이나 한글 글리프 클리핑 방지 — 34×1.15 근사). letterSpacing -1(킷 -0.03em×34≈-1.02, HomeHeader 밀착 미러).
  wordmark: { fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  // 킷 카피 600/15.5/1.6(SemiBold), margin-top 14, center(mk-auth:99) — bodySm 변형 Medium 보정.
  copy: { textAlign: 'center', marginTop: 14, fontSize: 15.5, lineHeight: 25, fontFamily: 'SUIT-SemiBold' },
  // 킷: 버튼 영역 flex none, padding 0 24 40, gap 11(mk-auth:106).
  actions: { paddingHorizontal: 24, paddingBottom: 40, gap: 11 },
  error: { textAlign: 'center' },
  // ⚠️ 임시 진단 표시 스타일 — 원인 확정 후 제거.
  diagnostics: { textAlign: 'left', lineHeight: 15, fontSize: 10 },
  // 킷 약관 500/11.5/1.6, center, margin 10 12 0(mk-auth:109).
  terms: { textAlign: 'center', marginTop: 10, marginHorizontal: 12, lineHeight: 18 },
  termsLink: { textDecorationLine: 'underline' },
});
