// src/features/muklog/PlaceSelectedSummary.tsx
// 장소 선택 요약 카드 — 킷 mk-log.jsx:302-310 placeChosen + lk.placeChosen(499) 재현 (plan §4.1·D2).
//   킷 placeChosen: accent-weak 배경 + 1.5px accent-line 보더 + radius 16(xl) + FoodCover(48, radius 12, emoji 24)
//     + place_name(700/16) + (road||area)(500/12.5) + "변경"(700/13, accent-strong).
//   RN 번역: 킷 카드 그대로(토큰만). 우측 액션은 plan D2 "선택 해제"(좌표 NULL 리셋, 장소명 유지)로 라벨링.
//     주소행은 plan §4.1 "📍 {도로명주소}" — 음식/핀 이모지는 킷 기준 허용.
//
// 경계(plan): 표시 전용. onClear(선택 해제) 콜백만 — 좌표 NULL 처리·자동채움 복귀는 소비처(developer).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FoodCover, Text } from '@/components';
import { useTheme } from '@/theme';

import { type MuklogCategoryKey } from './categories';

export type PlaceSelectedSummaryProps = {
  /** 선택된 장소명(자동채움된 장소명과 동일). */
  placeName: string;
  /** 매핑된 8종 카테고리 key — 커버 그라데이션(미매핑 null → cafe 커버). */
  category?: MuklogCategoryKey | string | null;
  /** 도로명주소(우선). 없으면 area로 폴백(킷 road||area). */
  roadAddress?: string | null;
  /** 동네(area) — roadAddress 폴백. */
  area?: string | null;
  /** "선택 해제"(수동 전환) — 소비처가 좌표 NULL 리셋(plan D2). 장소명은 유지. */
  onClear: () => void;
  /** 테스트/식별자. */
  testID?: string;
};

// 킷 mk-log.jsx:304 FoodCover 48×48 / radius 12 / emojiSize 24.
const COVER_SIZE = 48;
const COVER_RADIUS = 12;
const COVER_EMOJI = 24;
const BORDER_WIDTH = 1.5; // 킷 lk.placeChosen "1.5px solid var(--mk-accent-line)"

export const PlaceSelectedSummary = ({
  placeName,
  category = null,
  roadAddress,
  area,
  onClear,
  testID = 'place-selected-summary',
}: PlaceSelectedSummaryProps) => {
  const theme = useTheme();
  // 킷 road||area — plan §4.1 "📍 {도로명주소}".
  const place = roadAddress?.trim() || area?.trim() || '';

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.color.primaryWeak,
          borderColor: theme.color.accentLine,
          borderRadius: theme.radius.xl,
          padding: theme.spacing[12],
          gap: theme.spacing[12],
        },
      ]}
    >
      <FoodCover category={category} size={COVER_SIZE} radius={COVER_RADIUS} emojiSize={COVER_EMOJI} />
      <View style={styles.body}>
        {/* 킷 700/16 → navTitle(Bold/16). */}
        <Text variant="navTitle" color="fg" numberOfLines={1}>
          {placeName}
        </Text>
        {place ? (
          // 킷 500/12.5 --text-alternative → meta(Medium)+fgMuted. plan "📍" prefix(이모지 허용).
          <Text variant="meta" color="fgMuted" numberOfLines={1} style={styles.sub}>
            {`📍 ${place}`}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="장소 선택 해제"
        onPress={onClear}
        hitSlop={8}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
        {/* 킷 "변경"(700/13, accent-strong) 위치 — plan D2 의미 "선택 해제". */}
        <Text variant="caption" color="accentStrong" style={styles.action}>
          선택 해제
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: BORDER_WIDTH },
  body: { flex: 1, minWidth: 0 },
  sub: { fontSize: 12.5, marginTop: 3 },
  pressed: { opacity: 0.6 },
  action: { fontSize: 13 },
});
