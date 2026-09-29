// src/features/map/components/WishSpotCard.tsx
// 위시 스팟 카드 — 킷 mk-home.jsx:374-389 스팟 카드 셸 미러 (map-wish-pins).
//   위시 핀(kind:'wish') 탭 시 지도 하단에 떠오르는 카드. SelectedSpotCard/NearbySpotCard와 같은 슬롯·카드 셸.
//   킷엔 위시 전용 카드 함수가 없다(킷 MapScreen은 saved 카드만) → 스팟 카드 셸을 그대로 미러하고 표시 필드만 축소:
//     FoodCover(카테고리 tint + coverEmoji) + 가게명 + "· 카테고리 라벨 · area". SelectedSpotCard와의 차이:
//     - 별점(Stars) 없음 — 위시는 미방문이라 평점 없음.
//     - heart 없음 — 아직 먹로그가 아님.
//     - 거리 없음.
//   map-wish-card-visit(U12): onVisit을 주면 카드 아래에 "기록하기" 버튼 1개(없으면 이전과 같은 표시 전용 카드).
//     - 모양·자리: 주변 카드 "위시에 담기"(NearbySpotCard)와 같은 공용 Button soft/md/full + 본문과 간격 14 —
//       킷 행동 버튼 어휘(MkButton soft, mk-extra.jsx:187)를 지도 하단 카드에 두는 기존 조합을 그대로 쓴다.
//     - 카피: 킷 위시 방문 버튼(ex.visitBtn, mk-extra.jsx:212·232)은 글자만이고 원문 "다녀왔어요"를
//       사용자 승인 이탈(2026-09-05, K1)로 "기록하기"라 쓴다 — 위시 목록(WishlistView)과 같은 말. 아이콘 없음.
//     - 카드 본문(표지·가게명·메타)은 버튼이 아니고 쉐브론도 없다: `›`는 "눌러서 보기"(U11 우리 맛집 카드),
//       이 카드의 버튼은 "행동"(쓰기 화면이 열리고 저장하면 위시가 빠진다)이라 이름 붙은 버튼으로 구분한다.
//     - 눌림: 공용 Button 내부 MotionPressable(md / 0.85, 감소 모션이면 흐림만) — 새 모션 없음.
//   coverEmoji는 부모(MapTabScreen)가 pin(wishToMapMarkers)과 동일한 categoryEmoji로 산출·주입 →
//     카드↔핀 이모지 단일 출처(drift 방지, plan 경계면 §7-6). FoodCover엔 emoji 오버라이드로 넘긴다.
//   category는 FoodCover 그라데이션 tint + 메타 라벨(categoryLabel) 출처로만 사용(글리프는 coverEmoji 우선).
//   셸 정합(Selected/NearbySpotCard와 비주얼 일관): surface 배경·상단 radius.card·상향 그림자 shadow.md·
//     FoodCover 54×54/radius14/emojiSize26·동일 padding(14/20/16)·동일 row gap.
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, FoodCover, Text } from '@/components';
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
  /**
   * "기록하기" 탭 → 이 위시 장소로 새 먹로그 작성(부모가 navigate 배선, map-wish-card-visit).
   * 주면 카드 아래에 버튼 1개, 없으면 이전과 같은 표시 전용 카드.
   */
  onVisit?: () => void;
};

// 킷 FC 54×54, radius 14, emojiSize 26(mk-home.jsx:378) — Selected/NearbySpotCard와 동일 셸.
const COVER_SIZE = 54;
const COVER_RADIUS = 14;
const COVER_EMOJI_SIZE = 26;

// 기록하기 액션 카피(카피 단일 출처). 보이는 글자는 위시 목록 WishlistView와 같은 "기록하기"(K1),
//   접근성 이름은 "{가게명} 기록하기"(목록과 같은 꼴 — 같은 행동은 어디서든 같은 이름),
//   힌트는 누른 뒤 무엇이 채워져 있는지 알려 준다(지도 힌트 문체 "…할 수 있어요").
const VISIT_ACTION_LABEL = '기록하기';
const VISIT_ACTION_HINT = '가게 정보를 채운 채로 방문 기록을 남길 수 있어요';

// 메타 한글 클리핑은 meta 토큰 lineHeight(13×1.4=18)로 토큰 레벨 해결(typo-clipping). 인라인 오버라이드 제거.

// 킷 메타줄 "· {라벨} · {area}"를 null 안전하게 합성한다(둘 다 null이면 "·"만 남지 않도록 빈 조각 제거).
//   SelectedSpotCard.buildMeta와 동일 규칙(별점 없는 위시 카드용).
const buildMeta = ({ label, area }: { label: string; area: string | null }): string => {
  const parts = [label, area].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.length > 0 ? `· ${parts.join(' · ')}` : '';
};

export const WishSpotCard = ({ placeName, category, coverEmoji, area, onVisit }: WishSpotCardProps) => {
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

      {/* 기록하기 — 주변 카드 "위시에 담기"와 같은 자리·모양(Button soft/md/full, 본문과 간격 14). onVisit 없으면 미렌더.
          에디터 이동·프리필·연타 가드는 부모(MapTabScreen) 배선 — 여기선 콜백만 노출. */}
      {onVisit ? (
        <Button
          testID="wish-spot-visit"
          title={VISIT_ACTION_LABEL}
          variant="soft"
          size="md"
          full
          accessibilityLabel={`${placeName} ${VISIT_ACTION_LABEL}`}
          accessibilityHint={VISIT_ACTION_HINT}
          onPress={onVisit}
          style={{ marginTop: theme.spacing[14] }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, minWidth: 0 },
  meta: { flexShrink: 1 },
});
