// src/features/map/components/SelectedSpotCard.tsx
// 선택 스팟 카드 — 킷 mk-home.jsx:374-389 재현 (map-tab 슬라이스 1).
//   핀 탭 시 지도 하단에 떠오르는 요약 카드.
//   킷 구조: FoodCover(cat, radius 14, emojiSize 26, 54×54) + 가게명(700/16) + 별점 + "· 카테고리 · area" + 우측 heart.
//   RN 번역:
//     - 컨테이너: surface 배경, 상단 띄움 그림자(킷 box-shadow:0 -8px 24px → shadow.md 근사, 위로 뜨는 카드라 헤어라인 아닌 그림자).
//       킷은 카드 radius 없이 화면 폭(지도 하단 도킹)이나, RN에선 지도 위 floating 카드로 radius.card 상단 모서리 부여(오버레이 정합).
//     - 메타줄: 킷 "· {CATLABEL(cat)} · {area}"(mk-home:383). category/area null 안전 합성.
//     - heart: 킷 heart-fill(primary)은 "우리 맛집" 장식 표식(토글 없음). heart-fill 글리프 부재 → outline heart(primary) 근사.
//   map-pin-card-detail(U11): onPress를 주면 카드 전체가 먹로그 상세로 가는 버튼 하나가 된다.
//     - 어포던스: 하트 뒤 chevron-right 18 / fgAssistive — 킷의 "눌러서 이동하는 카드" 어휘(LogCard mk-home:55, SheetAction :211).
//       킷 선택 카드에는 이동이 없어(SPEC §3) 이 요소 하나만 더했다. 가시 텍스트 "기록 보기"는 넣지 않고 접근성 이름으로 쓴다.
//     - 눌림: 공용 MotionPressable lg / 0.7(공용 Card·MuklogCard와 같은 카드 등급). 바깥 View가 표면(배경·radius·그림자)을 맡고
//       안쪽 MotionPressable(패딩 포함 전체 = 탭 영역)만 줄고 흐려진다 — 화면 폭 도킹 카드라 표면째 0.98로 줄이면 양옆에 지도가 비친다.
//     - onPress가 없으면 버튼·쉐브론 없이 이전과 같은 비탭 카드(주변·위시 카드와 같은 표시 전용 셸).
//   데이터·이동 배선은 부모(MapTabScreen)가 props로 주입. 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FoodCover, Icon, IconName, MotionPressable, Stars, Text } from '@/components';
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
  /**
   * 카드 탭 → 먹로그 상세 이동(부모가 navigate 배선, map-pin-card-detail).
   * 주면 카드 전체가 버튼 1개("{가게명} 기록 보기") + 끝 쉐브론, 없으면 이전과 같은 비탭 카드.
   */
  onPress?: () => void;
};

// 킷 FC 54×54, radius 14, emojiSize 26(mk-home:378).
const COVER_SIZE = 54;
const COVER_RADIUS = 14;
const COVER_EMOJI_SIZE = 26;
// 킷 heart 20(mk-home:386) · 이동 쉐브론 18(mk-home:55·211).
const HEART_SIZE = 20;
const CHEVRON_SIZE = 18;

// 카드 눌림 불투명도 — 공용 Card·MuklogCard의 카드 등급(lg / 0.7)을 승계한다.
const CARD_PRESSED_OPACITY = 0.7;

// 이동 카드의 접근성 카피(카피 단일 출처). 화면에 보이는 글자는 없고 쉐브론이 같은 뜻을 전한다.
//   이름은 "{가게명} + 동작" 꼴(MuklogCard "{가게명} 상세 보기"와 같은 꼴, "상세" 대신 사용자 말 "기록 보기").
//   힌트는 사진·메모가 없는 기록에도 참인 "방문 기록"으로 쓴다.
const OPEN_DETAIL_LABEL_SUFFIX = '기록 보기';
const OPEN_DETAIL_HINT = '방문 기록을 자세히 볼 수 있어요';

// 메타 한글 클리핑은 meta 토큰 lineHeight(13×1.4=18)로 토큰 레벨 해결(typo-clipping). 인라인 오버라이드 제거.

// 킷 메타줄 "· {라벨} · {area}"를 null 안전하게 합성한다(둘 다 null이면 "·"만 남지 않도록 빈 조각 제거).
const buildMeta = ({ label, area }: { label: string; area: string | null }): string => {
  const parts = [label, area].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.length > 0 ? `· ${parts.join(' · ')}` : '';
};

export const SelectedSpotCard = ({ placeName, rating, category, area, onPress }: SelectedSpotCardProps) => {
  const theme = useTheme();
  const meta = buildMeta({ label: categoryLabel({ key: category }), area });

  // 바깥 표면(정적) — 배경·상단 radius·떠 있는 그림자. 눌려도 움직이지 않는다.
  const surfaceStyle = [
    styles.card,
    {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.card,
      borderTopRightRadius: theme.radius.card,
    },
    theme.shadow.md,
  ];
  // 안쪽 내용 영역 — 킷 padding 14/20/16(mk-home:376). 탭 가능 카드에선 이 영역 전체가 누를 수 있는 버튼이다.
  const contentStyle = {
    paddingTop: theme.spacing[14],
    paddingBottom: theme.spacing[16],
    paddingHorizontal: theme.spacing[20],
  };

  const row = (
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
      {/* 끝 묶음 — 하트(장식)와 이동 쉐브론을 한 덩어리로 붙인다(간격 4 + 쉐브론 글리프 왼쪽 여백 ≈ 6 → 눈에 보이는 틈 ≈ 10).
          고정 폭이라 줄어들지 않고, 긴 가게명·메타는 본문(flex 1)이 1줄 말줄임으로 흡수한다. */}
      <View style={[styles.trailing, { gap: theme.spacing[4] }]}>
        {/* 킷 heart-fill(primary) 장식 표식 — 토글 없음. heart-fill 부재 → outline heart 근사. */}
        <Icon name={IconName.Heart} size={HEART_SIZE} color="primary" />
        {onPress ? <Icon name={IconName.ChevronRight} size={CHEVRON_SIZE} color="fgAssistive" /> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <View testID="selected-spot-card" style={surfaceStyle}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={`${placeName} ${OPEN_DETAIL_LABEL_SUFFIX}`}
          accessibilityHint={OPEN_DETAIL_HINT}
          onPress={onPress}
          pressSize="lg"
          pressedOpacity={CARD_PRESSED_OPACITY}
          style={contentStyle}
        >
          {row}
        </MotionPressable>
      </View>
    );
  }

  return (
    <View testID="selected-spot-card" style={[surfaceStyle, contentStyle]}>
      {row}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexShrink: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center' },
});
