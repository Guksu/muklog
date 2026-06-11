// src/components/Stars.tsx
// 별점 표시/입력 컴포넌트 — mk-ui Stars 재현 (plan §6.2 / §5 T7, AC4).
//   value(1~5)만큼 채운 별(warning=앰버 근사) + 나머지 빈 별(borderStrong). editable이면 별 탭→onChange(n).
//   0/null = 모두 빈 별(미평가). 카드(표시)·입력 시트(editable) 양쪽에서 재사용. 스타일은 토큰만(raw hex 0).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconName } from './Icon';

// 별 5개 고정(1~5). map 콜백 인덱스는 외부 시그니처라 named-args 예외(컨벤션 §매개변수 예외).
const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

export type StarsProps = {
  /** 채워질 별 수(1~5). 0/null/undefined = 미평가(모두 빈 별). */
  value?: number | null;
  /** 한 별의 한 변 길이(px). 기본 14. */
  size?: number;
  /** true면 별 탭으로 점수를 입력받는다. */
  editable?: boolean;
  /** editable일 때 별(n) 탭 시 호출. */
  onChange?: (value: number) => void;
};

export const Stars = ({ value, size = 14, editable = false, onChange }: StarsProps) => {
  const filledCount = value ?? 0;

  return (
    <View style={styles.row}>
      {STAR_POSITIONS.map((position) => {
        const filled = position <= filledCount;
        const star = (
          <Icon
            name={filled ? IconName.StarFill : IconName.Star}
            size={size}
            color={filled ? 'warning' : 'borderStrong'}
          />
        );
        if (!editable) {
          return (
            <View key={position} testID={filled ? 'star-filled' : 'star-empty'}>
              {star}
            </View>
          );
        }
        return (
          <Pressable
            key={position}
            testID={filled ? 'star-filled' : 'star-empty'}
            accessibilityRole="button"
            accessibilityLabel={`별점 ${position}점`}
            onPress={() => onChange?.(position)}
            style={styles.starEditable}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starEditable: { padding: 2 },
});
