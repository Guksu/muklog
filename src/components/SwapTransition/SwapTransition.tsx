// src/components/SwapTransition/SwapTransition.tsx
// 한 화면 안에서 뷰가 교체될 때의 전환 — plan §3.5 (motion-pass-1, M3 / 백로그 U54).
//   "즉시 교체"는 사용자가 어디서 왔는지 알 수 없다. 전진은 오른쪽에서, 복귀는 왼쪽에서 들어오게 해
//   방향이 곧 위계를 설명하게 한다(ux-principles 원칙 4 — 상태 전이를 설명하는 모션만).
//   판단값 출처: fe-skills `enter-exit`(슬라이드 거리 16px · 감소 모션에서 이동 제거·페이드 유지) + fe-craft #3·#8.
//   ⚠️ 최초 마운트에서는 애니메이션하지 않는다 — 에디터는 네비게이션 push로 들어오고 스택 전환이 이미 있다.
//      그 위에 페이드를 겹치면 이중 모션이 된다(fe-craft #1 정당화 실패).
import React, { useLayoutEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import {
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASE_OUT,
  MotionKind,
  resolveMotionDistance,
  resolveMotionDuration,
  useReduceMotion,
} from '@/theme';

/** 전환 래퍼의 테스트 식별자(소비처 props를 늘리지 않고 렌더 결과를 잡기 위한 고정 id). */
export const SWAP_TRANSITION_TEST_ID = 'swap-transition';

export const SwapDirection = { Forward: 'forward', Back: 'back' } as const;
export type SwapDirection = (typeof SwapDirection)[keyof typeof SwapDirection];

export type SwapTransitionProps = {
  /** 현재 표시 중인 뷰의 식별자. 값이 바뀔 때만 진입 애니메이션을 1회 재생한다. */
  swapKey: string;
  /** forward=오른쪽에서 들어옴(다음 단계) / back=왼쪽에서 들어옴(복귀). 기본 forward. */
  direction?: SwapDirection;
  children: React.ReactNode;
};

export const SwapTransition = ({
  swapKey,
  direction = SwapDirection.Forward,
  children,
}: SwapTransitionProps) => {
  const reduceMotion = useReduceMotion();
  // 이동·페이드를 별도 값으로 나눈다 — 감소 모션에서 이동만 접고 크로스페이드는 남기기 위해서다(fe-craft #8).
  //   최초 마운트는 1(정착 상태)에서 시작해 애니메이션이 재생되지 않는다.
  const slide = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const shownKeyRef = useRef(swapKey);

  // ⚠️ useLayoutEffect — swapKey가 바뀐 렌더는 진행도가 아직 1(정착)이라, 페인트 뒤에 0으로 되돌리면
  //   새 화면이 한 프레임 완전히 보였다가 물러나 들어오는 깜빡임이 된다(qa-logic S5). 페인트 전에 내린다.
  useLayoutEffect(
    function playSwapEnter() {
      if (shownKeyRef.current === swapKey) return;
      shownKeyRef.current = swapKey;
      slide.setValue(0);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 1,
          duration: resolveMotionDuration({
            durationMs: MOTION_DURATION.swapEnter,
            kind: MotionKind.Move,
            reduceMotion,
          }),
          easing: Easing.bezier(...MOTION_EASE_OUT),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: resolveMotionDuration({
            durationMs: MOTION_DURATION.swapEnter,
            kind: MotionKind.Fade,
            reduceMotion,
          }),
          easing: Easing.bezier(...MOTION_EASE_OUT),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [swapKey, direction, reduceMotion],
  );

  const distance = resolveMotionDistance({
    distance: MOTION_DISTANCE.swapEnter,
    reduceMotion,
  });
  const from = direction === SwapDirection.Forward ? distance : -distance;
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  // 감소 모션이면 transform 키를 만들지 않는다(이동 제거 — 페이드만 남는다).
  const motionStyle = reduceMotion
    ? { opacity: fade }
    : { opacity: fade, transform: [{ translateX }] };

  return (
    <Animated.View testID={SWAP_TRANSITION_TEST_ID} style={[styles.fill, motionStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
