// src/features/map/components/SelectedSpotCard.tsx
// 선택 스팟 카드 — 킷 mk-home.jsx:287-301 재현 (map-tab 슬라이스 1).
//   핀 탭 시 지도 하단에 떠오르는 요약 카드.
//   킷 구조: FoodCover(cat, radius 14, emojiSize 26, 54×54) + 가게명(700/16) + 별점 + "· 카테고리 · area" + 우측 heart.
//   RN 번역:
//     - 컨테이너: surface 배경, 상단 띄움 그림자(킷 box-shadow:0 -8px 24px → shadow.md 근사, 위로 뜨는 카드라 헤어라인 아닌 그림자).
//       킷은 카드 radius 없이 화면 폭(지도 하단 도킹)이나, RN에선 지도 위 floating 카드로 radius.card 상단 모서리 부여(오버레이 정합) — ui-spec 기록.
//     - 메타줄: 킷 "· {CATLABEL(cat)} · {area}"(mk-home:295). category/area null 안전 합성.
//     - heart: 킷 heart-fill(primary)은 "우리 맛집" 장식 표식(슬라이스 1 토글 없음). heart-fill 글리프 부재 → outline heart(primary) 근사 — ui-spec 기록.
//   데이터는 props로만 주입(plan §3.3 MuklogPin: placeName/rating/category/area). 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodCover, Icon, IconName, Stars, Text } from '@/components';
import { categoryLabel } from '@/features/muklog/categories';
import type { MuklogCategoryKey } from '@/features/muklog/categories';
import { useTheme } from '@/theme';

export type SelectedSpotCardProps = {
  /** 가게명(킷 selSpot.place). */
  placeName: string;
  /** 별점 1~5(미평가 null). */
  rating: number | null;
  /** 카테고리 key(또는 null/자유 text) — 커버 이모지·라벨 출처. */
  category: MuklogCategoryKey | string | null;
  /** 지역(킷 selSpot.area, nullable). */
  area: string | null;
};

// 킷 FC 54×54, radius 14, emojiSize 26(mk-home:290).
const COVER_SIZE = 54;
const COVER_RADIUS = 14;
const COVER_EMOJI_SIZE = 26;

// 메타 한글 클리핑은 meta 토큰 lineHeight(13×1.4=18)로 토큰 레벨 해결(typo-clipping). 인라인 오버라이드 제거.

// 킷 메타줄 "· {라벨} · {area}"를 null 안전하게 합성한다(둘 다 null이면 "·"만 남지 않도록 빈 조각 제거).
const buildMeta = ({ label, area }: { label: string; area: string | null }): string => {
  const parts = [label, area].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.length > 0 ? `· ${parts.join(' · ')}` : '';
};

export const SelectedSpotCard = ({ placeName, rating, category, area }: SelectedSpotCardProps) => {
  const theme = useTheme();
  const meta = buildMeta({ label: categoryLabel({ key: category }), area });

  return (
    <View
      testID="selected-spot-card"
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
          size={COVER_SIZE}
          radius={COVER_RADIUS}
          emojiSize={COVER_EMOJI_SIZE}
        />
        <View style={styles.body}>
          <Text variant="cardTitle" color="fg" numberOfLines={1}>
            {placeName}
          </Text>
          <View style={[styles.metaRow, { gap: theme.spacing[6], marginTop: theme.spacing[4] }]}>
            <Stars value={rating} size={13} />
            {meta.length > 0 ? (
              <Text
                variant="meta"
                color="fgMuted"
                numberOfLines={1}
                style={styles.meta}
              >
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
        {/* 킷 heart-fill(primary) 장식 표식 — 슬라이스 1 토글 없음. heart-fill 부재 → outline heart 근사. */}
        <Icon name={IconName.Heart} size={20} color="primary" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexShrink: 1 },
});
