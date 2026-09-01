// src/components/SocialButton.tsx
// 소셜 로그인 버튼 — 킷 mk-auth.jsx:118-158 SocialButton 정합.
//   apple: 검정 bg(socialAppleBg) + 흰 텍스트(socialAppleFg), 무테.
//   google: 흰 bg(socialGoogleBg) + 잉크 텍스트(socialGoogleFg) + lineStrong 1px 보더.
//   54h, radius=control(14, --mk-radius-btn), 700/16(button typography), 좌측 절대배치 로고.
//   누르면 onPress 호출만 — 실제 OAuth 배선은 developer(useAuth). loading/disabled로 중복 탭 차단.
//   AppleLogo/GoogleLogo도 react-native-svg(킷 mk-auth:142-158 path 그대로). 로고 색은 브랜드 고정값
//   (Apple 흰 글리프 / Google 멀티컬러)이라 토큰화 대상 아님 — 출처 = 킷.
import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { MotionPressable } from '../MotionPressable';
import { Text } from '../Text';

// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.85;

export type SocialButtonVariant = 'apple' | 'google';

export type SocialButtonProps = {
  variant: SocialButtonVariant;
  /** 탭 콜백. 실제 OAuth 호출은 소비처(useAuth)가 주입. */
  onPress: () => void;
  /** 진행 중 — 스피너 노출 + 탭 차단(중복 로그인 방지). 기본 false. */
  loading?: boolean;
  /** 비활성 — 탭 차단(다른 provider 진행 중 등). 기본 false. */
  disabled?: boolean;
  style?: ViewStyle;
};

// 킷 버튼 컨트롤 내부 수치(54h / 로고 left 20 / gap 10) — 4px 그리드 밖이라 토큰화 안 함(킷 실값).
const BUTTON_HEIGHT = 54;
const LOGO_LEFT = 20;

// Apple 로고(킷 mk-auth:142-147) — 흰 글리프(검정 배경 위 고정).
const AppleLogo = () => (
  <Svg width={19} height={22} viewBox="0 0 17 20" fill="none">
    <Path
      d="M14.06 15.5c-.27.63-.6 1.2-.98 1.74-.52.73-.95 1.23-1.28 1.51-.51.46-1.06.7-1.65.71-.42 0-.93-.12-1.52-.36-.59-.24-1.13-.36-1.63-.36-.52 0-1.08.12-1.68.36-.6.24-1.08.37-1.45.38-.56.03-1.12-.22-1.68-.73-.36-.31-.81-.83-1.35-1.56-.58-.78-1.06-1.69-1.43-2.72C.39 13.1.2 12.06.2 11.05c0-1.15.25-2.15.75-2.98a4.4 4.4 0 0 1 1.57-1.59 4.2 4.2 0 0 1 2.12-.6c.45 0 1.03.14 1.76.41.73.27 1.19.41 1.39.41.15 0 .67-.16 1.54-.48.83-.3 1.52-.42 2.1-.37 1.55.13 2.71.74 3.49 1.84-1.39.84-2.07 2.02-2.06 3.53.01 1.18.44 2.16 1.28 2.94.38.36.8.64 1.28.83-.1.3-.21.59-.33.86ZM11.5.4c0 .86-.31 1.66-.94 2.4-.76.88-1.67 1.39-2.66 1.31a2.7 2.7 0 0 1-.02-.32c0-.83.36-1.71 1-2.43.32-.37.73-.67 1.22-.91.49-.24.96-.37 1.4-.39.01.11.02.23.02.34Z"
      fill="#FFFFFF"
    />
  </Svg>
);

// Google 로고(킷 mk-auth:149-157) — 4색 브랜드 글리프(고정).
const GoogleLogo = () => (
  <Svg width={19} height={19} viewBox="0 0 18 18">
    <Path
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      fill="#4285F4"
    />
    <Path
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      fill="#34A853"
    />
    <Path
      d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      fill="#FBBC05"
    />
    <Path
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </Svg>
);

export const SocialButton = ({
  variant,
  onPress,
  loading = false,
  disabled = false,
  style,
}: SocialButtonProps) => {
  const theme = useTheme();
  const isApple = variant === 'apple';
  const isInactive = disabled || loading;

  const container: ViewStyle = {
    height: BUTTON_HEIGHT,
    borderRadius: theme.radius.control,
    backgroundColor: isApple ? theme.color.socialAppleBg : theme.color.socialGoogleBg,
    // google만 lineStrong 1px 보더(킷 mk-auth:128). apple은 무테.
    borderWidth: isApple ? 0 : StyleSheet.hairlineWidth,
    borderColor: theme.color.lineStrong,
    opacity: isInactive ? 0.5 : 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const fgToken = isApple ? 'socialAppleFg' : 'socialGoogleFg';

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      pressSize="md"
      pressedOpacity={PRESSED_OPACITY}
      style={[container, style]}
    >
      {loading ? (
        <ActivityIndicator
          testID="social-button-spinner"
          color={theme.color[fgToken]}
        />
      ) : (
        <>
          {/* 킷: 로고는 좌측 절대배치, 텍스트는 컨테이너 중앙(킷 mk-auth:134). */}
          <View style={[styles.logo, { left: LOGO_LEFT }]}>
            {isApple ? <AppleLogo /> : <GoogleLogo />}
          </View>
          <Text variant="button" color={fgToken}>
            {isApple ? 'Apple로 계속하기' : 'Google로 계속하기'}
          </Text>
        </>
      )}
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  logo: { position: 'absolute', justifyContent: 'center' },
});
