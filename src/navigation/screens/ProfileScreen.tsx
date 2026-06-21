// src/navigation/screens/ProfileScreen.tsx
// 프로필 화면 — 킷 mk-log.jsx:527-622 ProfileScreen 재현 (plan profile-fidelity S5).
//   96px 아바타(url 있으면 이미지 / 없으면 userId 디폴트 이모지+컬러) + 우하단 카메라 배지(탭→이미지 업로드·실변경 토스트),
//   닉네임 + 편집 펜슬(탭→닉네임 편집 시트·저장 토스트), 통계 3칸(로그/기록한 맛집=ΣspotCount/커플 로그),
//   설정 리스트 2행(알림 설정 navigate / 이용 안내 toast), 즉시 로그아웃(Alert 없음, 킷 595).
//   ⚠️ 사진 소스 선택 시트·기본이미지 복원은 범위 밖(S5b 분리) — 아바타 커스터마이즈는 라이브러리 업로드 동선만.
//
// 생산자: useProfile(조회)/useUpdateProfile(저장·업로드)/useMyLogs(통계). 소비자: 상태별 UX. 스타일=토큰만(raw hex 0).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Avatar,
  Button,
  Icon,
  IconName,
  RenameDialog,
  Screen,
  SubBar,
  Text,
  useToastController,
} from '@/components';
import { Routes, type AppStackParamList } from '../routes';
import { useAuth } from '@/features/auth';
import {
  computeProfileStats,
  DeleteAccountSheet,
  NICKNAME_MAX_LENGTH,
  ProfileErrorToken,
  PROFILE_ERROR_MESSAGES,
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
  validateNickname,
} from '@/features/profile';
import { useMyLogs } from '@/features/room';
import { useTheme } from '@/theme';

// 설정 리스트 행(킷 mk-log.jsx:586) — 2행(알림 설정·이용 안내). "설정" 행 제거(킷 584).
//   행 동작은 navigate(route) | toast(메시지) 2종(킷: 알림설정=onOpenNotif / 이용안내=showToast).
//   ⚠️ wishlist 델타 #5: "위시리스트" 행 제거(로그 세그먼트로 진입, 중복 진입점 제거).
const RowKind = { Navigate: 'navigate', Toast: 'toast' } as const;
type RowKind = (typeof RowKind)[keyof typeof RowKind];

// navigate 행은 param-less 라우트만(여기선 NotifSettings) — navigate()가 리터럴 라우트명을 요구.
type SettingsRow =
  | { kind: typeof RowKind.Navigate; icon: IconName; label: string; route: typeof Routes.NotifSettings }
  | { kind: typeof RowKind.Toast; icon: IconName; label: string; toastMessage: string };

const SETTINGS_ROWS: readonly SettingsRow[] = [
  { kind: RowKind.Navigate, icon: IconName.Bell, label: '알림 설정', route: Routes.NotifSettings },
  { kind: RowKind.Toast, icon: IconName.CircleInfo, label: '이용 안내', toastMessage: '조금만 기다려 주세요' },
];

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { showToast } = useToastController();
  const { signOut } = useAuth();
  const { state, refresh } = useProfile({ userId });
  const { saveNickname, changeAvatar, savingNickname, uploadingAvatar, error } = useUpdateProfile({
    userId,
  });
  const { deleteAccount, loading: deletingAccount, error: deleteError } = useDeleteAccount();
  const { state: myLogsState } = useMyLogs({ userId });

  // RenameDialog는 controlled → 닉네임 입력 draft를 ProfileContent가 소유(open 시 현재 닉네임으로 prefill).
  const [draft, setDraft] = useState('');
  const [nickDialogOpen, setNickDialogOpen] = useState(false);
  // 회원 탈퇴 확인 시트(파괴적, 되돌릴 수 없음) — "회원 탈퇴" 행 탭으로 open, 취소/성공 시 close.
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);

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

  // 통계(plan profile-fidelity §4) — computeProfileStats(테스트된 단일 출처)로 산출.
  //   미준비(loading/error)면 빈 배열로 0/0/0. spotCount는 Σ myLogs.spotCount(킷 totalSpots, S2 집계 실값).
  const myLogs = myLogsState.status === 'ready' ? myLogsState.logs : [];
  const profileStats = computeProfileStats({ logs: myLogs });
  const stats: { key: string; label: string; value: number }[] = [
    { key: 'log', label: '로그', value: profileStats.logCount },
    { key: 'spot', label: '기록한 맛집', value: profileStats.spotCount },
    { key: 'couple', label: '커플 로그', value: profileStats.coupleCount },
  ];

  const handleSave = async () => {
    try {
      await saveNickname({ nickname: draft });
      setNickDialogOpen(false);
      await refresh();
      // 성공 시에만 변경 토스트(킷 545). 실패는 catch로 빠져 토스트 미노출.
      showToast({ message: '닉네임을 변경했어요', tone: 'positive' });
    } catch {
      // 실패는 useUpdateProfile.error(인라인)로 표시. 입력값/다이얼로그는 유지.
    }
  };

  const handleChangeAvatar = async () => {
    try {
      const { changed } = await changeAvatar();
      if (!changed) return; // 취소(피커 닫힘) → refresh·토스트 없음.
      await refresh();
      // 실변경 성공 시에만 토스트(킷 539). 취소/실패는 미노출.
      showToast({ message: '프로필 사진을 변경했어요', tone: 'positive' });
    } catch {
      // 권한거부/업로드 실패는 useUpdateProfile.error로 표시. 취소는 no-op.
    }
  };

  // 로그아웃 — 즉시 signOut(킷 595, 사용자 결정: 확인 Alert 제거 → AuthGate가 unauthenticated→LoginScreen).
  const handleSignOut = () => {
    void signOut();
  };

  // 회원 탈퇴(AC5) — 확인 시트 "탈퇴하기" → deleteAccount() → 성공 시 signOut(AuthGate→로그인).
  //   훅은 signOut 안 함(관심사 분리, dev-notes §AC4) → 호출부 책임. 실패는 toast + 시트 내 인라인 error(세션 유지·재시도).
  //   진행 중(deletingAccount)이면 시트 danger 버튼이 비활성(중복 실행 차단).
  const handleConfirmDelete = async () => {
    try {
      await deleteAccount();
      // 성공: 세션 정리 → AuthGate가 unauthenticated → LoginScreen(시트는 화면 언마운트로 사라짐).
      void signOut();
    } catch {
      // 실패: 세션 유지. useDeleteAccount.error(시트 인라인 error색) + 전역 토스트로 재시도 유도.
      //   Toast tone 은 neutral|positive 2종 → 실패 메시지는 neutral(인라인 error 텍스트가 파괴 톤 담당).
      showToast({ message: '탈퇴에 실패했어요. 다시 시도해 주세요.', tone: 'neutral' });
    }
  };

  return (
    <Screen edges={['left', 'right']} style={styles.flush}>
      {/* 킷 mk-log:428 SubBar "프로필"(좌측정렬). 네이티브 헤더는 AppNavigator에서 headerShown:false.
          'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — scrollContent paddingBottom+insets.bottom으로 인디케이터 클리어. */}
      <SubBar title="프로필" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}>
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
              onPress={() => setNickDialogOpen(true)}
              style={[
                styles.editBtn,
                { backgroundColor: theme.color.surfaceAlt, borderRadius: theme.radius.full },
              ]}
            >
              <Icon name={IconName.Pencil} size={15} color="fgWeak" />
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

        {/* 설정 리스트 2행(알림 설정·이용 안내) — 알림설정=navigate, 이용안내=toast */}
        <View
          style={[
            styles.settingsCard,
            { backgroundColor: theme.color.surface, borderRadius: theme.radius.sheet, padding: theme.spacing[4] },
            theme.shadow.card,
          ]}
        >
          {SETTINGS_ROWS.map((row, index) => (
            <Pressable
              key={row.label}
              testID={`settings-row-${row.label}`}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={
                row.kind === RowKind.Navigate
                  ? () => navigation.navigate(row.route)
                  : () => showToast({ message: row.toastMessage, tone: 'neutral' })
              }
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
            </Pressable>
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

        {/* 회원 탈퇴(AC5) — 로그아웃보다 약하게(앱 정책 UI, 킷 비종속). 카드 없이 텍스트 행만,
            error 색이되 작은 폰트·언더라인 톤으로 덜 강조 → 탭 시 파괴 확인 시트. Apple 5.1.1(v) 인앱 계정 삭제. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="회원 탈퇴"
          onPress={() => setDeleteSheetOpen(true)}
          style={({ pressed }) => [styles.deleteRow, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text variant="caption" color="fgMuted" style={styles.deleteLabel}>
            회원 탈퇴
          </Text>
        </Pressable>
      </ScrollView>

      {/* 닉네임 편집 다이얼로그(킷 mk-extra:24-64 RenameDialog 공용화) — controlled(draft는 ProfileContent 소유).
          saveDisabled=!canSave(빈/미변경/검증실패 시 비활성), error=nicknameMessage(검증 메시지). extra 없음(초대코드 미동봉, AC3.7). */}
      <RenameDialog
        open={nickDialogOpen}
        title="닉네임"
        value={draft}
        onChange={setDraft}
        onCancel={() => setNickDialogOpen(false)}
        onSave={() => void handleSave()}
        placeholder="닉네임을 입력하세요"
        maxLength={NICKNAME_MAX_LENGTH}
        saving={savingNickname}
        error={nicknameMessage}
        saveDisabled={!canSave}
      />

      {/* 회원 탈퇴 확인 시트(파괴적·되돌릴 수 없음, AC5) — 파괴 확인 패턴(LeaveLogSheets) 재사용.
          "탈퇴하기" → handleConfirmDelete(deleteAccount→성공 시 signOut). deleting/error 는 useDeleteAccount 상태. */}
      <DeleteAccountSheet
        visible={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
        deleting={deletingAccount}
        error={deleteError}
      />
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
  // fontSize 15로 키우면서 lineHeight도 함께 키운다 — spotCount 변종 lineHeight(14)<fontSize(15)면
  //   한글 글리프 상단이 클립돼 "흰색으로 덮인" 것처럼 보임(RN 텍스트 클리핑). lineHeight 20으로 여유 확보.
  settingsLabel: { flex: 1, fontSize: 15, lineHeight: 20 },
  // 로그아웃 행 — 설정 카드와 동일 톤(surface 카드), 텍스트는 error 컬러(파괴적), 중앙 정렬.
  signOutRow: { paddingVertical: 16, alignItems: 'center' },
  signOutLabel: { fontSize: 15, lineHeight: 20 },
  // 회원 탈퇴 행 — 로그아웃보다 약하게(카드 없음, caption/fgMuted, 언더라인). 화면 최하단 보조 액션.
  deleteRow: { paddingVertical: 16, alignItems: 'center' },
  deleteLabel: { textDecorationLine: 'underline' },
});
