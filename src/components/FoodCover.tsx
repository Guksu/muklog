// src/components/FoodCover.tsx
// 음식 사진 플레이스홀더 — 카테고리 그라데이션 배경 + 대표 이모지 (킷 mk-ui.jsx:49-62 FoodCover, A1).
//   킷: background=CAT.grad(linear-gradient 140deg), 중앙 대표 이모지(drop-shadow), overflow hidden.
//   RN 번역: expo-linear-gradient(140deg ≈ start{0,0}→end{1,1}), 이모지=Text(fontSize), 라운드=props.radius.
//   카테고리→그라데이션/이모지는 categories.ts(SSOT)에서 cafe 폴백으로 해석(킷 CAT[cat]||CAT.cafe 정합).
//   children=커버 위 오버레이(사진수 배지 등) — 데이터 바인딩은 props로 노출(developer 영역).
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  categoryColors,
  categoryEmoji,
  MUKLOG_CATEGORIES,
  type MuklogCategoryKey,
} from '@/features/muklog/categories';

export type FoodCoverProps = {
  /** 카테고리 key(또는 null/자유 text). 미지/null은 cafe 그라데이션·이모지로 폴백. */
  category: MuklogCategoryKey | string | null;
  /** 정사각 커버 한 변(px). 미지정 시 소비처가 style(aspectRatio 등)로 크기를 잡는다. */
  size?: number;
  /** 모서리 반경(px). 킷 기본 20. */
  radius?: number;
  /** 대표 이모지 크기(px). 킷 기본 40. */
  emojiSize?: number;
  /** 커버 컨테이너 추가 스타일(크기·aspectRatio 등은 소비처가 지정). */
  style?: ViewStyle;
  /** 커버 위 오버레이(사진수 배지 등). */
  children?: React.ReactNode;
};

// 킷 linear-gradient(140deg) 근사 — 좌상단→우하단 대각.
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

export const FoodCover = ({
  category,
  size,
  radius = 20,
  emojiSize = 40,
  style,
  children,
}: FoodCoverProps) => {
  // 킷 CAT[cat]||CAT.cafe 정합 — 미지 key는 cafe 이모지로 폴백(categoryEmoji는 빈 문자열 반환하므로 보강).
  const emoji = categoryEmoji({ key: category }) || MUKLOG_CATEGORIES.cafe.emoji;
  const colors = categoryColors({ key: category });
  const sizeStyle: ViewStyle = size ? { width: size, height: size } : {};

  return (
    <LinearGradient
      testID="food-cover-gradient"
      colors={colors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.cover, { borderRadius: radius }, sizeStyle, style]}
    >
      <Text style={[styles.emoji, { fontSize: emojiSize }]}>{emoji}</Text>
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 킷 이모지 drop-shadow(0 2px 6px rgba(0,0,0,.12)) 근사 — 프레젠테이션 전용 그림자(시맨틱 색 아님).
  emoji: {
    lineHeight: undefined,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
