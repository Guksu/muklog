// src/components/MkSwitch.tsx
// iOS 스타일 토글 스위치(공용 프리미티브) — 킷 mk-extra.jsx:9-19 MkSwitch 재현 (notif-settings).
//   트랙 51×31·radius full / on=--mk-accent(primary)·off=--line-strong(lineStrong) / 노브 27×27 흰색(switchKnob)+그림자.
//   노브 위치 left 2↔22(=51-27-2), 킷 transition .22s var(--ease-out) → Animated translateX 220ms Easing.out.
//   props는 RN 내장 Switch 관례(value/onValueChange)에 맞춘다(팀리드 결정). disabled면 onValueChange 미발화 + a11y disabled.
//   스타일은 토큰만(raw hex/숫자 색 0). 정확한 픽셀 위치·슬라이드 모션은 디바이스 스모크 영역.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

// 킷 mk-extra:12-17 실측 수치(컨트롤 내부 상수).
const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const KNOB_SIZE = 27;
const KNOB_OFF_X = 2; // 킷 left:2 (off)
const KNOB_ON_X = TRACK_WIDTH - KNOB_SIZE - KNOB_OFF_X; // 22 (킷 left:22, on)
const SLIDE_MS = 220; // 킷 transition .22s

export type MkSwitchProps = {
  /** 켜짐 여부(RN Switch 관례). */
  value: boolean;
  /** 탭 시 !value 전달. disabled면 미발화. */
  onValueChange: (next: boolean) => void;
  /** 입력 차단(마스터 off 시 로그별 등). 시각 dim은 부모가 처리. 기본 false. */
  disabled?: boolean;
  /** 접근성 라벨(예: "새 먹로그 알림"). */
  accessibilityLabel?: string;
};

export const MkSwitch = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: MkSwitchProps) => {
  const theme = useTheme();
  // 노브 x 좌표 애니메이션 — 초기값은 현재 value의 정지 위치(마운트 시 깜빡임 없음).
  const knobX = useRef(new Animated.Value(value ? KNOB_ON_X : KNOB_OFF_X)).current;
  // 마운트 여부 — 첫 렌더에선 슬라이드를 건너뛴다(초기 ref가 이미 정지 위치라 불필요).
  //   불필요한 Animated.timing 프레임 갱신을 막아 소비처 테스트의 act() 경고를 흡수한다(비주얼 불변).
  const didMount = useRef(false);

  useEffect(
    function slideKnob() {
      if (!didMount.current) {
        didMount.current = true;
        return;
      }
      const target = value ? KNOB_ON_X : KNOB_OFF_X;
      Animated.timing(knobX, {
        toValue: target,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    },
    [value, knobX],
  );

  const handlePress = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const track: ViewStyle = {
    borderRadius: theme.radius.full,
    backgroundColor: value ? theme.color.primary : theme.color.lineStrong,
  };
  const knob: ViewStyle = {
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.switchKnob,
    ...theme.shadow.knob,
    transform: [{ translateX: knobX }],
  };

  return (
    <Pressable
      testID="mk-switch"
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      style={[styles.track, track]}
    >
      <Animated.View testID="mk-switch-knob" style={[styles.knob, knob]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // 킷 mk-extra:12 트랙 51×31. flex:none(부모 flex row에서 압축 방지) = flexGrow/Shrink 0.
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    flexGrow: 0,
    flexShrink: 0,
  },
  // 킷 mk-extra:16 노브 top:2, 27×27 절대배치. left는 translateX(KNOB_OFF/ON_X)로 이동.
  knob: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
  },
});
