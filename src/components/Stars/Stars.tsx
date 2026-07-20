// src/components/Stars.tsx
// 별점 표시/입력 컴포넌트 — mk-ui Stars(mk-ui.jsx:32) 재현 + 0.5 단위 확장 (plan §2 Stars, AC2/AC3).
//   표시: position ≤ value ⇒ 꽉 찬 별(starFill=킷 #FFB23E), position−0.5 ≤ value < position ⇒ 반 별,
//   그 외 빈 별(lineStrong=--line-strong). 0/null = 모두 빈 별(미평가).
//   반 별 근사: 킷 Stars는 이진 채움(star-fill/star)뿐이라, 빈 별 위에 좌측 절반만 클리핑한
//   채운 별을 오버레이해 근사한다(사유는 ui-spec.md). editable이면 별을 좌/우 반으로 나눠
//   좌측 탭→onChange(max(1, position−0.5)), 우측 탭→onChange(position). 계약 최소 1.0으로
//   클램프해 별1 좌/우 모두 1을 방출(리더 결정). 스타일은 토큰만(raw hex 0).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconName } from '../Icon';

// 별 5개 고정(1~5). map 콜백 인덱스는 외부 시그니처라 named-args 예외(컨벤션 §매개변수 예외).
const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

// 한 별의 채움 상태 — 한정 집합이라 enum-style 상수(컨벤션 §도메인 식별 문자열).
const StarState = {
  Filled: 'filled',
  Half: 'half',
  Empty: 'empty',
} as const;
type StarState = (typeof StarState)[keyof typeof StarState];

export type StarsProps = {
  /** 별점(1~5, 0.5 단위 소수 허용 — 예: 3.5). 0/null/undefined = 미평가(모두 빈 별). */
  value?: number | null;
  /** 한 별의 한 변 길이(px). 기본 15(킷 mk-ui:32). */
  size?: number;
  /** true면 별 좌/우 반 탭으로 0.5 단위 점수를 입력받는다. */
  editable?: boolean;
  /** editable일 때 좌측 반 탭→max(1, position−0.5), 우측 반 탭→position 으로 호출. */
  onChange?: (value: number) => void;
};

export const Stars = ({ value, size = 15, editable = false, onChange }: StarsProps) => {
  const filled = value ?? 0;

  const resolveState = ({ position }: { position: number }): StarState => {
    if (position <= filled) return StarState.Filled;
    if (position - 0.5 <= filled) return StarState.Half;
    return StarState.Empty;
  };

  const renderStar = ({ state }: { state: StarState }) => {
    if (state === StarState.Half) {
      return (
        <View style={{ width: size, height: size }}>
          <Icon name={IconName.Star} size={size} color="lineStrong" />
          <View style={[styles.halfClip, { width: size / 2, height: size }]}>
            <Icon name={IconName.StarFill} size={size} color="starFill" />
          </View>
        </View>
      );
    }
    const isFilled = state === StarState.Filled;
    return (
      <Icon
        name={isFilled ? IconName.StarFill : IconName.Star}
        size={size}
        color={isFilled ? 'starFill' : 'lineStrong'}
      />
    );
  };

  return (
    <View style={styles.row}>
      {STAR_POSITIONS.map((position) => {
        const state = resolveState({ position });
        const testID = `star-${state}`;
        if (!editable) {
          return (
            <View key={position} testID={testID}>
              {renderStar({ state })}
            </View>
          );
        }
        // 좌측 반은 position−0.5, 단 데이터 계약 최소 1.0으로 클램프(별1 좌측=1, 리더 결정).
        const leftValue = Math.max(1, position - 0.5);
        // 별1은 클램프로 좌/우 방출값이 동일(1) → 반 분할 없이 단일 풀사이즈 Pressable(동일 라벨 인접 버튼 방지).
        if (leftValue === position) {
          return (
            <Pressable
              key={position}
              testID={testID}
              style={styles.starEditable}
              accessibilityRole="button"
              accessibilityLabel={`별점 ${position}점`}
              onPress={() => onChange?.(position)}
            >
              {renderStar({ state })}
            </Pressable>
          );
        }
        return (
          <View key={position} testID={testID} style={styles.starEditable}>
            {renderStar({ state })}
            <View style={styles.editOverlay}>
              <Pressable
                style={styles.editHalf}
                accessibilityRole="button"
                accessibilityLabel={`별점 ${leftValue}점`}
                onPress={() => onChange?.(leftValue)}
              />
              <Pressable
                style={styles.editHalf}
                accessibilityRole="button"
                accessibilityLabel={`별점 ${position}점`}
                onPress={() => onChange?.(position)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starEditable: { padding: 2 },
  halfClip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  editOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  editHalf: { flex: 1 },
});
