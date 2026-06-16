// src/navigation/screens/ProfileScreen.tsx
// 프로필 화면 — 킷 mk-log.jsx:380-451 ProfileScreen 재현 (plan §5 B3 / §4.8).
//   96px 아바타(url 있으면 이미지 / 없으면 userId 디폴트 이모지+컬러) + 우하단 카메라 배지(탭→이미지 업로드),
//   닉네임 + 편집 펜슬(탭→닉네임 편집 시트), 통계 3칸(로그/기록한 맛집="-"/커플 로그), 설정 리스트 4행(비활성).
//   ⚠️ 이모지 선택 시트는 범위 밖(plan §47, 리더 결정) — 아바타 커스터마이즈는 이미지 업로드 동선만.
//
// 생산자: useProfile(조회)/useUpdateProfile(저장·업로드)/useMyLogs(통계). 소비자: 상태별 UX. 스타일=토큰만(raw hex 0).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Avatar, Button, Icon, IconName, Screen, Sheet, SubBar, Text } from '@/components';
import { useAuth } from '@/features/auth';
import {
  computeProfileStats,
  NICKNAME_MAX_LENGTH,
  ProfileErrorToken,
  PROFILE_ERROR_MESSAGES,
  useProfile,
  useUpdateProfile,
  validateNickname,
} from '@/features/profile';
import { useMyLogs } from '@/features/room';
import { useTheme } from '@/theme';

// 설정 리스트 행(킷 mk-log.jsx:422) — 비활성 플레이스홀더(차기 기능).
//   ⚠️ wishlist 스프린트(델타 #5): "위시리스트" 행 제거. 위시리스트는 로그 내부 세그먼트로 진입(중복 진입점 제거, 킷 정합).
const SETTINGS_ROWS = [
  { icon: IconName.Bell, label: '알림 설정' },
  { icon: IconName.CircleInfo, label: '이용 안내' },
  { icon: IconName.Setting, label: '설정' },
] as const;

const AVATAR_SIZE = 96;
const CAMERA_BADGE_SIZE = 32;
const EDIT_BTN_SIZE = 30;

export const ProfileScreen = () => {
  const { state } = useAuth();
  // 이 화면은 인증 완료 트리(HomeTabs) 하위에서만 진입하지만, 방어적으로 분기.
  if (state.status !== 'authenticated') {
    return (
      <Screen center>
        <Text variant="body" color="fgWeak">
          프로필을 불러오는 중…
        </Text>
      </Screen>
    );
  }
  return <ProfileContent userId={state.userId} />;
};

const ProfileContent = ({ userId }: { userId: string }) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const { state, refresh } = useProfile({ userId });
  const { saveNickname, changeAvatar, savingNickname, uploadingAvatar, error } = useUpdateProfile({
    userId,
  });
  const { state: myLogsState } = useMyLogs({ userId });

  const [draft, setDraft] = useState('');
  const [nickSheetOpen, setNickSheetOpen] = useState(false);

  // 조회 완료 시 입력칸을 현재 닉네임으로 prefill(null=빈 상태면 빈 칸 유지).
  const readyNickname = state.status === 'ready' ? state.profile.nickname : null;
  useEffect(
    function syncNicknameDraft() {
      if (readyNickname !== null) setDraft(readyNickname);
    },
    [readyNickname],
  );

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator testID="profile-loading" color={theme.color.primary} />
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

  const { profile } = state;
  const validation = validateNickname({ raw: draft });
  const currentNickname = profile.nickname ?? '';
  const nicknameMessage = validation.ok
    ? null
    : PROFILE_ERROR_MESSAGES[
        validation.reason === 'empty'
          ? ProfileErrorToken.NicknameEmpty
          : ProfileErrorToken.NicknameTooLong
      ];
  // 검증 통과 + 변경됨 + 저장 중 아님일 때만 활성(불필요 쓰기 방지, plan §6).
  const canSave = validation.ok && !savingNickname && validation.value !== currentNickname;

  // 통계(plan §B3) — computeProfileStats(테스트된 단일 출처)로 산출. 미준비(loading/error)면 빈 배열로 0/-/0.
  //   spotCount는 집계 미보유(SPOT_COUNT_UNAVAILABLE=null) → "-" 표기(차기 백엔드 스프린트에서 실값).
  const myLogs = myLogsState.status === 'ready' ? myLogsState.logs : [];
  const profileStats = computeProfileStats({ logs: myLogs });
  const stats: { key: string; label: string; value: string | number }[] = [
    { key: 'log', label: '로그', value: profileStats.logCount },
    { key: 'spot', label: '기록한 맛집', value: profileStats.spotCount ?? '-' },
    { key: 'couple', label: '커플 로그', value: profileStats.coupleCount },
  ];

  const handleSave = async () => {
    try {
      await saveNickname({ nickname: draft });
      setNickSheetOpen(false);
      await refresh();
    } catch {
      // 실패는 useUpdateProfile.error(인라인)로 표시. 입력값/시트는 유지.
    }
  };

  const handleChangeAvatar = async () => {
    try {
      await changeAvatar();
      await refresh();
    } catch {
      // 권한거부/업로드 실패는 useUpdateProfile.error로 표시. 취소는 no-op.
    }
  };

  // 로그아웃 — 파괴적 액션이므로 확인 후 signOut(→ AuthGate가 unauthenticated→LoginScreen).
  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃하면 다시 로그인해야 해요. 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen edges={['bottom', 'left', 'right']} style={styles.flush}>
      {/* 킷 mk-log:428 SubBar "프로필"(좌측정렬). 네이티브 헤더는 AppNavigator에서 headerShown:false. */}
      <SubBar title="프로필" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 아바타 + 카메라 배지 + 닉네임 */}
        <View style={styles.avatarSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            accessibilityState={{ busy: uploadingAvatar }}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
            style={styles.avatarPress}
          >
            <Avatar url={profile.avatarUrl} userId={userId} size={AVATAR_SIZE} />
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: theme.color.primary, borderColor: theme.color.bg },
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator testID="avatar-uploading" size="small" color={theme.color.primaryFg} />
              ) : (
                <Icon name={IconName.Camera} size={16} color="primaryFg" />
              )}
            </View>
          </Pressable>

          <View style={[styles.nicknameRow, { marginTop: theme.spacing[12] }]}>
            <Text variant="profileName" color="fg">
              {profile.nickname ?? '닉네임 미설정'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닉네임 편집"
              onPress={() => setNickSheetOpen(true)}
              style={[
                styles.editBtn,
                { backgroundColor: theme.color.surfaceAlt, borderRadius: theme.radius.full },
              ]}
            >
              <Icon name={IconName.Setting} size={15} color="fgWeak" />
            </Pressable>
          </View>
        </View>

        {/* 통계 3칸 */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.color.surface, borderRadius: theme.radius.sheet },
            theme.shadow.card,
          ]}
        >
          {stats.map((stat, index) => (
            <View
              key={stat.key}
              style={[
                styles.statCell,
                index > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.color.hairlineAlt } : null,
              ]}
            >
              <Text variant="h2" color="accentStrong" style={styles.statValue}>
                {stat.value}
              </Text>
              <Text variant="caption" color="fgMuted" style={{ marginTop: theme.spacing[6] }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 설정 리스트 4행(비활성 플레이스홀더) */}
        <View
          style={[
            styles.settingsCard,
            { backgroundColor: theme.color.surface, borderRadius: theme.radius.sheet, padding: theme.spacing[4] },
            theme.shadow.card,
          ]}
        >
          {SETTINGS_ROWS.map((row, index) => (
            <View
              key={row.label}
              testID={`settings-row-${row.label}`}
              style={[
                styles.settingsRow,
                index < SETTINGS_ROWS.length - 1
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.hairlineAlt }
                  : null,
              ]}
            >
              <Icon name={row.icon} size={20} color="fgWeak" />
              <Text variant="spotCount" color="fg" style={styles.settingsLabel}>
                {row.label}
              </Text>
              <Icon name={IconName.ChevronRight} size={17} color="fgAssistive" />
            </View>
          ))}
        </View>

        {/* 로그아웃(파괴적 액션) — 설정 리스트 하단 별도 행. 탭→확인→signOut(social-auth ⑥/§4.3). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          onPress={handleSignOut}
          style={[
            styles.signOutRow,
            {
              backgroundColor: theme.color.surface,
              borderRadius: theme.radius.sheet,
              marginTop: theme.spacing[12],
            },
            theme.shadow.card,
          ]}
        >
          <Text variant="spotCount" color="error" style={styles.signOutLabel}>
            로그아웃
          </Text>
        </Pressable>

        {error ? (
          <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[16] }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {/* 닉네임 편집 시트 */}
      <Sheet visible={nickSheetOpen} onClose={() => setNickSheetOpen(false)} title="닉네임 편집">
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t)}
          placeholder="닉네임을 입력하세요"
          placeholderTextColor={theme.color.fgAssistive}
          maxLength={NICKNAME_MAX_LENGTH}
          editable={!savingNickname}
          autoFocus
          style={[
            styles.input,
            theme.typography.body,
            {
              color: theme.color.fg,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.primary,
              borderRadius: theme.radius.control,
              paddingVertical: theme.spacing[14],
              paddingHorizontal: theme.spacing[16],
            },
          ]}
        />
        {nicknameMessage ? (
          <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[8] }}>
            {nicknameMessage}
          </Text>
        ) : null}
        <Button
          title="저장"
          size="lg"
          full
          loading={savingNickname}
          disabled={!canSave}
          onPress={handleSave}
          style={{ marginTop: theme.spacing[14] }}
        />
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  flush: { padding: 0 },
  scrollContent: { padding: 20, paddingBottom: 28 },
  avatarSection: { alignItems: 'center', marginTop: 12 },
  avatarPress: { position: 'relative' },
  // 카메라 배지 — 우하단, 32px 원형, bg색 3px 링(킷 box-shadow 0 0 0 3px --mk-bg → borderWidth 근사).
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: CAMERA_BADGE_SIZE,
    height: CAMERA_BADGE_SIZE,
    borderRadius: CAMERA_BADGE_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { width: EDIT_BTN_SIZE, height: EDIT_BTN_SIZE, alignItems: 'center', justifyContent: 'center' },
  statsCard: { flexDirection: 'row', marginTop: 22, paddingVertical: 16 },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, lineHeight: 26 },
  settingsCard: { marginTop: 20 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  settingsLabel: { flex: 1, fontSize: 15 },
  // 로그아웃 행 — 설정 카드와 동일 톤(surface 카드), 텍스트는 error 컬러(파괴적), 중앙 정렬.
  signOutRow: { paddingVertical: 16, alignItems: 'center' },
  signOutLabel: { fontSize: 15 },
  input: { borderWidth: 2 },
});
