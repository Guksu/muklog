// src/navigation/screens/MuklogDetailScreen.tsx
// 먹로그 상세(읽기 전용) — 킷 mk-log.jsx:122-192 MuklogDetail 재현 (plan §5.1·§6③⑤).
//   순수 표시 컴포넌트: 데이터/상태/콜백을 props로 받는다(데이터 조회 useMuklog·navigation 배선은 developer).
//   구조(킷 라인): 사진 캐러셀(131-155) + 상단 글래스 바 back(140-146, share/more는 OUT 미렌더) +
//     본문(157-192): 카테고리 칩(159) · 장소 타이틀(162) · 별점+평점(163-166) ·
//     메타 InfoRow 위치/방문일(169-172) · 메모 카드+작성자(175-183) · 위치 미니맵 stub(186-191).
//   디자인 단일 출처 = 킷. RN 미재현(글래스 blur·실지도)은 근사 — ui-spec.md 기록.
//   스타일은 토큰만(raw hex 0). OUT(plan §2): share·more·메뉴시트·수정/삭제·실지도.
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, FoodCover, Icon, IconButton, IconName, Sheet, Stars, Text } from '@/components';
import { categoryEmoji, categoryLabel } from '@/features/muklog/categories';
import { formatVisitedDate } from '@/features/muklog/formatVisitedDate';
import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

// ── props 계약 (developer가 useMuklog/useProfile/navigation을 매핑해 주입) ─────────────
/** 캐러셀 사진 1장 — plan §3.3 MuklogDetailPhoto. uri = signed URL. */
export type MuklogDetailPhoto = { orderIndex: number; uri: string };

/** 화면이 표시하는 먹로그 데이터(plan §3.3 MuklogDetail의 표시 부분). developer가 useMuklog 결과를 매핑. */
export type MuklogDetailViewData = {
  id: string;
  placeName: string;
  category: string | null; // CAT key(8종) | null → null이면 칩 미표시
  area: string | null;
  memo: string | null; // null/빈문자 → "메모가 없어요"
  rating: number | null; // 1~5, null → "미평가"
  visitedAt: string | null; // 'YYYY-MM-DD'
  roadAddress: string | null; // null → "위치 정보 없음"(현재 항상 null, muklog-place 전)
  hasCoords: boolean; // false → 미니맵 stub(현재 항상 false)
  createdBy: string; // uuid → meId 비교로 작성자 라벨/아바타 파생
  photos: MuklogDetailPhoto[]; // order_index 오름차순. [] → FoodCover 폴백 1칸
};

/** 화면 상태(plan §3.3 MuklogDetailState). developer가 useMuklog state를 그대로 전달. */
export type MuklogDetailState =
  | { status: 'loading' }
  | { status: 'ready'; muklog: MuklogDetailViewData }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export type MuklogDetailScreenProps = {
  /** 표시 상태/데이터(developer가 useMuklog로 채움). */
  state: MuklogDetailState;
  /** 현재 사용자 uid — 작성자 라벨("내가 기록"/"짝꿍이 기록") 파생용(plan §3.4). */
  meId: string;
  /** 본인 프로필 아바타 URL(useProfile). 작성자가 나일 때 사용, 없으면 결정적 아바타. */
  meAvatarUrl: string | null;
  /** 뒤로가기 콜백(developer: navigation.goBack). */
  onBack: () => void;
  /** error 상태 "다시 시도" 콜백(developer: useMuklog refresh). */
  onRetry: () => void;
  // ── more 메뉴 / 편집·삭제 (muklog-edit, 킷 mk-log:144·195-217) ─────────────────────
  /** 작성자(createdBy===meId)일 때만 more 글래스 버튼 노출(plan §5 ⑤ a). false면 미렌더(짝꿍 것). */
  canManage?: boolean;
  /** 메뉴 "편집" 탭 — developer가 MuklogEntrySheet(initial) open을 연결(plan §4.2). */
  onEdit?: () => void;
  /** 삭제 확인 시트 "삭제하기" 탭 — developer가 useDeleteMuklog 실행을 연결(plan §3.6/§4.2). */
  onConfirmDelete?: () => void;
  /** 삭제 진행 중(useDeleteMuklog.loading) — 확인 시트 버튼 비활성/로딩. */
  deleting?: boolean;
  /** 삭제 실패 메시지(useDeleteMuklog.error) — 확인 시트 인라인(재시도 가능). */
  deleteError?: string | null;
};

// 킷 실측치 — 사진 정사각(aspectRatio 1/1, mk-log:136), 글래스 back, 작성자 아바타 26(mk-log:179).
const PHOTO_ASPECT = 1; // 1/1
const FALLBACK_EMOJI_SIZE = 92; // mk-log:136 emojiSize 92
const AUTHOR_AVATAR_SIZE = 26;
const STARS_SIZE = 18; // mk-log:164
const INFO_ICON_SIZE = 18; // mk-log:239

// ── 메타 정보 한 줄 (킷 InfoRow mk-log:236-243) ─────────────────────────────────────
//   location/calendar 아이콘(primary) + 라벨(48px 고정, fgMuted) + 값(우정렬, fg). last면 하단 보더 없음.
const InfoRow = ({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        {
          gap: theme.spacing[12],
          paddingVertical: theme.spacing[12],
          paddingHorizontal: theme.spacing[14],
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.color.hairlineAlt,
        },
      ]}
    >
      <Icon name={icon} size={INFO_ICON_SIZE} color="primary" />
      <Text variant="badge" color="fgMuted" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="meta" color="fg" style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
};

// ── 상태 뷰: loading / notFound / error (plan §5.2) ────────────────────────────────
const StatusCenter = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={[styles.statusCenter, { backgroundColor: theme.color.bg, padding: theme.spacing[24] }]}>
      {children}
    </View>
  );
};

export const MuklogDetailScreen = ({
  state,
  meId,
  meAvatarUrl,
  onBack,
  onRetry,
  canManage = false,
  onEdit,
  onConfirmDelete,
  deleting = false,
  deleteError = null,
}: MuklogDetailScreenProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 캐러셀 현재 페이지 — onScroll로 갱신(킷 mk-log:134 setIdx(round(scrollLeft/clientWidth))).
  const [pageIndex, setPageIndex] = React.useState(0);
  // more 메뉴 / 삭제 확인 시트 열림 상태(킷 mk-log:124-125 menuOpen/confirmOpen).
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (state.status === 'loading') {
    return (
      <StatusCenter>
        <ActivityIndicator testID="muklog-detail-loading" color={theme.color.primary} />
      </StatusCenter>
    );
  }

  if (state.status === 'notFound') {
    return (
      <StatusCenter>
        <View testID="muklog-detail-notfound" style={styles.statusBody}>
          <RNText style={styles.statusEmoji}>🔍</RNText>
          <Text variant="emptyTitle" color="fg" style={styles.statusText}>
            먹로그를 찾을 수 없어요
          </Text>
          <Text variant="bodySm" color="fgMuted" style={styles.statusText}>
            삭제되었거나 접근 권한이 없어요.
          </Text>
          <Button
            title="뒤로 가기"
            accessibilityLabel="뒤로 가기"
            variant="secondary"
            onPress={onBack}
            style={{ marginTop: theme.spacing[16] }}
          />
        </View>
      </StatusCenter>
    );
  }

  if (state.status === 'error') {
    return (
      <StatusCenter>
        <View style={styles.statusBody}>
          <Text variant="body" color="error" style={styles.statusText}>
            {state.message}
          </Text>
          <Button
            title="다시 시도"
            accessibilityLabel="다시 시도"
            variant="secondary"
            onPress={onRetry}
            style={{ marginTop: theme.spacing[16] }}
          />
        </View>
      </StatusCenter>
    );
  }

  const { muklog } = state;
  const hasPhotos = muklog.photos.length > 0;
  const showIndicator = muklog.photos.length > 1;

  const chipEmoji = categoryEmoji({ key: muklog.category });
  const chipLabel = categoryLabel({ key: muklog.category });
  const hasChip = muklog.category !== null && chipLabel.length > 0;

  const hasRating = muklog.rating !== null;
  const ratingText = hasRating ? muklog.rating!.toFixed(1) : '미평가';

  const hasMemo = muklog.memo !== null && muklog.memo.trim().length > 0;
  const memoText = hasMemo ? muklog.memo! : '메모가 없어요';

  const hasRoad = muklog.roadAddress !== null && muklog.roadAddress.trim().length > 0;
  const locationText = hasRoad ? muklog.roadAddress! : '위치 정보 없음';
  const dateText = formatVisitedDate({ visitedAt: muklog.visitedAt });

  const authorIsMe = muklog.createdBy === meId;
  const authorLabel = authorIsMe ? '내가 기록' : '짝꿍이 기록';

  // 캐러셀 스냅 인덱스 갱신(킷 mk-log:134). 외부(RN) 콜백 → named-args 예외.
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== pageIndex) setPageIndex(next);
  };

  // 본문 카드(surface + radius.action(18) + shadow.card) — 킷 mk-log:169/176 borderRadius 18.
  const card: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.action,
    ...theme.shadow.card,
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.color.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing[28] }}
        showsVerticalScrollIndicator={false}
      >
        {/* 사진 캐러셀 — 킷 mk-log:131-155. 가로 스냅 페이징. 0장이면 FoodCover 폴백 1칸. */}
        <View style={styles.carouselWrap}>
          {hasPhotos ? (
            <ScrollView
              testID="muklog-detail-carousel"
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {muklog.photos.map((p) => (
                <Image
                  key={`${p.orderIndex}-${p.uri}`}
                  testID="muklog-detail-photo"
                  accessibilityLabel={`${muklog.placeName} 사진 ${p.orderIndex + 1}`}
                  source={{ uri: p.uri }}
                  resizeMode="cover"
                  style={{ width, aspectRatio: PHOTO_ASPECT }}
                />
              ))}
            </ScrollView>
          ) : (
            <FoodCover
              testID="muklog-detail-cover-fallback"
              category={muklog.category}
              radius={0}
              emojiSize={FALLBACK_EMOJI_SIZE}
              style={{ width, aspectRatio: PHOTO_ASPECT }}
            />
          )}

          {/* 상단 글래스 바 — 킷 mk-log:140-146. back(좌) + more(우, 작성자만). share는 OUT 미렌더. */}
          <View
            style={[
              styles.glassBar,
              { top: insets.top + theme.spacing[8], left: theme.spacing[12], right: theme.spacing[12] },
            ]}
          >
            <GlassBtn name={IconName.ChevronLeft} accessibilityLabel="뒤로 가기" onPress={onBack} />
            {/* more 글래스 버튼 — 작성자(canManage)일 때만(plan §5 ⑤ a). 짝꿍 것은 미렌더. */}
            {canManage ? (
              <View testID="muklog-detail-more" style={[styles.glassRight, { gap: theme.spacing[8] }]}>
                <GlassBtn
                  name={IconName.MoreHorizontal}
                  accessibilityLabel="더보기"
                  onPress={() => setMenuOpen(true)}
                />
              </View>
            ) : null}
          </View>

          {/* 페이지 인디케이터 — 킷 mk-log:148-154. 사진 >1장일 때만, 현재 인덱스 dot 강조(18px). */}
          {showIndicator ? (
            <View testID="muklog-detail-indicator" style={[styles.indicator, { gap: theme.spacing[6] }]}>
              {muklog.photos.map((p, i) => (
                <View
                  key={p.orderIndex}
                  style={{
                    width: i === pageIndex ? 18 : 6,
                    height: 6,
                    borderRadius: theme.radius.full,
                    // 활성=흰색(primaryFg), 비활성=반투명 흰(scrimStrong 대비 사진 위 가독). 사진 위 고정 흰색.
                    backgroundColor: i === pageIndex ? theme.color.primaryFg : theme.color.scrimStrong,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* 본문 — 킷 mk-log:157-192. 사진과 -18 겹쳐 상단 라운드 22(킷 marginTop:-18, radius 22 22 0 0). */}
        <View
          style={[
            styles.body,
            {
              backgroundColor: theme.color.bg,
              borderTopLeftRadius: theme.radius.card,
              borderTopRightRadius: theme.radius.card,
              marginTop: -theme.spacing[18],
              paddingTop: theme.spacing[18],
              paddingHorizontal: theme.spacing[20],
              paddingBottom: theme.spacing[28],
            },
          ]}
        >
          {/* 카테고리 칩 — 킷 mk-log:159(accent-weak 배경 + accent-strong 글자). null이면 미표시. */}
          {hasChip ? (
            <View
              testID="muklog-detail-category-chip"
              style={[
                styles.categoryChip,
                {
                  backgroundColor: theme.color.primaryWeak,
                  borderRadius: theme.radius.full,
                  paddingVertical: theme.spacing[6],
                  paddingHorizontal: theme.spacing[12],
                  gap: theme.spacing[4],
                },
              ]}
            >
              <Text variant="badge" color="accentStrong" style={styles.chipText}>
                {chipEmoji} {chipLabel}
              </Text>
            </View>
          ) : null}

          {/* 장소 타이틀 — 킷 mk-log:162(800/25). emptyTitle(800/21)보다 큰 전용 크기 = h2(24) 근사. */}
          <Text
            variant="h2"
            color="fg"
            style={[styles.placeTitle, { marginTop: hasChip ? theme.spacing[12] : 0 }]}
          >
            {muklog.placeName}
          </Text>

          {/* 별점 + 평점 — 킷 mk-log:163-166. rating null이면 "미평가". */}
          <View style={[styles.ratingRow, { gap: theme.spacing[8] }]}>
            <Stars value={muklog.rating} size={STARS_SIZE} />
            <Text variant="ratingNum" color={hasRating ? 'fg' : 'fgMuted'} style={styles.ratingText}>
              {ratingText}
            </Text>
          </View>

          {/* 메타 InfoRow(위치/방문일) — 킷 mk-log:169-172. 카드(radius 18)에 두 줄. */}
          <View style={[card, styles.infoCard, { marginVertical: theme.spacing[18] }]}>
            <InfoRow icon={IconName.Location} label="위치" value={locationText} />
            <InfoRow icon={IconName.Calendar} label="방문일" value={dateText} last />
          </View>

          {/* 메모 — 킷 mk-log:175-183. 섹션 제목 + 카드(본문 + 작성자 행). */}
          <Text variant="sectionLabel" color="fg" style={[styles.sectionTitle, { marginBottom: theme.spacing[10] }]}>
            메모
          </Text>
          <View style={[card, { padding: theme.spacing[16] }]}>
            <Text variant="memoBody" color={hasMemo ? 'fgWeak' : 'fgMuted'} style={styles.memoText}>
              {memoText}
            </Text>
            {/* 작성자 행 — 킷 mk-log:178-182. 상단 헤어라인 + 26px 아바타 + 라벨 + 방문일. */}
            <View
              style={[
                styles.authorRow,
                {
                  gap: theme.spacing[7],
                  marginTop: theme.spacing[14],
                  paddingTop: theme.spacing[14],
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.color.hairlineAlt,
                },
              ]}
            >
              <Avatar
                url={authorIsMe ? meAvatarUrl : null}
                userId={muklog.createdBy}
                size={AUTHOR_AVATAR_SIZE}
                ring={false}
              />
              <Text variant="meta" color="fgWeak">
                {authorLabel}
              </Text>
              <Text variant="meta" color="fgMuted">
                · {dateText}
              </Text>
            </View>
          </View>

          {/* 위치(미니맵) — 킷 mk-log:186-191. 좌표 없음(hasCoords=false) → stub 플레이스홀더(실지도 OUT). */}
          <Text variant="sectionLabel" color="fg" style={[styles.sectionTitle, { marginTop: theme.spacing[24], marginBottom: theme.spacing[10] }]}>
            위치
          </Text>
          <View
            testID="muklog-detail-map-stub"
            style={[
              styles.mapStub,
              card,
              { backgroundColor: theme.color.surfaceAlt, gap: theme.spacing[6] },
            ]}
          >
            <Icon name={IconName.Location} size={26} color="fgAssistive" />
            <Text variant="bodySm" color="fgMuted">
              위치 정보가 아직 없어요
            </Text>
          </View>
          {/* 도로명 한 줄 — 킷 mk-log:188-191. */}
          <View style={[styles.roadRow, { gap: theme.spacing[6], marginTop: theme.spacing[10] }]}>
            <Icon name={IconName.Location} size={15} color="fgMuted" />
            <Text variant="bodySm" color="fgWeak" style={styles.roadText}>
              {locationText}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ··· 메뉴 시트 — 킷 mk-log:195-202. 편집 / 삭제(danger). 작성자만 진입(canManage). */}
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.menuList}>
          <MenuRow
            icon={IconName.Setting}
            label="편집"
            accessibilityLabel="편집"
            onPress={() => {
              setMenuOpen(false);
              onEdit?.();
            }}
          />
          <View
            style={[styles.menuDivider, { backgroundColor: theme.color.hairlineAlt, marginVertical: theme.spacing[4] }]}
          />
          <MenuRow
            icon={IconName.Trash}
            label="삭제"
            accessibilityLabel="삭제"
            danger
            onPress={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          />
        </View>
      </Sheet>

      {/* 삭제 확인 시트 — 킷 mk-log:204-217. 카피·negative(삭제하기)/ghost(취소). 실제 삭제는 onConfirmDelete. */}
      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="먹로그를 삭제할까요?">
        <Text variant="bodySm" color="fgMuted" style={[styles.confirmBody, { marginBottom: theme.spacing[18] }]}>
          {state.status === 'ready' ? `‘${state.muklog.placeName}’ ` : ''}기록과 사진이 함께 사라져요.{'\n'}이 작업은 되돌릴 수 없어요.
        </Text>
        {deleteError ? (
          <Text variant="bodySm" color="error" style={[styles.confirmBody, { marginBottom: theme.spacing[12] }]}>
            {deleteError}
          </Text>
        ) : null}
        <View style={{ gap: theme.spacing[10] }}>
          {/* 삭제하기 — 킷 status-negative 버튼(negative 토큰). 확인 시트는 닫지 않음(developer가 성공 시 goBack). */}
          <Pressable
            testID="muklog-delete-confirm"
            accessibilityRole="button"
            accessibilityLabel="삭제하기"
            accessibilityState={{ disabled: deleting, busy: deleting }}
            disabled={deleting}
            onPress={onConfirmDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: theme.color.negative,
                borderRadius: theme.radius.control,
                paddingVertical: theme.spacing[14],
                opacity: deleting ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={theme.color.negativeFg} />
            ) : (
              <Text variant="button" color="negativeFg">
                삭제하기
              </Text>
            )}
          </Pressable>
          <Button
            title="취소"
            accessibilityLabel="취소"
            variant="ghost"
            full
            disabled={deleting}
            onPress={() => setConfirmOpen(false)}
          />
        </View>
      </Sheet>
    </View>
  );
};

// ── 액션시트 메뉴 한 줄 (킷 MenuRow mk-log:223-234) ─────────────────────────────────
//   아이콘(21) + 라벨(600/16). danger면 negative 토큰(편집=fg / 삭제=negative).
const MenuRow = ({
  icon,
  label,
  accessibilityLabel,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  danger?: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const tint: ColorToken = danger ? 'negative' : 'fg';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        { gap: theme.spacing[14], paddingVertical: theme.spacing[14], paddingHorizontal: theme.spacing[8], opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} size={21} color={tint} />
      <Text variant="body" color={tint}>
        {label}
      </Text>
    </Pressable>
  );
};

// ── 상단 글래스 버튼 (킷 GlassBtn mk-log:245-255) ───────────────────────────────────
//   RN 근사: 킷 rgba(0,0,0,.32)+backdrop-blur(10px) → scrimStrong 반투명 검정(blur 미지원). ui-spec 기록.
const GlassBtn = ({
  name,
  accessibilityLabel,
  onPress,
}: {
  name: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}) => {
  const theme = useTheme();
  // IconButton(40×40 원형)에 scrimStrong 배경 + 흰 아이콘으로 글래스 근사. 흰 아이콘 = primaryFg 토큰.
  const iconColor: ColorToken = 'primaryFg';
  return (
    <View style={[styles.glassBtn, { backgroundColor: theme.color.scrimStrong, borderRadius: theme.radius.full }]}>
      <IconButton
        name={name}
        size={20}
        color={iconColor}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  statusCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBody: { alignItems: 'center' },
  statusEmoji: { fontSize: 56, lineHeight: 64, marginBottom: 4 },
  statusText: { textAlign: 'center' },
  // 캐러셀 영역(상대 위치 — 글래스바·인디케이터 오버레이의 기준).
  carouselWrap: { position: 'relative' },
  glassBar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  glassRight: { flexDirection: 'row', alignItems: 'center' },
  // 글래스 버튼은 IconButton 자체가 40×40 — 배경 원형만 입힌다.
  glassBtn: { overflow: 'hidden' },
  indicator: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { position: 'relative' },
  categoryChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  // 이모지 세로 클리핑 방지(badge fontSize 12 → lineHeight 16 헤드룸).
  chipText: { lineHeight: 16 },
  placeTitle: { marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { includeFontPadding: false },
  // 메타 카드 — 킷 padding 4(내부 InfoRow가 자체 패딩).
  infoCard: { padding: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { width: 48 },
  infoValue: { flex: 1, textAlign: 'right' },
  sectionTitle: {},
  // 메모 줄간격 — 킷 mk-log:177 500/15/1.7. variant=memoBody(15, lineHeight 26)로 토큰에서 처리(별도 스타일 불요).
  memoText: {},
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  // 미니맵 stub — 킷 MiniMap height 150, radius 18(card.action). 실지도 OUT → 중앙 플레이스홀더.
  mapStub: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roadRow: { flexDirection: 'row', alignItems: 'center' },
  roadText: { flex: 1 },
  // more 메뉴 시트(킷 mk-log:197 gap 4) + 구분 헤어라인(킷 mk-log:199 height 1).
  menuList: { gap: 4 },
  menuDivider: { height: StyleSheet.hairlineWidth },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  // 삭제 확인 본문(킷 mk-log:206 가운데 정렬) + 삭제하기 버튼(킷 mk-log:210-214).
  confirmBody: { textAlign: 'center' },
  deleteBtn: { alignItems: 'center', justifyContent: 'center' },
});
