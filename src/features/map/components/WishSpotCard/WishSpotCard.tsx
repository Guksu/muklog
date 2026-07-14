// src/features/map/components/WishSpotCard.tsx
// 위시 스팟 카드 — 킷 mk-home.jsx:386-393 스팟 카드 셸 미러 (map-wish-pins, plan §4.1·T8).
//   위시 핀(kind:'wish') 탭 시 지도 하단에 떠오르는 최소 카드. SelectedSpotCard/NearbySpotCard와 같은 슬롯·카드 셸.
//   킷엔 위시 전용 카드 함수가 없다(킷 MapScreen은 saved 카드만) → 스팟 카드 셸을 그대로 미러하고 표시 필드만 축소:
//     FoodCover(카테고리 tint + coverEmoji) + 가게명 + "· 카테고리 라벨 · area". SelectedSpotCard와의 차이:
//     - 별점(Stars) 없음 — 위시는 미방문이라 평점 없음.
//     - heart 없음 — 아직 먹로그가 아님.
//     - 거리·액션 없음 — 최소 표시 카드(plan §4.1 "액션 없음").
//   coverEmoji는 부모(MapTabScreen)가 pin(wishToMapMarkers)과 동일한 categoryEmoji로 산출·주입 →
//     카드↔핀 이모지 단일 출처(drift 방지, plan 경계면 §7-6). FoodCover엔 emoji 오버라이드로 넘긴다.
//   category는 FoodCover 그라데이션 tint + 메타 라벨(categoryLabel) 출처로만 사용(글리프는 coverEmoji 우선).
//   셸 정합(Selected/NearbySpotCard와 비주얼 일관): surface 배경·상단 radius.card·상향 그림자 shadow.md·
//     FoodCover 54×54/radius14/emojiSize26·동일 padding(14/20/16)·동일 row gap.
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodCover, Text } from '@/components';
import { categoryLabel } from '@/features/muklog/categories';
import type { MuklogCategoryKey } from '@/features/muklog/categories';
import { useTheme } from '@/theme';

export type WishSpotCardProps = {
  /** 가게명(위시 placeName). */
  placeName: string;
  /** 카테고리 key(또는 null/자유 text) — 커버 tint·라벨 출처. */
  category: MuklogCategoryKey | string | null;
  /**
   * 커버 이모지. 부모(MapTabScreen)가 pin과 동일한 categoryEmoji로 산출·주입(카드↔핀 단일 출처, plan §7-6).
   * FoodCover에 emoji 오버라이드로 넘겨 핀과 같은 글리프를 렌더(null category 폴백도 pin과 일치).
   */
  coverEmoji: string;
  /** 지역(위시 area, nullable). */
  area: string | null;
};

// 킷 FC 54×54, radius 14, emojiSize 26(mk-home:290) — Selected/NearbySpotCard와 동일 셸.
const COVER_SIZE = 54;
const COVER_RADIUS = 14;
const COVER_EMOJI_SIZE = 26;

// 메타 한글 클리핑은 meta 토큰 lineHeight(13×1.4=18)로 토큰 레벨 해결(typo-clipping). 인라인 오버라이드 제거.

// 킷 메타줄 "· {라벨} · {area}"를 null 안전하게 합성한다(둘 다 null이면 "·"만 남지 않도록 빈 조각 제거).
//   SelectedSpotCard.buildMeta와 동일 규칙(별점 없는 위시 카드용).
const buildMeta = ({ label, area }: { label: string; area: string | null }): string => {
  const parts = [label, area].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.length > 0 ? `· ${parts.join(' · ')}` : '';
};

export const WishSpotCard = ({ placeName, category, coverEmoji, area }: WishSpotCardProps) => {
  const theme = useTheme();
  const meta = buildMeta({ label: categoryLabel({ key: category }), area });

  return (
    <View
      testID="wish-spot-card"
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderTopLeftRadius: theme.radius.card,
          borderTopRightRadius: theme.radius.card,
          paddingTop: theme.spacing[14],
          paddingBottom: theme.spacing[16],
          paddingHorizontal: theme.spacing[20],
        },
        theme.shadow.md,
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing[12] }]}>
        <FoodCover
          category={category}
          emoji={coverEmoji}
          size={COVER_SIZE}
          radius={COVER_RADIUS}
          emojiSize={COVER_EMOJI_SIZE}
        />
        <View style={styles.body}>
          <Text variant="cardTitle" color="fg" numberOfLines={1}>
            {placeName}
          </Text>
          {meta.length > 0 ? (
            <Text
              variant="meta"
              color="fgMuted"
              numberOfLines={1}
              style={[styles.meta, { marginTop: theme.spacing[4] }]}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, minWidth: 0 },
  meta: { flexShrink: 1 },
});
