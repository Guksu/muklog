// src/navigation/screens/LogListScreen.tsx
// 먹로그 탭(탭1) — 내가 속한 로그 카드 목록. 킷 mk-home.jsx LogListScreen/LogCard/EmptyLogs 충실 재현(home-fidelity).
//   loading → 스피너 / error → 메시지+다시 시도(refresh) / ready+[] → 빈 상태(EmptyLogs 히어로+두 갈래) / ready+logs → 인사 헤드라인 + 카드 + 하단 CTA.
//
// LogCard 골격(킷 mk-home:28-104):
//   헤더(40-60) = 아바타 겹침(본인 + 커플이면 익명 짝꿍) + 이름(displayLogName) + MemberBadge + "YYYY.MM.DD 시작" + chevron.
//   본문 분기:
//     spotCount===0 → 빈카드(63-71): 🍽️ 배지 + "아직 기록한 맛집이 없어요"/"이 로그를 열어 첫 맛집을 남겨보세요" + plus, 점선 박스.
//     spotCount>0   → 사진 4칸 스트립(74-91, LogPhotoStrip) + 통계행(92-99): location아이콘 "맛집 N곳" / "마지막 기록 {상대시간}".
//   사진 스트립은 previewPaths의 signed URL 썸네일(부족분 점선 빈 슬롯으로 항상 4칸). more=spotCount-4>0이면 4번째 슬롯 +N 딤.
//
// 인사 헤드라인(116-122) = "{닉}님, 오늘은\n어디 다녀왔어요?" + "지금까지 함께 {Σ spotCount}곳을 기록했어요"(합계 accentStrong 강조).
//
// 생산자(소비): useMyLogsContext(state/refresh) + useCreateRoom(생성) + useProfileContext(공유 닉/아바타·#2) + useNavigation.
//   ⚠️ 실데이터: spotCount/lastMuklogAt/previewPaths는 MyLog(developer 소유, useMyLogs.ts)에서 직접 읽는다. 추가 페치 0(UI-only).
import React from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, Button, Card, Icon, IconName, MemberBadge, Screen, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { defaultNickname, useProfileContext } from '@/features/profile';
import {
  displayLogName,
  mapRoomError,
  useCreateRoom,
  useLogPreviewUrls,
  useMyLogsContext,
  type MyLog,
} from '@/features/room';
import { heroGradient, useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';
import { formatLogDate } from './formatLogDate';
import { relativeTimeLabel } from './relativeTimeLabel';

const CARD_AVATAR_SIZE = 42;
// 사진 스트립 칸 수(킷 mk-home:31 slice(0,4) / 88 4칸 채움). +N 임계도 이 값 기준(more=spotCount-PHOTO_STRIP_SLOTS).
const PHOTO_STRIP_SLOTS = 4;
// 빈 상태 히어로 박스 높이(킷 mk-home:151 height:172).
const HERO_HEIGHT = 172;
// 킷 mk-home:152 linear-gradient(150deg) ≈ 좌상→우하 대각(살구가 우하단으로). expo-linear-gradient 근사.
const HERO_GRADIENT_START = { x: 0, y: 0 } as const;
const HERO_GRADIENT_END = { x: 1, y: 1 } as const;

// 본인 닉네임/아바타. 공유 context에서 읽어 다른 화면(ProfileScreen) 변경이 즉시 전파되게 한다(#2).
//   userId도 함께 노출 → Avatar가 url 없을 때 결정적 디폴트(이모지+컬러)를 파생(plan §3.3).
//   닉네임 미설정 시 결정적 기본 닉네임(동물명+숫자)으로 폴백(#3, 화면 간 동일 신원).
const useSelfDisplay = ({ userId }: { userId: string }) => {
  const { state } = useProfileContext();
  const profile = state.status === 'ready' ? state.profile : null;
  return {
    userId,
    nickname:
      profile?.nickname && profile.nickname.length > 0
        ? profile.nickname
        : defaultNickname({ userId }),
    avatarUrl: profile?.avatarUrl ?? null,
  };
};

// 사진 4칸 스트립(킷 mk-home:74-91). previewPaths 순서대로 signed URL 썸네일, 부족분 점선 빈 슬롯으로 항상 4칸.
//   more = spotCount-4>0이면 4번째 슬롯에 rgba 딤 + "+{more}"(킷 77-83). 4번째가 사진이면 그 위 오버레이, 빈 슬롯이면 딤 박스.
const LogPhotoStrip = ({
  previewPaths,
  previewUrls,
  spotCount,
}: {
  previewPaths: string[];
  previewUrls: Record<string, string>;
  spotCount: number;
}) => {
  const theme = useTheme();
  const more = Math.max(0, spotCount - PHOTO_STRIP_SLOTS);
  // 발급된 signed URL만 채움 후보(미발급 path는 점선 빈 슬롯으로 강등 — 깨진 이미지 방지).
  const uris = previewPaths
    .map((path) => previewUrls[path])
    .filter((uri): uri is string => Boolean(uri))
    .slice(0, PHOTO_STRIP_SLOTS);

  return (
    <View testID="log-strip" style={[styles.strip, { marginTop: theme.spacing[14] }]}>
      {Array.from({ length: PHOTO_STRIP_SLOTS }).map((_, index) => {
        const uri = uris[index];
        const isLast = index === PHOTO_STRIP_SLOTS - 1;
        const showMore = isLast && more > 0;
        // 슬롯 키 — 채워진 칸은 uri, 빈 칸은 위치 기반(stable).
        const slotKey = uri ?? `empty-${index}`;
        const slotStyle = { borderRadius: theme.radius.control };

        if (uri) {
          return (
            <View key={slotKey} testID="log-strip-thumb" style={[styles.slot, slotStyle]}>
              <Image source={{ uri }} resizeMode="cover" style={styles.slotImage} />
              {showMore ? <MoreOverlay more={more} /> : null}
            </View>
          );
        }
        return (
          <View
            key={slotKey}
            testID="log-strip-empty"
            style={[
              styles.slot,
              slotStyle,
              { backgroundColor: theme.color.fillAlt, borderColor: theme.color.hairline },
              styles.slotEmpty,
            ]}
          >
            {showMore ? <MoreOverlay more={more} /> : null}
          </View>
        );
      })}
    </View>
  );
};

// +N 딤 오버레이(킷 mk-home:81-83) — rgba(20,12,8,.46) 위 흰색 800/17 "+{more}". scrimStrong 토큰 재사용.
const MoreOverlay = ({ more }: { more: number }) => {
  const theme = useTheme();
  return (
    <View style={[styles.moreOverlay, { backgroundColor: theme.color.scrimStrong }]}>
      <Text variant="cardTitle" color="primaryFg" style={styles.moreText}>
        {`+${more}`}
      </Text>
    </View>
  );
};

// 빈카드(킷 mk-home:63-71) — spotCount===0. 점선 박스(fillAlt + accentLine dashed) + 🍽️ 배지 + 안내 + plus.
const LogEmptyBody = () => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.emptyBody,
        {
          marginTop: theme.spacing[14],
          borderRadius: theme.radius.xl,
          backgroundColor: theme.color.fillAlt,
          borderColor: theme.color.accentLine,
        },
      ]}
    >
      <View style={[styles.emptyBadge, { borderRadius: theme.radius.lg, backgroundColor: theme.color.primaryWeak }]}>
        <Text style={styles.emptyBadgeEmoji}>🍽️</Text>
      </View>
      <View style={styles.emptyBodyText}>
        <Text variant="cardTitle" color="fg">
          아직 기록한 맛집이 없어요
        </Text>
        <Text variant="meta" color="fgMuted" style={{ marginTop: theme.spacing[2] }}>
          이 로그를 열어 첫 맛집을 남겨보세요
        </Text>
      </View>
      <Icon name={IconName.Plus} size={18} color="accentStrong" />
    </View>
  );
};

// 통계행(킷 mk-home:92-99) — 상단 헤어라인 + 좌 location "맛집 N곳" / 우 "마지막 기록 {상대시간}"(null이면 "기록 없음").
const LogStatsRow = ({ spotCount, lastMuklogAt }: { spotCount: number; lastMuklogAt: string | null }) => {
  const theme = useTheme();
  const ago = relativeTimeLabel({ iso: lastMuklogAt });
  return (
    <View
      style={[
        styles.statsRow,
        {
          marginTop: theme.spacing[14],
          paddingTop: theme.spacing[14],
          borderTopColor: theme.color.hairlineAlt,
        },
      ]}
    >
      <View style={styles.statsLeft}>
        <Icon name={IconName.Location} size={15} color="primary" />
        <Text variant="spotCount" color="fg">
          {`맛집 ${spotCount}곳`}
        </Text>
      </View>
      <Text variant="meta" color="fgMuted">
        {ago.length > 0 ? `마지막 기록 ${ago}` : '기록 없음'}
      </Text>
    </View>
  );
};

const LogCard = ({
  log,
  self,
  onPress,
  previewUrls,
}: {
  log: MyLog;
  self: { userId: string; nickname: string; avatarUrl: string | null };
  onPress: () => void;
  previewUrls: Record<string, string>;
}) => {
  const theme = useTheme();
  const isCouple = log.memberCount >= 2;
  const isEmpty = log.spotCount === 0;
  return (
    <Card accessibilityLabel="로그 열기" onPress={onPress}>
      {/* 상단: 아바타 + 이름/배지/날짜 + chevron */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarStack}>
          <Avatar
            url={self.avatarUrl}
            userId={self.userId}
            nickname={self.nickname}
            size={CARD_AVATAR_SIZE}
          />
          {isCouple ? (
            // 짝꿍 실데이터 미존재 → 익명 아바타(🙂)를 겹쳐 커플 골격만 재현(plan §3.3 익명 파트너).
            <View style={{ marginLeft: -theme.spacing[12] }}>
              <Avatar url={null} userId={null} nickname={null} size={CARD_AVATAR_SIZE} />
            </View>
          ) : null}
        </View>
        <View style={styles.cardHeaderBody}>
          <Text variant="cardTitle" color="fg" numberOfLines={1}>
            {displayLogName({
              name: log.name,
              memberCount: log.memberCount,
              selfNickname: self.nickname,
            })}
          </Text>
          <View style={[styles.cardMeta, { gap: theme.spacing[8], marginTop: theme.spacing[4] }]}>
            <MemberBadge memberCount={log.memberCount} />
            <Text variant="meta" color="fgMuted">
              {`${formatLogDate({ iso: log.createdAt })} 시작`}
            </Text>
          </View>
        </View>
        {/* 킷 mk-home:59 chevron 18 / text-assistive(fgAssistive). */}
        <Icon name={IconName.ChevronRight} size={18} color="fgAssistive" />
      </View>

      {/* 본문 분기: 맛집 0개 → 빈카드 / 1개 이상 → 사진 스트립 + 통계행. */}
      {isEmpty ? (
        <LogEmptyBody />
      ) : (
        <React.Fragment>
          <LogPhotoStrip previewPaths={log.previewPaths} previewUrls={previewUrls} spotCount={log.spotCount} />
          <LogStatsRow spotCount={log.spotCount} lastMuklogAt={log.lastMuklogAt} />
        </React.Fragment>
      )}
    </Card>
  );
};

// 인사 헤드라인(킷 mk-home:116-122) — "{닉}님, 오늘은\n어디 다녀왔어요?" + 합계(accentStrong 강조).
const GreetingHeader = ({ nickname, totalSpots }: { nickname: string; totalSpots: number }) => {
  const theme = useTheme();
  return (
    <View style={[styles.greeting, { marginTop: theme.spacing[6] }]}>
      <Text variant="emptyTitle" color="fg">
        {`${nickname}님, 오늘은\n어디 다녀왔어요?`}
      </Text>
      <Text variant="sectionCaption" color="fgMuted" style={{ marginTop: theme.spacing[8] }}>
        지금까지 함께{' '}
        <Text variant="sectionCaption" color="accentStrong">
          {`${totalSpots}곳`}
        </Text>
        을 기록했어요
      </Text>
    </View>
  );
};

// 빈 상태 두 갈래 시작 카드(킷 SheetAction mk-home:203-218) — 이모지 배지 + 제목/설명 + chevron.
const StartActionCard = ({
  emoji,
  title,
  desc,
  onPress,
  loading,
}: {
  emoji: string;
  title: string;
  desc: string;
  onPress: () => void;
  loading?: boolean;
}) => {
  const theme = useTheme();
  return (
    <Card
      accessibilityLabel={title}
      onPress={loading ? undefined : onPress}
      style={{
        ...styles.startCard,
        borderRadius: theme.radius.action,
        borderColor: theme.color.hairline,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <View style={[styles.startEmoji, { borderRadius: theme.radius.control, backgroundColor: theme.color.primaryWeak }]}>
        <Text style={styles.startEmojiText}>{emoji}</Text>
      </View>
      <View style={styles.startBody}>
        <Text variant="sheetTitle" color="fg">
          {title}
        </Text>
        <Text variant="meta" color="fgMuted" style={{ marginTop: theme.spacing[2] }}>
          {desc}
        </Text>
      </View>
      <Icon name={IconName.ChevronRight} size={18} color="fgAssistive" />
    </Card>
  );
};

// 빈 상태(킷 mk-home:136-181) — 인사 + 히어로 비주얼(그라데이션 + 아바타+💕+🙂 + 음식 핀 4) + 두 갈래 카드.
const EmptyLogs = ({
  self,
  onCreate,
  onJoin,
  creating,
}: {
  self: { userId: string; nickname: string; avatarUrl: string | null };
  onCreate: () => void;
  onJoin: () => void;
  creating: boolean;
}) => {
  const theme = useTheme();
  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.emptyScreen}>
      <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
        {/* 인사 */}
        <View style={styles.greeting}>
          <Text variant="emptyTitle" color="fg">
            {`${self.nickname}님,\n먹로그를 시작해볼까요?`}
          </Text>
          <Text variant="sectionCaption" color="fgMuted" style={{ marginTop: theme.spacing[10] }}>
            {'둘이 다녀온 맛집을 사진·메모·위치로\n함께 기록하는 우리만의 지도예요.'}
          </Text>
        </View>

        {/* 히어로 비주얼 — 그라데이션 박스 + 음식 이모지 핀 4 + 아바타+💕+🙂. */}
        <LinearGradient
          testID="empty-hero"
          colors={heroGradient}
          start={HERO_GRADIENT_START}
          end={HERO_GRADIENT_END}
          style={[styles.hero, { marginTop: theme.spacing[20], borderRadius: theme.radius.card }]}
        >
          <HeroPill emoji="🍝" position={styles.pillTopLeft} />
          <HeroPill emoji="☕" position={styles.pillTopRight} />
          <HeroPill emoji="🍣" position={styles.pillBottomLeft} />
          <HeroPill emoji="🍰" position={styles.pillBottomRight} />
          <View style={styles.heroCenter}>
            <Avatar url={self.avatarUrl} userId={self.userId} nickname={self.nickname} size={62} />
            <View style={[styles.heroHeart, { backgroundColor: theme.color.surface }]}>
              <Text style={styles.heroHeartText}>💕</Text>
            </View>
            <View style={styles.heroPartner}>
              <Text style={styles.heroPartnerText}>🙂</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 두 갈래 시작 카드 */}
        <View style={[styles.startCards, { marginTop: theme.spacing[18] }]}>
          <StartActionCard
            emoji="🥢"
            title="새 로그 만들기"
            desc="먼저 시작하고 연인을 초대해요"
            onPress={onCreate}
            loading={creating}
          />
          <StartActionCard
            emoji="💌"
            title="초대코드로 입장"
            desc="연인이 보낸 6자리 코드가 있어요"
            onPress={onJoin}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

// 히어로 음식 이모지 핀(킷 mk-home:182-190) — 흰 원형 칩 + 그림자.
const HeroPill = ({ emoji, position }: { emoji: string; position: ViewStyleAtom }) => {
  const theme = useTheme();
  return (
    <View style={[styles.heroPill, { backgroundColor: theme.color.surface }, theme.shadow.seg, position]}>
      <Text style={styles.heroPillText}>{emoji}</Text>
    </View>
  );
};

export const LogListScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { state, refresh } = useMyLogsContext();
  const { createRoom, loading: creating } = useCreateRoom();
  const { state: authState } = useAuth();
  // 인증 트리에서만 렌더되므로 authenticated가 정상. 비인증 시 안전한 폴백 표시.
  const userId = authState.status === 'authenticated' ? authState.userId : '';
  const self = useSelfDisplay({ userId });

  // 화면 재포커스 시 목록 재조회 — 로그 삭제/나가기 후 돌아오면 사라진 로그가 즉시 빠지도록(room-lifecycle 정합).
  //   useFocusEffect 콜백 참조 안정성 필수 → ref + 빈 deps useCallback(컨벤션 허용 예외, LogScreen 선례).
  //   첫 포커스 = 마운트 시 Provider 초기 로드와 겹치므로 가드(중복 조회 회피). 이후 재진입에서만 refresh.
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  const hasFocusedRef = React.useRef(false);
  const handleFocus = React.useCallback(function refreshMyLogsOnRefocus() {
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      return;
    }
    void refreshRef.current();
  }, []);
  useFocusEffect(handleFocus);

  // 카드 썸네일용 — 모든 로그의 preview_paths를 모아 signed URL 1회 배치 발급(path→URL 맵). 폴링 없음.
  //   ⚠️ 훅이라 조건부 return 이전에 호출(state 미준비면 빈 배열). 발급은 경로 집합 변경 시에만.
  const previewPaths = state.status === 'ready' ? state.logs.flatMap((item) => item.previewPaths) : [];
  const { urls: previewUrls } = useLogPreviewUrls({ paths: previewPaths });

  // 생성 핸들러 — createRoom→refresh, 실패 시 Alert. 빈상태/하단 CTA 공용.
  const handleCreate = async () => {
    try {
      await createRoom();
      await refresh();
    } catch (err) {
      Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err }));
    }
  };

  // 초대코드 입장(킷 EmptyLogs onJoin) — JoinLog 풀스크린 라우트로 이동.
  const handleJoin = () => navigation.navigate(Routes.JoinLog);

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator testID="loglist-loading" color={theme.color.primary} />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen center>
        <Text variant="body" color="error" style={styles.center}>
          {state.message}
        </Text>
        <Button
          title="다시 시도"
          variant="secondary"
          onPress={() => void refresh()}
          style={{ marginTop: theme.spacing[16] }}
        />
      </Screen>
    );
  }

  // ready & 빈 목록 = 빈 상태(정상, 에러 아님). 킷 EmptyLogs 재현(히어로 + 두 갈래).
  if (state.logs.length === 0) {
    return (
      <EmptyLogs
        self={self}
        onCreate={() => void handleCreate()}
        onJoin={handleJoin}
        creating={creating}
      />
    );
  }

  // 전 로그 spotCount 합 — 인사 헤드라인 합계 강조(킷 mk-home:121).
  const totalSpots = state.logs.reduce((sum, item) => sum + item.spotCount, 0);

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.listScreen}>
      <FlatList
        data={state.logs}
        keyExtractor={(item) => item.roomId}
        contentContainerStyle={{
          // 킷 mk-home:115 리스트 패딩 4 / 20 / 24(비대칭).
          gap: theme.spacing[16],
          paddingTop: theme.spacing[4],
          paddingHorizontal: theme.spacing[20],
          paddingBottom: theme.spacing[24],
        }}
        ListHeaderComponent={<GreetingHeader nickname={self.nickname} totalSpots={totalSpots} />}
        renderItem={({ item }) => (
          <LogCard
            log={item}
            self={self}
            previewUrls={previewUrls}
            onPress={() => navigation.navigate(Routes.LogScreen, { roomId: item.roomId })}
          />
        )}
        ListFooterComponent={
          <CreateLogCta onPress={() => void handleCreate()} disabled={creating} />
        }
      />
    </Screen>
  );
};

// 하단 "새 로그 시작하기" CTA — 2px dashed accentLine 보더 + accentStrong plus·라벨(킷 mk.addRow:450-452).
const CreateLogCta = ({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => {
  const theme = useTheme();
  return (
    <Card
      accessibilityLabel="새 로그 시작하기"
      onPress={disabled ? undefined : onPress}
      style={{
        ...styles.cta,
        borderColor: theme.color.accentLine,
        borderRadius: theme.radius.card,
        gap: theme.spacing[8],
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={IconName.Plus} size={20} color="accentStrong" />
      <Text variant="button" color="accentStrong">
        새 로그 시작하기
      </Text>
    </Card>
  );
};

// HeroPill position prop 타입 — StyleSheet 절대배치 atom(top/left/right/bottom만).
type ViewStyleAtom = { top?: number; left?: number; right?: number; bottom?: number };

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  listScreen: { padding: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  cardHeaderBody: { flex: 1, minWidth: 0 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },

  // 사진 스트립(킷 mk-home:75 gap:7) — 4칸 flex:1 aspectRatio:1.
  strip: { flexDirection: 'row', gap: 7 },
  slot: { flex: 1, aspectRatio: 1, overflow: 'hidden' },
  slotImage: { width: '100%', height: '100%' },
  // 빈 슬롯(킷 mk-home:89) — fillAlt 배경 + 1px dashed hairline.
  slotEmpty: { borderWidth: 1, borderStyle: 'dashed' },
  // +N 오버레이(킷 mk-home:81-83) — 슬롯 전체 덮는 딤 + 중앙 흰 텍스트.
  moreOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  moreText: { lineHeight: undefined },

  // 빈카드(킷 mk-home:64-71) — 점선 박스, 14/16 패딩, 아이콘 배지 + 텍스트 + plus.
  emptyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyBadgeEmoji: { fontSize: 20, lineHeight: 24, textAlign: 'center' },
  emptyBodyText: { flex: 1, minWidth: 0 },

  // 통계행(킷 mk-home:93) — 상단 헤어라인, 좌우 정렬.
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // 인사 헤드라인(킷 mk-home:116/140 — margin 2px 좌우는 화면 패딩으로 대체).
  greeting: { marginHorizontal: 2 },

  // 빈 상태 스크롤(킷 mk-home:138 padding 10/20/28).
  emptyScreen: { padding: 0 },
  emptyScroll: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 28 },

  // 히어로 박스(킷 mk-home:150-172).
  hero: { height: HERO_HEIGHT, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroCenter: { flexDirection: 'row', alignItems: 'center' },
  // 💕 칩(킷 mk-home:162-166) — 두 아바타 사이 겹침, 흰 원형 + 그림자.
  heroHeart: {
    width: 30,
    height: 30,
    borderRadius: 999,
    marginHorizontal: -8,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroHeartText: { fontSize: 22, lineHeight: 26, textAlign: 'center' },
  // 익명 짝꿍 자리(킷 mk-home:167-170) — 반투명 흰 원 + inset ring + 🙂.
  heroPartner: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 2,
    borderColor: 'rgba(120,90,70,0.12)',
  },
  heroPartnerText: { fontSize: 30, lineHeight: 34, textAlign: 'center' },
  // 음식 핀(킷 mk-home:182-190) — 36 원형 흰 칩.
  heroPill: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  heroPillText: { fontSize: 19, lineHeight: 23, textAlign: 'center' },
  pillTopLeft: { top: 22, left: 24 },
  pillTopRight: { top: 30, right: 28 },
  pillBottomLeft: { bottom: 24, left: 34 },
  pillBottomRight: { bottom: 30, right: 30 },

  // 두 갈래 시작 카드(킷 SheetAction mk-home:203-218).
  startCards: { gap: 10 },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    // 시작 카드는 헤어라인 보더 surface — 카드 기본 웜 섀도우 끄고 보더만(킷 SheetAction은 1px line·그림자 없음).
    shadowOpacity: 0,
    elevation: 0,
  },
  startEmoji: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  startEmojiText: { fontSize: 24, lineHeight: 28, textAlign: 'center' },
  startBody: { flex: 1, minWidth: 0 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    // 점선 CTA는 표면 그림자 없음 → Card 기본 웜 섀도우 무력화.
    shadowOpacity: 0,
    elevation: 0,
  },
});
