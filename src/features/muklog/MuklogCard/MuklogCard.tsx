// src/features/muklog/MuklogCard.tsx
// 맛집 카드 — 킷 mk-log.jsx:180-213 MuklogCard 재현 (plan §5 B1 / §6.2, AC9).
//   커버(FoodCover: 카테고리 그라데이션+이모지, aspectRatio 16/10) + 카테고리 칩 오버레이
//   → 본문(장소명+별점, 위치줄, 메모 2줄). 킷 MuklogCard 에는 작성자 줄이 없다(S5b §4.4 — 작성자 표시는 상세로 이관).
//   OUT(plan §44): 좌표/미니맵.
//
// 소비: useMuklogs → Muklog. 작성자 라벨/아바타는 카드에서 제거(멤버 실명 매핑은 MuklogDetail 소관, plan §3.3).
//   meId 는 리스트 배선 계약 유지를 위해 props 로 받되 카드는 소비하지 않는다(작성자 줄 제거).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FadeInImage, FoodCover, Icon, IconName, MotionPressable, Stars, Text } from '@/components';
import { useTheme } from '@/theme';

import { categoryLabel } from '../categories';
import { formatVisitedDate } from '../formatVisitedDate';
import { type Muklog } from '../types';

export type MuklogCardProps = {
  /** 표시할 먹로그 1건. */
  muklog: Muklog;
  /** 현재 사용자 uid — 카드는 미소비(작성자 줄 제거). MuklogDetail 작성자 매핑용으로 리스트 배선 계약만 유지. */
  meId: string;
  /** 카드 탭 콜백(상세 진입 배선, plan §4.3). 없으면 카드는 비활성(기존 사용처 안전). */
  onPress?: () => void;
};

// 킷 FC2 커버 이모지 56.
const COVER_EMOJI_SIZE = 56;

// 부여 판정: 공용 Card lg/0.7 승계(motion-press-c §2 C8)
const CARD_PRESSED_OPACITY = 0.7;

export const MuklogCard = ({ muklog, onPress }: MuklogCardProps) => {
  const theme = useTheme();

  const chipLabel = categoryLabel({ key: muklog.category });
  const hasChip = muklog.category !== null && chipLabel.length > 0;

  const dateText = formatVisitedDate({ visitedAt: muklog.visitedAt });
  const locationText = muklog.area ? `${muklog.area} · ${dateText}` : dateText;

  // 커버 오버레이 — 킷 mk-log.jsx:91-97. 카테고리 칩(좌상)·사진 장수 배지(우상).
  //   썸네일(Image)·FoodCover 어느 쪽에도 동일하게 얹는다(인라인 중복 방지).
  const coverOverlays = (
    <>
      {hasChip ? (
        <View
          testID="muklog-card-chip"
          style={[
            styles.chip,
            {
              // RN 근사: 킷 rgba(255,255,255,.82)+blur 글래스 → 불투명 surface(blur 미지원). ui-spec 기록.
              backgroundColor: theme.color.surface,
              borderRadius: theme.radius.full,
              top: theme.spacing[12],
              left: theme.spacing[12],
              paddingVertical: theme.spacing[6],
              paddingHorizontal: theme.spacing[10],
            },
          ]}
        >
          <Text variant="badge" color="fgWeak" style={styles.chipText}>
            {chipLabel}
          </Text>
        </View>
      ) : null}

      {muklog.photoCount > 0 ? (
        <View
          testID="muklog-card-photo-badge"
          style={[
            styles.photoBadge,
            {
              // RN 근사: 킷 rgba(0,0,0,.32)+blur 글래스 → scrimStrong 반투명 검정(blur 미지원). ui-spec 기록.
              backgroundColor: theme.color.scrimStrong,
              borderRadius: theme.radius.full,
              top: theme.spacing[12],
              right: theme.spacing[12],
              paddingVertical: theme.spacing[6],
              paddingHorizontal: theme.spacing[8],
            },
          ]}
        >
          <Icon name={IconName.Camera} size={13} color="primaryFg" />
          <Text variant="badge" color="primaryFg" style={styles.photoBadgeText}>
            {muklog.photoCount}
          </Text>
        </View>
      ) : null}
    </>
  );

  // 카드 골격(비주얼 불변) — onPress 유무에 따라 래퍼만 Pressable/View로 교체(킷 레이아웃 유지).
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.color.surface, borderRadius: theme.radius.card },
    theme.shadow.card,
  ];
  const cardBody = (
    <>
      {/* 커버 — coverUri(대표 사진 signed URL) 있으면 Image, 없으면 FoodCover 폴백(plan §6.2 ⑥).
          카드가 overflow:hidden이라 커버 radius=0. 칩·사진 배지는 어느 쪽이든 동일하게 오버레이. */}
      {muklog.coverUri ? (
        <View style={styles.cover}>
          {/* motion-pass-1 D2: 로드되면 페이드로 자리를 잡는다(FadeInImage는 Image 드롭인 — props 불변). */}
          <FadeInImage
            testID="muklog-card-cover-image"
            accessibilityLabel={`${muklog.placeName} 대표 사진`}
            source={{ uri: muklog.coverUri }}
            resizeMode="cover"
            style={styles.coverImage}
          />
          {coverOverlays}
        </View>
      ) : (
        <FoodCover category={muklog.category} radius={0} emojiSize={COVER_EMOJI_SIZE} style={styles.cover}>
          {coverOverlays}
        </FoodCover>
      )}

      {/* 본문 — 킷 padding 15 ≈ spacing 16. */}
      <View style={{ padding: theme.spacing[16] }}>
        <View style={styles.titleRow}>
          <Text variant="cardTitle" color="fg" style={styles.title} numberOfLines={1}>
            {muklog.placeName}
          </Text>
          <Stars value={muklog.rating} size={14} />
        </View>

        <View style={[styles.locationRow, { marginTop: theme.spacing[7] }]}>
          <Icon name={IconName.Location} size={14} color="primary" />
          <Text variant="meta" color="fgWeak">
            {locationText}
          </Text>
        </View>

        {muklog.memo ? (
          <Text
            testID="muklog-card-memo"
            variant="bodySm"
            color="fgWeak"
            numberOfLines={2}
            style={{ marginTop: theme.spacing[8] }}
          >
            {muklog.memo}
          </Text>
        ) : null}
      </View>
    </>
  );

  // onPress가 있으면 Pressable로 감싸 상세 진입(접근성 라벨 = "장소명 상세 보기"). 없으면 비활성 View(기존 사용처 안전).
  if (onPress) {
    return (
      <MotionPressable
        testID="muklog-card"
        accessibilityRole="button"
        accessibilityLabel={`${muklog.placeName} 상세 보기`}
        onPress={onPress}
        pressSize="lg"
        pressedOpacity={CARD_PRESSED_OPACITY}
        style={cardStyle}
      >
        {cardBody}
      </MotionPressable>
    );
  }

  return (
    <View testID="muklog-card" style={cardStyle}>
      {cardBody}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 10 },
  // 대표 사진 커버 — FoodCover와 동일 비율. resizeMode cover로 16/10 프레임 채움.
  coverImage: { width: '100%', height: '100%' },
  chip: { position: 'absolute' },
  // 이모지 세로 클리핑 방지 — badge fontSize 12에 lineHeight 16 헤드룸.
  chipText: { lineHeight: 16 },
  // 사진수 배지 — 킷 mk-log:94-97. 우상단, 카메라 아이콘 + 숫자(흰), gap 4.
  photoBadge: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoBadgeText: { lineHeight: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
