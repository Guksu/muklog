// src/features/muklog/MuklogCard.tsx
// 맛집 카드 — mk-log.jsx MuklogCard(81–118) 재현, 이번 슬라이스 데이터로 축약 (plan §6.2 / §5 T8, AC9·AC10).
//   커버(카테고리 이모지 + 웜 배경 = FoodCover 대체) + 카테고리 칩 → 본문(장소명 + 별점, 위치줄, 메모 2줄, 작성자 라벨).
//   OUT: 사진 카운트 배지(D5)·좌표/미니맵·카드 탭 navigate(D6, onPress 미연결). 스타일은 토큰만(raw hex 0), 이모지 허용.
//
// 소비: useMuklogs → Muklog. meId(현 사용자 uid)로 "내가 기록 / 짝꿍이 기록" 파생(D3, 파트너 프로필 OUT).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconName, Stars, Text } from '@/components';
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

const COVER_EMOJI_SIZE = 48;

export const MuklogCard = ({ muklog, meId }: MuklogCardProps) => {
  const theme = useTheme();

  const chipEmoji = categoryEmoji({ key: muklog.category });
  const chipLabel = categoryLabel({ key: muklog.category });
  const hasChip = muklog.category !== null && chipLabel.length > 0;
  const coverEmoji = chipEmoji.length > 0 ? chipEmoji : '🍽️';

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
      {/* 커버 — 카테고리 이모지 + 웜 배경(primaryWeak). 사진은 차기(muklog-editor). */}
      <View style={[styles.cover, { backgroundColor: theme.color.primaryWeak }]}>
        <Text style={{ fontSize: COVER_EMOJI_SIZE }}>{coverEmoji}</Text>
        {hasChip ? (
          <View
            testID="muklog-card-chip"
            style={[
              styles.chip,
              {
                backgroundColor: theme.color.surface,
                borderRadius: theme.radius.full,
                top: theme.spacing[12],
                left: theme.spacing[12],
                paddingVertical: theme.spacing[4],
                paddingHorizontal: theme.spacing[10],
              },
            ]}
          >
            <Text variant="badge" color="fgWeak">
              {chipEmoji} {chipLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 본문 */}
      <View style={{ padding: theme.spacing[16] }}>
        <View style={styles.titleRow}>
          <Text variant="cardTitle" color="fg" style={styles.title} numberOfLines={1}>
            {muklog.placeName}
          </Text>
          <Stars value={muklog.rating} size={14} />
        </View>

        <View style={[styles.locationRow, { marginTop: theme.spacing[8] }]}>
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

        <View style={[styles.authorRow, { marginTop: theme.spacing[12] }]}>
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
  cover: { width: '100%', aspectRatio: 16 / 7, alignItems: 'center', justifyContent: 'center' },
  chip: { position: 'absolute' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
