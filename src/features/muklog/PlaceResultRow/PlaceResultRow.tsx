// src/features/muklog/PlaceResultRow.tsx
// 장소검색 결과 항목 1행 — 킷 mk-log.jsx:402-409 PlaceSearch 결과 + lk.resultRow(507) 재현 (plan §4.1).
//   킷 행: FoodCover(44×44, radius 12, emojiSize 22) + place_name(700/15) + `{CATLBL(cat)} · {road}`(500/12.5, ellipsis) + plus(20, accent).
//   RN 번역: Pressable 행(gap 12, pad 11×12, radius control=14), 토큰만(raw hex 0), 음식 이모지는 FoodCover(킷 허용).
//   카테고리 라벨/커버는 categories.ts(SSOT)로 해석 — category는 매핑된 8종 key(미매핑 null → cafe 커버·라벨 생략).
//
// 경계(plan): 표시 전용. 탭 콜백(onPress)만 노출 — 선택→자동채움 로직은 소비처(MuklogEntrySheet/developer).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodCover, Icon, IconName, MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

import { categoryLabel, type MuklogCategoryKey } from '../categories';

export type PlaceResultRowProps = {
  /** 장소명(Kakao place_name). */
  placeName: string;
  /** 매핑된 8종 카테고리 key — 커버 그라데이션 + 보조라벨. 미매핑(null/자유 text)이면 cafe 커버·라벨 생략. */
  category?: MuklogCategoryKey | string | null;
  /** 도로명주소(우선 표시). */
  roadAddress?: string | null;
  /** 지번 주소(roadAddress 없을 때 폴백). */
  address?: string | null;
  /** 행 탭 — 소비처가 선택→자동채움을 연결. */
  onPress: () => void;
  /** 테스트/식별자. */
  testID?: string;
};

// 킷 mk-log.jsx:403 FoodCover 44×44 / radius 12 / emojiSize 22, :408 plus 20.
const COVER_SIZE = 44;
const COVER_RADIUS = 12;
const COVER_EMOJI = 22;
const PLUS_SIZE = 20;

// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 lg(카드형 리스트 행). ui-spec §2-2 A9.
const RESULT_ROW_PRESSED_OPACITY = 0.6;

export const PlaceResultRow = ({
  placeName,
  category = null,
  roadAddress,
  address,
  onPress,
  testID,
}: PlaceResultRowProps) => {
  const theme = useTheme();
  // 킷 `{CATLBL(cat)} · {road}` — 매핑 라벨(있으면) + 도로명(없으면 지번). 빈 토큰은 흡수.
  const label = categoryLabel({ key: category });
  const place = roadAddress?.trim() || address?.trim() || '';
  const subline = [label, place].filter(Boolean).join(' · ');

  return (
    <MotionPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${placeName} 선택`}
      onPress={onPress}
      pressSize="lg"
      pressedOpacity={RESULT_ROW_PRESSED_OPACITY}
      style={[
        styles.row,
        { borderRadius: theme.radius.control, paddingVertical: 11, paddingHorizontal: 12 },
      ]}
    >
      <FoodCover category={category} size={COVER_SIZE} radius={COVER_RADIUS} emojiSize={COVER_EMOJI} />
      <View style={styles.body}>
        {/* 킷 700/15 — cardTitle(Bold) family에 fontSize 15 오버라이드. */}
        <Text variant="cardTitle" color="fg" numberOfLines={1} style={styles.name}>
          {placeName}
        </Text>
        {subline ? (
          // 킷 500/12.5 --text-alternative → meta(Medium) + fgMuted, ellipsis.
          <Text variant="meta" color="fgMuted" numberOfLines={1} style={styles.subline}>
            {subline}
          </Text>
        ) : null}
      </View>
      <Icon name={IconName.Plus} size={PLUS_SIZE} color="primary" />
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  // 킷 lk.resultRow: gap 12, transparent bg(보더 없음).
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15 },
  subline: { fontSize: 12.5, marginTop: 2 },
});
