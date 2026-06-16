// src/components/SegmentControl.tsx
// iOS 스타일 세그먼트 컨트롤 — 킷 mk-log.jsx:56-72 정합 (wishlist 스프린트).
//   트랙: fill-alt 배경 + radius 12(radius.lg) + padding 4 + gap 4.
//   각 칸: flex 1, radius 9, paddingVertical 9. 선택칸=surface + seg 그림자 + Bold(800) / 미선택=투명 + SemiBold(600) fgMuted.
//   라벨 = `${label} ${count}`(count 있으면). 데이터·세그 상태·본문 스위치는 소비처(developer)가 소유.
//   범용 컨트롤(로그 비종속) — segments/selected/onChange props만 받는다.
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

/** 세그먼트 1칸. count가 있으면 라벨 뒤에 개수 표시("기록 3"). */
export type SegmentItem = { key: string; label: string; count?: number };

export type SegmentControlProps = {
  /** 표시할 세그먼트 목록(킷: 기록/위시리스트 2칸). */
  segments: SegmentItem[];
  /** 현재 선택된 세그먼트 key. */
  selected: string;
  /** 세그먼트 선택 시 호출(named-object 인자). */
  onChange: ({ key }: { key: string }) => void;
};

// 킷 실값(컨트롤 내부 수치 — 4px 그리드 밖 raw): 칸 radius 9 · paddingVertical 9 · fontSize 13.5(라인 1).
const SEG_RADIUS = 9;
const SEG_PAD_V = 9;
const SEG_FONT_SIZE = 13.5;
const SEG_LINE_HEIGHT = 14;

export const SegmentControl = ({ segments, selected, onChange }: SegmentControlProps) => {
  const theme = useTheme();

  const track: ViewStyle = {
    flexDirection: 'row',
    gap: theme.spacing[4],
    backgroundColor: theme.color.fillAlt,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
  };

  return (
    <View style={track}>
      {segments.map((seg) => {
        const on = seg.key === selected;
        const label = seg.count === undefined ? seg.label : `${seg.label} ${seg.count}`;
        const cell: ViewStyle = {
          flex: 1,
          borderRadius: SEG_RADIUS,
          paddingVertical: SEG_PAD_V,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? theme.color.surface : 'transparent',
          ...(on ? theme.shadow.seg : null),
        };
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            onPress={() => onChange({ key: seg.key })}
            style={cell}
          >
            {/* 선택=Bold(800→cardTitle 패밀리) / 미선택=SemiBold(600→spotCount 패밀리). 크기 13.5는 킷 실값 오버라이드. */}
            <Text
              variant={on ? 'cardTitle' : 'spotCount'}
              color={on ? 'fg' : 'fgMuted'}
              style={styles.label}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: SEG_FONT_SIZE, lineHeight: SEG_LINE_HEIGHT },
});
