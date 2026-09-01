// src/components/MotionPressable/MotionPressable.tsx
// 프레스 피드백 공용 래퍼 — plan §3.3 (motion-pass-1, M1의 유일한 구현체).
//   기존 `pressed && {opacity}` 즉시 점프를 **누름 60ms 즉각 축소 / 복귀 스프링**으로 바꾼다.
//   판단값 출처: fe-skills `press-feedback`(비대칭 타이밍 60ms↔220ms, scale 등급 0.94·0.96·0.98,
//   감소 모션에서는 축소를 끄고 불투명도 피드백만 남긴다) + fe-craft #9(비대칭)·#8(감소 모션 완화).
//   킷은 정지 시안이라 눌림 모션에 침묵한다 — 불투명도 실값은 소비처의 기존 값을 그대로 승계해 비주얼 회귀 0.
import React from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  MOTION_DURATION,
  MOTION_EASE_OUT,
  PRESS_OUT_SPRING,
  resolvePressScale,
  useReduceMotion,
  type PressScaleSize,
} from '@/theme';

/** 눌림 불투명도 기본값 — 기존 공용 버튼·칩의 눌림 스타일 값. */
const DEFAULT_PRESSED_OPACITY = 0.85;

/** 평상 상태 불투명도 — 눌림 보간의 시작점(소비처의 정적 opacity는 여기에 덮인다). */
const RESTING_OPACITY = 1;

/** style로 dim을 넘겼을 때의 경고 문구 — 조용한 무시를 개발 중에 드러낸다. */
export const MOTION_PRESSABLE_STATIC_OPACITY_WARNING =
  'MotionPressable의 style에 준 opacity는 눌림 보간(평상 1 → pressedOpacity)에 덮여 무시됩니다. 눌림 표현은 pressedOpacity로 넘기고, 비활성 dim은 disabled와 함께 주세요.';

// 매 렌더 새로 만들면 언마운트/리마운트로 터치가 끊긴다 — 모듈 스코프에서 1회 생성한다(plan §3.3-6).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type MotionPressableProps = Omit<PressableProps, 'style'> & {
  /** 눌림 스케일 등급. sm=아이콘·아바타(0.94) / md=버튼·칩(0.96) / lg=카드·행(0.98). 기본 md. */
  pressSize?: PressScaleSize;
  /** 눌림 시 도달할 불투명도. 각 소비처의 기존 값을 그대로 넘겨 비주얼을 보존한다. 기본 0.85. */
  pressedOpacity?: number;
  /**
   * 정적/토큰 스타일. 함수 형태(({pressed}) => ...)는 지원하지 않는다 — Animated 합성 대상이라 배열·객체만.
   * ⚠️ 여기에 준 `opacity`는 **무시된다**(눌림 보간이 평상 1에서 시작해 마지막에 합성된다).
   *    눌렀을 때의 흐려짐은 `pressedOpacity`로, 비활성 dim은 `disabled`와 함께 넘긴다
   *    (`disabled`면 모션 스타일을 붙이지 않으므로 소비처 opacity가 그대로 보인다).
   */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export const MotionPressable = ({
  pressSize = 'md',
  pressedOpacity = DEFAULT_PRESSED_OPACITY,
  style,
  children,
  disabled = false,
  onPressIn,
  onPressOut,
  ...rest
}: MotionPressableProps) => {
  const reduceMotion = useReduceMotion();
  // 0=평상, 1=눌림. 새 애니메이션은 현재 값에서 재타게팅한다 — setValue 리셋 금지(fe-craft #6, plan E5).
  const progress = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = (event: GestureResponderEvent) => {
    Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_DURATION.pressIn,
      easing: Easing.bezier(...MOTION_EASE_OUT),
      useNativeDriver: true,
    }).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    Animated.spring(progress, {
      toValue: 0,
      ...PRESS_OUT_SPRING,
      useNativeDriver: true,
    }).start();
    onPressOut?.(event);
  };

  // 소비처가 style로 dim을 주면 평상 상태에서 덮여 조용히 사라진다 — 개발 중에 드러낸다(F2).
  if (__DEV__ && !disabled) {
    const staticOpacity = (StyleSheet.flatten(style) as ViewStyle | undefined)?.opacity;
    if (staticOpacity !== undefined && staticOpacity !== RESTING_OPACITY) {
      console.warn(MOTION_PRESSABLE_STATIC_OPACITY_WARNING);
    }
  }

  // 비활성이면 눌림 연출을 걸지 않는다 — 소비처가 비활성 표시로 준 opacity가 그대로 보여야 한다(plan §3.3-5).
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RESTING_OPACITY, pressedOpacity],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, resolvePressScale({ size: pressSize, reduceMotion })],
  });
  // 감소 모션이면 transform 키를 아예 만들지 않는다(이동 제거 · 불투명도 피드백은 유지 — fe-craft #8).
  const motionStyle = reduceMotion ? { opacity } : { opacity, transform: [{ scale }] };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      style={disabled ? style : [style, motionStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};
