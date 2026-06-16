// src/components/Toast.tsx
// 하단 플로팅 토스트(공용 프리미티브) — 킷 .mk-toast 재현 (index.html:36-42 + render 150-152).
//   하단 중앙 floating pill: bottom 104 · 가로 중앙 · maxWidth 84% · padding 13×18 · radius 14 · gap 9.
//   배경 neutral=--mk-ink(toastBg) / positive=.mk-toast.pos #1E7A47(toastPositiveBg) + ✓ prefix. 텍스트 흰색 600/14.
//   진입 애니메이션(킷 mkToast .26s: fade + translateY 14→0). 자동 사라짐(킷 showToast setTimeout 2200) → onHide.
//   프리젠테이셔널 — visible/message/tone은 소비처(예: useToast)가 소유. 데이터·트리거는 developer.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ToastTone = 'neutral' | 'positive';

export type ToastProps = {
  /** 표시 여부. false면 언마운트(아무것도 렌더 안 함). */
  visible: boolean;
  /** 토스트 본문(킷 카피, 예: "위시리스트에 담았어요 📍"). */
  message: string;
  /** neutral(--mk-ink) | positive(#1E7A47 + ✓ prefix). 기본 neutral. */
  tone?: ToastTone;
  /** 자동 사라짐(ms). 킷 showToast 2200. */
  durationMs?: number;
  /** durationMs 경과 시 호출(소비처가 visible=false로 내림). */
  onHide?: () => void;
};

// 킷 실값(컨트롤 내부 수치): showToast 타이머 2200 · mkToast .26s · translateY 14→0 · bottom 104 · padding 13×18 · gap 9.
const DEFAULT_DURATION_MS = 2200;
const ENTER_MS = 260;
const ENTER_TRANSLATE_Y = 14;
const TOAST_BOTTOM = 104;

export const Toast = ({
  visible,
  message,
  tone = 'neutral',
  durationMs = DEFAULT_DURATION_MS,
  onHide,
}: ToastProps) => {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  // 진입 애니메이션 — visible 시 fade + slide-in(킷 mkToast). 명명 함수(컨벤션).
  useEffect(
    function animateIn() {
      if (!visible) return;
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }).start();
    },
    [visible, anim],
  );

  // 자동 사라짐 타이머 — durationMs 후 onHide(킷 showToast setTimeout 2200).
  useEffect(
    function autoHide() {
      if (!visible || !onHide) return undefined;
      const id = setTimeout(onHide, durationMs);
      return () => clearTimeout(id);
    },
    [visible, durationMs, onHide],
  );

  if (!visible) return null;

  const isPositive = tone === 'positive';
  const pill: ViewStyle = {
    backgroundColor: isPositive ? theme.color.toastPositiveBg : theme.color.toastBg,
    borderRadius: theme.radius.control,
    ...theme.shadow.toast,
  };
  const animStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [ENTER_TRANSLATE_Y, 0] }) },
    ],
  };

  return (
    // host: 하단 전폭 컨테이너에서 pill을 가로 중앙 정렬(킷 left:50% + translateX(-50%)). 터치 통과.
    <View style={styles.host} pointerEvents="box-none">
      <Animated.View accessibilityRole="alert" style={[styles.pill, pill, animStyle]}>
        {isPositive ? (
          <Text color="primaryFg" style={styles.check}>
            ✓
          </Text>
        ) : null}
        <Text variant="spotCount" color="primaryFg" style={styles.msg}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TOAST_BOTTOM,
    alignItems: 'center',
    zIndex: 95,
  },
  // 킷 .mk-toast: 내용 폭(width max-content), maxWidth 84%, padding 13×18, row, gap 9.
  pill: {
    maxWidth: '84%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  // 킷 positive ✓ fontSize 15.
  check: { fontSize: 15, lineHeight: 20 },
  // 킷 .mk-toast font 600 14px/1.4 — spotCount(SemiBold) 패밀리 + lineHeight 20 오버라이드.
  msg: { fontSize: 14, lineHeight: 20 },
});
