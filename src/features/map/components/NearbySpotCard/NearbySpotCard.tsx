// src/features/map/components/NearbySpotCard.tsx
// 주변 음식점 카드 — 킷 mk-home.jsx:287-301 선택 스팟 카드 셸 재사용 (map-tab 슬라이스 2).
//   주변 핀(saved:false) 탭 시 지도 하단에 떠오르는 요약 카드. SelectedSpotCard와 같은 슬롯·같은 카드 셸.
//   킷엔 nearby 전용 카드 함수가 없다(킷 MapScreen은 saved 카드만). plan §4 확정대로
//   동일 카드 셸에서 표시 필드만 축소: FoodCover + 가게명 + "카테고리명 · 거리".
//   SelectedSpotCard와의 차이(주변 음식점엔 그 데이터가 없음):
//     - 별점(Stars) 없음 — 주변 음식점은 내 평점이 없음.
//     - area 없음 — Kakao FD6 카테고리명만(브레드크럼) 표시.
//     - heart(우리 맛집 표식) 없음 — 내 맛집이 아님.
//   셸 정합(SelectedSpotCard와 비주얼 일관): surface 배경·상단 radius.card·상향 그림자 shadow.md 근사·
//     FoodCover 54×54/radius14/emojiSize26·동일 padding(14/20/16)·동일 row gap.
//   FoodCover = cafe 중립 그라데이션 배경(category=null) + 종목 이모지(coverEmoji 오버라이드).
//     raw 브레드크럼을 FoodCover에 넘기던 ☕ 일괄 폴백 버그 제거 — 종목 이모지는 부모가 nearbyCategoryEmoji로 산출·주입(developer).
//   categoryName(메타 텍스트)도 부모가 lastCategorySegment로 가공한 마지막 세그먼트(예 "칼국수")를 주입(developer).
//   거리(distanceText)는 developer가 formatDistance로 만들어 주입(거리 결측이면 미전달 → 거리 조각 생략).
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, FoodCover, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

// "위시에 담기" 액션 라벨(카피 단일 출처). 킷 직접 시안 없음 — 위시 추가 CTA(mk-extra:187) 패턴을 조합.
const ADD_WISH_LABEL = '위시에 담기';

export type NearbySpotCardProps = {
  /** 가게명(Kakao placeName). */
  placeName: string;
  /**
   * 메타줄에 표시할 카테고리 텍스트(마지막 세그먼트, 예 "칼국수").
   * 부모(MapTabScreen)가 lastCategorySegment로 브레드크럼을 가공해 주입. 빈 문자열이면 메타에서 생략.
   */
  categoryName: string;
  /**
   * 종목 이모지(주변 전용 매핑 결과). 부모(MapTabScreen)가 nearbyCategoryEmoji로 산출·주입.
   * FoodCover에 emoji 오버라이드로 넘겨 종목별 이모지를 렌더(raw 브레드크럼을 더 이상 FoodCover에 넘기지 않음).
   */
  coverEmoji: string;
  /** 거리 표기 문자열(예 "320m"/"1.5km"). developer가 formatDistance로 생성·주입. 결측이면 미전달 → 거리 생략. */
  distanceText?: string;
  /**
   * "위시에 담기" 탭 핸들러(map-nearby-wish). developer가 로그 선택/insert/토스트 흐름을 배선.
   * 미전달이면 액션을 렌더하지 않는다(순수 표시 카드로 동작 — 기존 소비처 보존).
   */
  onAddWish?: () => void;
  /** 담는 중(insert 진행) — 액션을 로딩/비활성해 중복 탭을 막는다(로딩 가드). 기본 false. */
  adding?: boolean;
};

// 킷 FC 54×54, radius 14, emojiSize 26(mk-home:290) — SelectedSpotCard와 동일 셸.
const COVER_SIZE = 54;
const COVER_RADIUS = 14;
const COVER_EMOJI_SIZE = 26;

// 메타 한글 클리핑은 meta 토큰 lineHeight(13×1.4=18)로 토큰 레벨 해결(typo-clipping). 인라인 오버라이드 제거.

// 킷 메타줄 패턴("· {조각}")을 따르되 nearby는 "카테고리명 · 거리". 거리 없으면 카테고리명만(거리 조각 생략).
const buildMeta = ({
  categoryName,
  distanceText,
}: {
  categoryName: string;
  distanceText?: string;
}): string => {
  const parts = [categoryName, distanceText].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );
  return parts.join(' · ');
};

export const NearbySpotCard = ({
  placeName,
  categoryName,
  coverEmoji,
  distanceText,
  onAddWish,
  adding = false,
}: NearbySpotCardProps) => {
  const theme = useTheme();
  const meta = buildMeta({ categoryName, distanceText });

  return (
    <View
      testID="nearby-spot-card"
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
          category={null}
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

      {/* "위시에 담기" — 킷 직접 시안 없음(킷 MapScreen엔 saved 카드만). 위시 추가 CTA(mk-extra:187,
          MkButton soft + leftIcon plus)를 그대로 재사용해 카드 하단 풀폭 버튼으로 배치. onAddWish 없으면 미렌더.
          로그 선택/insert/토스트 흐름은 developer(MapTabScreen) 배선 — 여기선 콜백만 노출. */}
      {onAddWish ? (
        <Button
          testID="nearby-add-wish"
          title={ADD_WISH_LABEL}
          variant="soft"
          size="md"
          leftIcon={IconName.Plus}
          full
          loading={adding}
          onPress={onAddWish}
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
