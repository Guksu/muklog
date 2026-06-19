// src/navigation/screens/LogListScreen.tsx
// 먹로그 탭(탭1) — 내가 속한 로그 카드 목록 (plan §4.5 + ui-redesign 충실화: mk-home LogCard/EmptyLogs 재현).
//   loading → 스피너 / error → 메시지+다시 시도(refresh) / ready+[] → 빈 상태(EmptyLogs) / ready+logs → 카드 리스트 + 하단 CTA.
//
// 카드 골격(mk-home LogCard 재현, 데이터 없는 부분은 정직한 플레이스홀더):
//   상단 = 아바타(본인 userId 디폴트; 커플이면 익명 아바타 겹침) + 이름("{닉}의 기록"/"{닉} ♥ 짝꿍") + MemberBadge + 날짜("YYYY.MM.DD 시작") + chevron
//   중간 = 미리보기 사진 4슬롯(사진/집계 데이터 없음 → 빈 점선 슬롯, 가짜 이모지 미사용)
//   하단 = location 아이콘 + count-free 중립 카피("맛집을 기록해보세요" — 거짓 카운트 단언 금지, QA Q9)
//   탭 → LogScreen({roomId}) 유지.
// 하단 CTA: 2px dashed 보더 "새 로그 시작하기"(PlusHeaderButton과 동일 — createRoom→refresh, 로딩 중 비활성).
//
// 생산자(소비): useMyLogsContext(state/refresh) + useCreateRoom(생성) + useProfile(닉/아바타) + useNavigation.
// ⚠️ 파트너 실데이터/사진/맛집 수는 백엔드 미존재 → UI 골격만 재현(플레이스홀더). 추가 페치/RPC 변경 없음(UI-only).
import React from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';

import { Avatar, Button, Card, Icon, IconName, MemberBadge, Screen, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import {
  displayLogName,
  mapRoomError,
  useCreateRoom,
  useLogPreviewUrls,
  useMyLogsContext,
  type MyLog,
} from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';
import { formatLogDate } from './formatLogDate';

const CARD_AVATAR_SIZE = 42;

// 본인 닉네임/아바타. userId가 있을 때만 useProfile을 마운트해야 하므로 상위에서 분기.
//   userId도 함께 노출 → Avatar가 url 없을 때 결정적 디폴트(이모지+컬러)를 파생(plan §3.3).
const useSelfDisplay = ({ userId }: { userId: string }) => {
  const { state } = useProfile({ userId });
  const profile = state.status === 'ready' ? state.profile : null;
  return {
    userId,
    nickname: profile?.nickname && profile.nickname.length > 0 ? profile.nickname : '나',
    avatarUrl: profile?.avatarUrl ?? null,
  };
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
  // 대표 사진 1장(첫 사진) signed URL. 없으면 카드에 이미지 미노출(사용자 결정).
  const coverPath = log.previewPaths[0];
  const coverUri = coverPath ? previewUrls[coverPath] : undefined;
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
            {/* log-name: 이름 있으면 name, 없으면 본인 닉 기반 폴백(displayLogName, 결정2 B'). */}
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
        {/* 킷 mk-home:57 chevron 18 / text-assistive(fgAssistive). */}
        <Icon name={IconName.ChevronRight} size={18} color="fgAssistive" />
      </View>

      {/* 중간: 대표 사진 1장(커버) — signed URL 있을 때만 노출. 사진 없으면 미렌더(빈 슬롯 없음, 사용자 결정). */}
      {coverUri ? (
        <Image
          testID="log-preview-thumb"
          source={{ uri: coverUri }}
          resizeMode="cover"
          style={[styles.previewCover, { borderRadius: theme.radius.control, marginTop: theme.spacing[14] }]}
        />
      ) : null}

      {/* 하단: 위치핀 + count-free 중립 카피(맛집 집계 미보유 → 카운트 단언 금지, QA Q9/plan §B4). */}
      <View style={[styles.cardFooter, { gap: theme.spacing[6], marginTop: theme.spacing[12] }]}>
        <Icon name={IconName.Location} size={15} color="primary" />
        <Text variant="spotCount" color="fgWeak">
          맛집을 기록해보세요
        </Text>
      </View>
    </Card>
  );
};

// 로그 리스트 헤더(서브카피) + 하단 CTA를 위한 분리된 빈 상태.
const EmptyLogs = ({ onCreate, creating }: { onCreate: () => void; creating: boolean }) => {
  const theme = useTheme();
  return (
    <Screen center>
      {/* 킷 빈상태 이모지 64px(plan B4). */}
      <Text style={[styles.emptyEmoji, { marginBottom: theme.spacing[8] }]}>🍜</Text>
      <Text variant="emptyTitle" color="fg" style={styles.center}>
        아직 로그가 없어요
      </Text>
      <Text
        variant="body"
        color="fgWeak"
        style={[styles.center, { marginTop: theme.spacing[8], marginBottom: theme.spacing[24] }]}
      >
        {'로그를 만들고 초대코드로 연인을 초대해\n함께 다닌 맛집을 기록해보세요.'}
      </Text>
      <Button title="로그 만들기" loading={creating} onPress={onCreate} />
    </Screen>
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

  // 생성 핸들러 — PlusHeaderButton과 동일(createRoom→refresh, 실패 시 Alert). 빈상태/하단 CTA 공용.
  const handleCreate = async () => {
    try {
      await createRoom();
      await refresh();
    } catch (err) {
      Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err }));
    }
  };

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

  // ready & 빈 목록 = 빈 상태(정상, 에러 아님). mk-home EmptyLogs 재현(이모지 허용).
  if (state.logs.length === 0) {
    return <EmptyLogs onCreate={() => void handleCreate()} creating={creating} />;
  }

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.listScreen}>
      <FlatList
        data={state.logs}
        keyExtractor={(item) => item.roomId}
        contentContainerStyle={{
          // 킷 mk-home:87 리스트 패딩 4 / 20 / 24(비대칭).
          gap: theme.spacing[16],
          paddingTop: theme.spacing[4],
          paddingHorizontal: theme.spacing[20],
          paddingBottom: theme.spacing[24],
        }}
        ListHeaderComponent={
          <Text variant="sectionCaption" color="fgMuted" style={{ marginBottom: theme.spacing[4] }}>
            둘만의 맛집 지도를 함께 채워가요.
          </Text>
        }
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

// 하단 "새 로그 시작하기" CTA — 2px dashed accentLine 보더 + accentStrong plus·라벨(mk.addRow 재현).
//   카드 섀도우는 끄고(점선 CTA는 투명 표면) accentLine 보더만 노출.
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

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  emptyEmoji: { fontSize: 64, lineHeight: 72, textAlign: 'center' },
  listScreen: { padding: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  cardHeaderBody: { flex: 1, minWidth: 0 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  // 대표 커버 사진 — 처음 설계(4슬롯 행)의 슬롯 1칸 크기 유지(약 1/4 폭 정사각). 풀폭 배너 아님(카드 크기 보존).
  //   width 23% ≈ (100% - gap 3칸)/4. aspectRatio 1 → 원래 슬롯과 동일 높이. 사진 없으면 미렌더.
  previewCover: { width: '23%', aspectRatio: 1, overflow: 'hidden' },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
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
