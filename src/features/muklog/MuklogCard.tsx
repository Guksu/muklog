// src/features/muklog/MuklogCard.tsx
// 맛집 카드 — 킷 mk-log.jsx:80-118 MuklogCard 재현 (plan §5 B1 / §6.2, AC9·AC10).
//   커버(FoodCover: 카테고리 그라데이션+이모지, aspectRatio 16/10) + 카테고리 칩 오버레이
//   → 본문(장소명+별점, 위치줄, 메모 2줄, 작성자 행: 22px Avatar(createdBy 디폴트)+라벨).
//   OUT(plan §44): 사진수 배지(데이터 없음)·좌표/미니맵·카드 탭 navigate(onPress 미연결).
//
// 소비: useMuklogs → Muklog. meId(현 사용자 uid)로 "내가 기록 / 짝꿍이 기록" 파생(파트너 프로필 OUT).
//   작성자 아바타는 Avatar userId={createdBy} → defaultAvatar 결정적 익명(파트너도 안정적 이모지).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, FoodCover, Icon, IconName, Stars, Text } from '@/components';
import { useTheme } from '@/theme';

import { categoryEmoji, categoryLabel } from './categories';
import { formatVisitedDate } from './formatVisitedDate';
import { type Muklog } from './types';

export type MuklogCardProps = {
  /** 표시할 먹로그 1건. */
  muklog: Muklog;
  /** 현재 사용자 uid — 작성자 라벨("내가 기록"/"짝꿍이 기록") 파생용. */
  meId: string;
};

// 킷 FC2 커버 이모지 56, 작성자 아바타 22(ring 없음).
const COVER_EMOJI_SIZE = 56;
const AUTHOR_AVATAR_SIZE = 22;

export const MuklogCard = ({ muklog, meId }: MuklogCardProps) => {
  const theme = useTheme();

  const chipEmoji = categoryEmoji({ key: muklog.category });
  const chipLabel = categoryLabel({ key: muklog.category });
  const hasChip = muklog.category !== null && chipLabel.length > 0;

  const dateText = formatVisitedDate({ visitedAt: muklog.visitedAt });
  const locationText = muklog.area ? `${muklog.area} · ${dateText}` : dateText;

  const authorLabel = muklog.createdBy === meId ? '내가 기록' : '짝꿍이 기록';

  return (
    <View
      testID="muklog-card"
      style={[
        styles.card,
        { backgroundColor: theme.color.surface, borderRadius: theme.radius.card },
        theme.shadow.card,
      ]}
    >
      {/* 커버 — FoodCover(카테고리 그라데이션+이모지). 카드가 overflow:hidden이라 커버 radius=0. */}
      <FoodCover category={muklog.category} radius={0} emojiSize={COVER_EMOJI_SIZE} style={styles.cover}>
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
                // 킷 padding 5×10. RN 이모지 lineHeight 헤드룸(아래 chipText)을 담도록 세로 6.
                paddingVertical: theme.spacing[6],
                paddingHorizontal: theme.spacing[10],
              },
            ]}
          >
            {/* 칩은 이모지+라벨을 한 Text로 유지(킷 mk-log:90-91 단일 span). badge 토큰은 ratio 1이라
                lineHeight==fontSize(12) → 이모지 글리프가 세로로 잘린다. lineHeight 16 헤드룸으로 방지. */}
            <Text variant="badge" color="fgWeak" style={styles.chipText}>
              {chipEmoji} {chipLabel}
            </Text>
          </View>
        ) : null}
      </FoodCover>

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

        {/* 작성자 행 — 22px 디폴트 아바타(createdBy 파생) + 라벨. 킷 gap 6, marginTop 11. */}
        <View style={[styles.authorRow, { marginTop: theme.spacing[12] }]}>
          <Avatar userId={muklog.createdBy} size={AUTHOR_AVATAR_SIZE} ring={false} />
          <Text variant="meta" color="fgMuted">
            {authorLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 10 },
  chip: { position: 'absolute' },
  // 이모지 세로 클리핑 방지 — badge fontSize 12에 lineHeight 16 헤드룸.
  chipText: { lineHeight: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
