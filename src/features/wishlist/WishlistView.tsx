// src/features/wishlist/WishlistView.tsx
// 위시리스트 본문(로그 내부 'wish' 세그먼트) — 킷 mk-extra.jsx:178-224 재현 (wishlist 스프린트, plan §5).
//   빈 상태(📍 + 안내문 + soft CTA, 179-189) / 비었지 않으면 상단 점선 추가 버튼(193-196) + 항목 카드 리스트(200-219).
//   ── 프리젠테이셔널: items(조회 결과)·핸들러를 props로 받는다. 조회·삭제·prefill 배선은 developer(컨테이너) 소유.
//   addedByMe(파생)·meNickname·meAvatarUrl을 props로 받아 라벨/아바타만 조립(데이터 계산 없음).
//   "짝꿍" 익명 라벨은 킷 정합 표시 카피(파트너 실프로필 RLS 비노출 — MuklogCard "짝꿍이 기록"과 동일 선례).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { Avatar, Button, FoodCover, Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

import { type WishlistItem } from './types';

export type WishlistViewProps = {
  /** 조회된 위시 항목(이미 ready). loading/error는 컨테이너(developer)가 처리. */
  items: WishlistItem[];
  /** 내 닉네임 — addedByMe=true 항목의 "{닉}님이 추가" 라벨용(계산 아님, props 수신). */
  meNickname: string;
  /** 내 아바타 URL(addedByMe일 때 이미지). 없으면 addedBy uuid 결정적 이모지 폴백. */
  meAvatarUrl?: string | null;
  /** "추가" 진입(빈 상태 CTA / 상단 점선 버튼) — PlaceSearchView 풀스크린 스왑 배선은 developer. */
  onAdd: () => void;
  /** "다녀왔어요" — MuklogEditor prefill 진입 배선은 developer. */
  onVisit: ({ id }: { id: string }) => void;
  /** 항목 삭제(✕) — removeWishlist 배선은 developer. */
  onRemove: ({ id }: { id: string }) => void;
};

// 킷 실값(컨트롤 내부 수치): FoodCover 56 · radius 14 · emoji 26 · 카드 padding 14 · 커버↔본문 gap 13.
const COVER_SIZE = 56;
const COVER_RADIUS = 14;
const COVER_EMOJI = 26;
// 파트너 익명 표시 라벨(킷 정합 카피, RLS 제약).
const PARTNER_LABEL = '짝꿍';

export const WishlistView = ({
  items,
  meNickname,
  meAvatarUrl,
  onAdd,
  onVisit,
  onRemove,
}: WishlistViewProps) => {
  const theme = useTheme();

  // 빈 상태 — 킷 mk-extra:179-189. 📍 + 제목 + 안내문(2줄) + soft 추가 버튼.
  if (items.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text
          variant="sheetTitle"
          color="fg"
          style={[styles.centerText, { marginTop: theme.spacing[8], marginBottom: theme.spacing[6] }]}
        >
          가보고 싶은 곳을 모아요
        </Text>
        <Text
          variant="bodySm"
          color="fgMuted"
          style={[styles.centerText, { marginBottom: theme.spacing[20] }]}
        >
          다음 데이트에 가고 싶은 맛집을{'\n'}위시리스트에 담아두세요.
        </Text>
        <Button
          title="위시리스트에 추가"
          accessibilityLabel="위시리스트에 추가"
          variant="soft"
          leftIcon={IconName.Plus}
          onPress={onAdd}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listContainer}>
      {/* 상단 점선 추가 버튼 — 킷 ex.addWish(231): 2px dashed accent-line, radius 16, plus + accent-strong. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="가보고 싶은 곳 추가"
        onPress={onAdd}
        style={[styles.addWish, { borderColor: theme.color.accentLine, borderRadius: theme.radius.xl }]}
      >
        <Icon name={IconName.Plus} size={19} color="accentStrong" />
        <Text variant="cardTitle" color="accentStrong" style={styles.addWishText}>
          가보고 싶은 곳 추가
        </Text>
      </Pressable>

      <View style={{ gap: theme.spacing[12], marginTop: theme.spacing[14] }}>
        {items.map((wish) => {
          const authorName = wish.addedByMe ? meNickname : PARTNER_LABEL;
          const cardStyle: ViewStyle = {
            backgroundColor: theme.color.surface,
            borderRadius: theme.radius.card,
            padding: theme.spacing[14],
          };
          return (
            <View
              key={wish.id}
              testID={`wish-card-${wish.id}`}
              style={[styles.card, cardStyle, theme.shadow.card]}
            >
              <FoodCover
                category={wish.category}
                size={COVER_SIZE}
                radius={COVER_RADIUS}
                emojiSize={COVER_EMOJI}
                style={styles.cover}
              />
              <View style={styles.body}>
                {/* 장소명 + 동네 — 킷 204-207. place 700/15.5, area 500/12. */}
                <View style={styles.titleRow}>
                  <Text
                    variant="cardTitle"
                    color="fg"
                    numberOfLines={1}
                    style={styles.place}
                  >
                    {wish.placeName}
                  </Text>
                  {wish.area ? (
                    <Text variant="caption" color="fgMuted" numberOfLines={1}>
                      {wish.area}
                    </Text>
                  ) : null}
                </View>

                {/* 메모 — 킷 208. 값 있을 때만 2줄 clamp(500/12.5). */}
                {wish.note ? (
                  <Text
                    testID={`wish-note-${wish.id}`}
                    variant="caption"
                    color="fgWeak"
                    numberOfLines={2}
                    style={styles.note}
                  >
                    {wish.note}
                  </Text>
                ) : null}

                {/* 작성자 행 + 액션 — 킷 209-216. 아바타18 + "{닉}님이 추가" + 다녀왔어요 + ✕. */}
                <View style={styles.authorRow}>
                  <Avatar
                    url={wish.addedByMe ? meAvatarUrl : null}
                    userId={wish.addedBy}
                    size={18}
                    ring={false}
                  />
                  <Text variant="caption" color="fgMuted" numberOfLines={1} style={styles.authorLabel}>
                    {authorName}님이 추가
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${wish.placeName} 다녀왔어요`}
                    onPress={() => onVisit({ id: wish.id })}
                    style={[
                      styles.visitBtn,
                      { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.full },
                    ]}
                  >
                    <Text variant="cardTitle" color="accentStrong" style={styles.visitText}>
                      다녀왔어요
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${wish.placeName} 삭제`}
                    onPress={() => onRemove({ id: wish.id })}
                    style={styles.removeBtn}
                  >
                    <Icon name={IconName.Close} size={15} color="fgAssistive" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // 빈 상태 — 킷 mk-extra:181 padding "48px 32px", 가로 가운데(textAlign center). 세로는 상단 흐름(킷·MuklogList 선례 동일, 뷰포트 센터링 없음).
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  // 큰 이모지(📍 56) 세로 클리핑 방지 — lineHeight 헤드룸(56→64), marginBottom 6(킷 182).
  emptyEmoji: { fontSize: 56, lineHeight: 64, textAlign: 'center', marginBottom: 6, textAlignVertical: 'center' },
  centerText: { textAlign: 'center' },
  // 리스트 — 킷 padding "4px 20px 24px".
  listContainer: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 24 },
  // 상단 점선 추가 버튼 — 킷 ex.addWish(231): 2px dashed, padding 13, gap 7, 가운데 정렬.
  addWish: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  // 700/14(킷 195) — cardTitle(Bold) 패밀리에 크기/라인 오버라이드.
  addWishText: { fontSize: 14, lineHeight: 14 },
  // 항목 카드 — 커버↔본문 가로 배치, gap 13(킷 201), overflow hidden(커버 radius 클립).
  card: { flexDirection: 'row', gap: 13, overflow: 'hidden' },
  cover: { flexShrink: 0 },
  body: { flex: 1 },
  // place + area 인라인, gap 7(킷 204), 세로 중앙.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // place 700/15.5(킷 205) — cardTitle(17) 크기 오버라이드. 길면 줄임표(area 보존 위해 flexShrink).
  place: { fontSize: 15.5, lineHeight: 20, flexShrink: 1 },
  // note 500/12.5(킷 208) — caption(12) 크기/라인 오버라이드. marginTop 5(킷 "5px 0 0", odd값 raw).
  note: { fontSize: 12.5, lineHeight: 19, marginTop: 5 },
  // 작성자 행 — 킷 209 marginTop 9(odd값 raw), gap 8.
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  // "{닉}님이 추가" 500/11.5(킷 211) — caption 크기 오버라이드. flex로 액션 버튼을 우측 정렬.
  authorLabel: { flex: 1, fontSize: 11.5 },
  // 다녀왔어요 pill — 킷 ex.visitBtn(232): padding 7×13, radius full.
  visitBtn: { paddingVertical: 7, paddingHorizontal: 13 },
  // 700/12.5(킷 232) — cardTitle 크기 오버라이드.
  visitText: { fontSize: 12.5, lineHeight: 13 },
  removeBtn: { padding: 4 },
});
