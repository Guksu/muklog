// src/components/Toast.tsx
// 하단 플로팅 토스트(공용 프리미티브) — 킷 .mk-toast 재현 (index.html:36-42 + render 150-152).
//   하단 중앙 floating pill: bottom 104 · 가로 중앙 · maxWidth 84% · padding 13×18 · radius 14 · gap 9.
//   배경 neutral=--mk-ink(toastBg) / positive=.mk-toast.pos #1E7A47(toastPositiveBg) + ✓ prefix. 텍스트 흰색 600/14.
//   진입 애니메이션(킷 mkToast .26s: fade + translateY 14→0). 자동 사라짐(킷 showToast setTimeout 2200) → onHide.
//   퇴장 애니메이션(motion-pass-1 M5①): visible=false 후 160ms에 걸쳐 옅어지며 살짝 내려앉는다.
//     ⚠️ 언마운트 시점을 Animated 완료 콜백이 아니라 명시적 타이머로 잡는다 — 애니메이션이 중단돼도 반드시 정리되고,
//        테스트가 RN 내부 프레임 루프가 아니라 타이머로 결정적으로 검증할 수 있다.
//   프리젠테이셔널 — visible/message/tone은 소비처(예: useToast)가 소유. 데이터·트리거는 developer.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

import {
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASE_OUT,
  MotionKind,
  resolveMotionDistance,
  resolveMotionDuration,
  useReduceMotion,
  useTheme,
} from '@/theme';

import { Text } from '../Text';

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

// 킷 실값(컨트롤 내부 수치): showToast 타이머 2200 · bottom 104 · padding 13×18 · gap 9.
//   진입 시간·거리(킷 mkToast .26s · translateY 14→0)는 모션 토큰으로 이관했다(리터럴 단일 출처).
const DEFAULT_DURATION_MS = 2200;
const TOAST_BOTTOM = 104;

/** 토스트의 애니메이션 좌표 — 0=진입 전(아래), 1=정착, 2=퇴장 완료. 한 값으로 진입·퇴장을 모두 표현한다. */
const TOAST_PHASE = { hidden: 0, settled: 1, exited: 2 } as const;

export const Toast = ({
  visible,
  message,
  tone = 'neutral',
  durationMs = DEFAULT_DURATION_MS,
  onHide,
}: ToastProps) => {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(TOAST_PHASE.hidden)).current;
  // 퇴장 연출이 끝날 때까지 렌더를 유지하는 내부 게이트 — 소비처는 여전히 visible만 소유한다.
  const [rendered, setRendered] = useState(visible);
  const renderedRef = useRef(rendered);
  renderedRef.current = rendered;

  // 진입 — visible 시 fade + slide-in(킷 mkToast .26s / translateY 14→0). 이징은 ease-out(fe-craft #3).
  useEffect(
    function playToastEnter() {
      if (!visible) return;
      // 완전히 숨은 상태에서만 시작점으로 되돌린다. 퇴장 중이라면 현재 값에서 재타게팅한다(fe-craft #6, E16).
      if (!renderedRef.current) anim.setValue(TOAST_PHASE.hidden);
      setRendered(true);
      Animated.timing(anim, {
        toValue: TOAST_PHASE.settled,
        // 이동은 거리 0으로 접히고(감소 모션) 페이드는 남으므로 지속시간은 fade 기준으로 산출한다.
        duration: resolveMotionDuration({
          durationMs: MOTION_DURATION.toastEnter,
          kind: MotionKind.Fade,
          reduceMotion,
        }),
        easing: Easing.bezier(...MOTION_EASE_OUT),
        useNativeDriver: true,
      }).start();
    },
    [visible, reduceMotion, anim],
  );

  // 퇴장 — 진입보다 짧게(시스템 응답은 즉각, fe-craft #9). 언마운트는 타이머가 확정한다.
  useEffect(
    function playToastExit() {
      if (visible || !rendered) return undefined;
      Animated.timing(anim, {
        toValue: TOAST_PHASE.exited,
        duration: resolveMotionDuration({
          durationMs: MOTION_DURATION.toastExit,
          kind: MotionKind.Fade,
          reduceMotion,
        }),
        easing: Easing.bezier(...MOTION_EASE_OUT),
        useNativeDriver: true,
      }).start();
      const finishToastExit = () => setRendered(false);
      const id = setTimeout(finishToastExit, MOTION_DURATION.toastExit);
      return function clearToastExitTimer() {
        clearTimeout(id);
      };
    },
    [visible, rendered, reduceMotion, anim],
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

  if (!rendered) return null;

  const isPositive = tone === 'positive';
  const pill: ViewStyle = {
    backgroundColor: isPositive ? theme.color.toastPositiveBg : theme.color.toastBg,
    borderRadius: theme.radius.control,
    ...theme.shadow.toast,
  };
  // 진입(아래에서 14px 올라오며 나타남) → 정착 → 퇴장(6px 내려앉으며 사라짐)을 한 좌표로 잇는다.
  //   감소 모션이면 두 거리가 0으로 접혀 제자리 크로스페이드만 남는다(fe-craft #8).
  const phases = [TOAST_PHASE.hidden, TOAST_PHASE.settled, TOAST_PHASE.exited];
  const animStyle = {
    opacity: anim.interpolate({ inputRange: phases, outputRange: [0, 1, 0] }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: phases,
          outputRange: [
            resolveMotionDistance({ distance: MOTION_DISTANCE.toastEnter, reduceMotion }),
            0,
            resolveMotionDistance({ distance: MOTION_DISTANCE.toastExit, reduceMotion }),
          ],
        }),
      },
    ],
  };

  return (
    // host: 하단 전폭 컨테이너에서 pill을 가로 중앙 정렬(킷 left:50% + translateX(-50%)). 터치 통과.
    <View style={styles.host} pointerEvents="box-none">
      <Animated.View
        testID="toast-pill"
        accessibilityRole="alert"
        style={[styles.pill, pill, animStyle]}
      >
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
