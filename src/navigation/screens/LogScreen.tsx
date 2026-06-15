// src/navigation/screens/LogScreen.tsx
// 로그 진입 화면 — 킷 mk-log.jsx:9-77 LogScreen 재현 (plan §5 B2 / §6.1).
//   상단 헤더: 본인(+커플이면 익명 파트너) 아바타 겹침 + 로그명("{닉}의 기록"/"{닉} ♥ 짝꿍"). 멤버 배지 없음(킷 헤더 정합).
//   초대 영역: 솔로=InviteCodeCard 강조 / 커플=컴팩트 1줄(link + "초대코드 XXXXXX" + 복사). (기존 "둘이 함께 기록 중" 교체)
//   하단: MuklogList(맛집 리스트 + 카테고리 필터 칩 + "우리 맛집 N" 섹션 + FAB) — 칩/필터/섹션 배선은 developer(MuklogList).
//
// 생산자(소비): useRoom(get_room)→RoomDetail / useProfile(본인 닉/아바타) / useAuth(meId). 스타일=토큰만(raw hex 0).
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import {
  Avatar,
  Button,
  Icon,
  IconButton,
  IconName,
  InviteCodeCard,
  Screen,
  Text,
} from '@/components';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import {
  displayLogName,
  LogNameSheet,
  LogTitleButton,
  useRenameRoom,
  useRoom,
} from '@/features/room';
import { MuklogList } from '@/features/muklog';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

const HEADER_AVATAR_SIZE = 28;
const COPIED_FEEDBACK_MS = 2000;

// 커플 컴팩트 초대코드 행 — link 아이콘 + "초대코드 XXXXXX" + 복사(클립보드).
const CompactInviteRow = ({ code }: { code: string }) => {
  const theme = useTheme();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(
    function clearCompactCopied() {
      if (!copied) return;
      const reset = () => setCopied(false);
      const id = setTimeout(reset, COPIED_FEEDBACK_MS);
      return function stopCompactTimer() {
        clearTimeout(id);
      };
    },
    [copied],
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  return (
    <View style={[styles.compactRow, { gap: theme.spacing[8] }]}>
      <Icon name={IconName.Link} size={15} color="fgMuted" />
      <Text variant="meta" color="fgMuted" style={styles.compactCode}>
        {`초대코드 ${code}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="초대코드 복사"
        onPress={() => void handleCopy()}
        hitSlop={8}
      >
        <Text variant="badge" color="accentStrong">
          {copied ? '복사됨' : '복사'}
        </Text>
      </Pressable>
    </View>
  );
};

// 솔로(미커플) 초대 배너 — 킷 mk-log:33-45. accent-weak(primaryWeak) 배경 카드 안에
//   💌 + 헤딩("연인을 초대해보세요") + 설명문 + InviteCodeCard(코드+복사). 이모지는 별도 RNText(클리핑 방지).
const SoloInviteBanner = ({ code }: { code: string }) => {
  const theme = useTheme();
  const banner: ViewStyle = {
    backgroundColor: theme.color.primaryWeak,
    borderRadius: theme.radius.sheet,
    padding: theme.spacing[16],
    gap: theme.spacing[12],
  };
  return (
    <View style={banner}>
      <View style={[styles.bannerHead, { gap: theme.spacing[8] }]}>
        <RNText style={styles.bannerEmoji}>💌</RNText>
        <Text variant="fieldLabel" color="fg" style={styles.bannerHeading}>
          연인을 초대해보세요
        </Text>
      </View>
      <Text variant="bodySm" color="fgWeak">
        이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요.
      </Text>
      <InviteCodeCard code={code} compact />
    </View>
  );
};

export const LogScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.LogScreen>>();
  const roomId = route.params?.roomId;
  const { state: authState } = useAuth();
  // 작성자 라벨 파생용 uid. 미인증이어도 빈 문자열로 안전(이 화면은 AuthGate authenticated 하에만 진입).
  const meId = authState.status === 'authenticated' ? authState.userId : '';

  // ⚠️ 훅은 조건부 호출 불가 → roomId/meId 없을 때도 안전한 값으로 호출하고 렌더에서 분기.
  const { state, refresh } = useRoom({ roomId: roomId ?? '' });
  const { state: profileState } = useProfile({ userId: meId });
  const { renameRoom, loading: renaming, error: renameError } = useRenameRoom();
  const meNickname =
    profileState.status === 'ready' && profileState.profile.nickname
      ? profileState.profile.nickname
      : '나';
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // 이름 편집 시트 open 상태(로컬 UI). 저장 성공 시 닫고 useRoom.refresh로 헤더 갱신(비-낙관적, plan §3.4).
  const [editOpen, setEditOpen] = React.useState(false);

  if (!roomId) {
    return (
      <Screen center>
        <Text variant="body" color="fgWeak" style={styles.center}>
          로그를 찾을 수 없어요
        </Text>
      </Screen>
    );
  }

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator testID="logscreen-loading" color={theme.color.primary} />
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
          accessibilityLabel="다시 시도"
          variant="secondary"
          onPress={() => void refresh()}
          style={{ marginTop: theme.spacing[16] }}
        />
      </Screen>
    );
  }

  const { room } = state;
  const isCouple = room.memberCount >= 2;

  // 헤더/시트 표시명·placeholder 단일 출처(displayLogName, 결정2 B'). selfNickname=본인 닉(파트너 닉 미사용).
  const title = displayLogName({
    name: room.name,
    memberCount: room.memberCount,
    selfNickname: meNickname,
  });
  // 시트 placeholder = 이름 없을 때의 폴백명(displayLogName name:null). 입력 초기값은 이름 있으면 name·없으면 빈 문자열.
  const fallbackName = displayLogName({
    name: null,
    memberCount: room.memberCount,
    selfNickname: meNickname,
  });

  // 저장: 입력 원문(draft)을 renameRoom에 전달(정규화는 훅 내부) → 성공 시 시트 닫고 refresh로 헤더 갱신.
  //   실패(throw)는 useRenameRoom이 error를 세팅하고 시트는 열린 채(입력 보존·재시도). refresh는 1회만(비용 §8).
  const handleSaveName = async (next: string) => {
    try {
      await renameRoom({ roomId, name: next });
      setEditOpen(false);
      await refresh();
    } catch {
      // error 메시지는 useRenameRoom.error → LogNameSheet error prop으로 표시. 시트 유지.
    }
  };

  // 헤더 아바타 겹침 슬롯(LogTitleButton.avatarSlot로 주입). 데이터(아바타 url·커플 여부)는 여기서 구성.
  const avatarSlot = (
    <View style={styles.avatarStack}>
      <Avatar url={meAvatarUrl} userId={meId} size={HEADER_AVATAR_SIZE} />
      {isCouple ? (
        // 파트너 실데이터 미보유 → 익명 아바타(🙂) 겹침(marginLeft -9, 킷 23).
        <View style={{ marginLeft: -9 }}>
          <Avatar url={null} userId={null} nickname={null} size={HEADER_AVATAR_SIZE} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screen}>
      {/* 상단 헤더 — 뒤로가기 + 아바타 겹침 + 로그명(킷 mk-log:18-29). 킷 헤더엔 멤버 배지 없음(커플 여부는 아바타 겹침으로 표현).
          네이티브 헤더는 숨김(AppNavigator) — 이 자체 헤더가 단일 헤더(이중 헤더 방지).
          ⚠️ 네이티브 헤더 OFF로 사라진 top inset을 여기서 보전 — 킷 MK_STATUS_PAD=56(시뮬 근사 고정) 대신
          insets.top + spacing[8](HomeHeader와 동일 패턴)으로 동적 번역해 노치/다이나믹 아일랜드 겹침 방지. */}
      <View
        testID="logscreen-header"
        style={[
          styles.header,
          {
            paddingLeft: theme.spacing[8],
            paddingRight: theme.spacing[12],
            paddingTop: insets.top + theme.spacing[8],
          },
        ]}
      >
        <IconButton
          name={IconName.ChevronLeft}
          size={24}
          color="fg"
          accessibilityLabel="뒤로 가기"
          onPress={() => navigation.goBack()}
        />
        {/* 킷 mk-log:32-41 — 아바타 겹침 + 로그명 + ✏️를 하나의 탭 가능 버튼으로(탭 → 이름 편집 시트 open). */}
        <LogTitleButton title={title} avatarSlot={avatarSlot} onEdit={() => setEditOpen(true)} />
      </View>

      {/* 초대 영역 — 솔로=강조 카드 / 커플=컴팩트 코드 행. */}
      <View style={{ paddingHorizontal: theme.spacing[20], paddingTop: theme.spacing[12] }}>
        {isCouple ? (
          <CompactInviteRow code={room.inviteCode} />
        ) : (
          <SoloInviteBanner code={room.inviteCode} />
        )}
      </View>

      {/* 맛집 리스트 + 카테고리 필터 칩 + 섹션 헤더 + 입력 FAB — MuklogList(developer 배선). */}
      <MuklogList roomId={roomId} meId={meId} />

      {/* 로그 이름 편집 시트(킷 mk-log:91-102) — pencil 탭으로 open. 저장 → renameRoom → 성공 시 close + refresh. */}
      <LogNameSheet
        open={editOpen}
        initialValue={room.name ?? ''}
        placeholder={fallbackName}
        saving={renaming}
        error={renameError}
        onClose={() => setEditOpen(false)}
        onSave={(next) => void handleSaveName(next)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  center: { textAlign: 'center' },
  // 킷 mk-log:18 — paddingBottom 6, 좌우는 인라인(8/12). 뒤로가기↔본문 간격은 LogTitleButton marginLeft.
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  compactRow: { flexDirection: 'row', alignItems: 'center' },
  compactCode: { flex: 1 },
  // 솔로 배너(킷 mk-log:36-42) — 헤딩 행(💌+텍스트), 이모지는 클리핑 헤드룸 위해 lineHeight 지정.
  bannerHead: { flexDirection: 'row', alignItems: 'center' },
  bannerEmoji: { fontSize: 20, lineHeight: 26 },
  bannerHeading: { flex: 1 },
});
