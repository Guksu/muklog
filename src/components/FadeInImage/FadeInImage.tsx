// src/components/FadeInImage/FadeInImage.tsx
// 사진 로드 페이드인 — plan §3.6 (motion-pass-1, M4). RN Image의 드롭인 대체다.
//   사진이 "팍" 나타나는 대신 로드 완료(또는 실패) 시 200ms 페이드로 자리를 잡는다(ux-principles 원칙 4).
//   ⚠️ fail-visible: onError에서도 반드시 보이게 만든다 — 만료된 signed URL 등으로 실패해도
//      "영원히 투명한 빈칸"이 되면 사용자는 사진이 사라졌다고 읽는다(원칙 3·10).
//   감소 모션에서도 페이드는 유지한다(이동 모션이 없고, 크로스페이드는 감소 모션의 권장 대체 — fe-craft #8).
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type ImageErrorEventData,
  type ImageLoadEventData,
  type ImageProps,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  MOTION_DURATION,
  MOTION_EASE_OUT,
  MotionKind,
  resolveMotionDuration,
  useReduceMotion,
} from '@/theme';

/** RN Image와 동일한 props를 받는 드롭인 대체. 로드 완료(또는 실패) 시 opacity 0→1로 나타난다. */
export type FadeInImageProps = ImageProps;

export const FadeInImage = ({ style, onLoad, onError, ...rest }: FadeInImageProps) => {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  // 정착 후에는 Animated 노드를 놓아주고 평범한 숫자 1로 렌더한다 — 재렌더마다 애니메이션이 되살아나지 않는다.
  const [settled, setSettled] = useState(false);
  // 첫 이벤트에서만 페이드를 시작한다(load가 두 번 와도 상태가 흔들리지 않게).
  const startedRef = useRef(false);
  // 리스트 스크롤 중 카드 언마운트가 흔하다 — 완료 콜백에서 setState 금지(plan E7).
  const mountedRef = useRef(true);

  useEffect(function trackMounted() {
    mountedRef.current = true;
    return function releaseMounted() {
      mountedRef.current = false;
    };
  }, []);

  const playFadeIn = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    Animated.timing(opacity, {
      toValue: 1,
      duration: resolveMotionDuration({
        durationMs: MOTION_DURATION.photoFade,
        kind: MotionKind.Fade,
        reduceMotion,
      }),
      easing: Easing.bezier(...MOTION_EASE_OUT),
      useNativeDriver: true,
    }).start(function settleFadeIn() {
      if (!mountedRef.current) return;
      setSettled(true);
    });
  };

  const handleLoad = (event: NativeSyntheticEvent<ImageLoadEventData>) => {
    playFadeIn();
    onLoad?.(event);
  };

  const handleError = (event: NativeSyntheticEvent<ImageErrorEventData>) => {
    playFadeIn();
    onError?.(event);
  };

  return (
    <Animated.Image
      style={[style, { opacity: settled ? 1 : opacity }]}
      onLoad={handleLoad}
      onError={handleError}
      {...rest}
    />
  );
};
