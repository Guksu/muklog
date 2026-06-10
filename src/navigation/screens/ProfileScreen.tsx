// src/navigation/screens/ProfileScreen.tsx
// 프로필 편집 화면 (plan §4, T9 / P1·P5·P6). Room 헤더에서 진입.
//   - 현재 닉네임/아바타 표시(useProfile), 닉네임 편집·저장(useUpdateProfile.saveNickname),
//     아바타 변경(useUpdateProfile.changeAvatar). 저장/업로드 성공 후 refresh()로 즉시 반영.
//
// 생산자: useProfile(조회) / useUpdateProfile(저장·업로드). 소비자: 이 화면의 상태별 UX.
// 스타일은 원티드 토큰만(raw hex 0).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Button, Screen, Text } from '@/components';
import { useAuth } from '@/features/auth';
import {
  NICKNAME_MAX_LENGTH,
  ProfileErrorToken,
  PROFILE_ERROR_MESSAGES,
  useProfile,
  useUpdateProfile,
  validateNickname,
} from '@/features/profile';
import { useTheme } from '@/theme';

export const ProfileScreen = () => {
  const { state } = useAuth();
  // 이 화면은 인증 완료 트리(RoomTabs) 하위에서만 진입하지만, 방어적으로 분기.
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
  const { state, refresh } = useProfile({ userId });
  const { saveNickname, changeAvatar, savingNickname, uploadingAvatar, error } = useUpdateProfile({
    userId,
  });

  const [draft, setDraft] = useState('');

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

  const handleSave = async () => {
    try {
      await saveNickname({ nickname: draft });
      await refresh();
    } catch {
      // 실패는 useUpdateProfile.error(인라인)로 표시. 입력값은 유지.
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

  return (
    <Screen>
      <View style={[styles.avatarSection, { marginTop: theme.spacing[12] }]}>
        <Avatar url={profile.avatarUrl} nickname={profile.nickname} size={96} />
        <Button
          title="사진 변경"
          variant="secondary"
          loading={uploadingAvatar}
          onPress={handleChangeAvatar}
          style={{ marginTop: theme.spacing[12] }}
        />
      </View>

      <View style={{ marginTop: theme.spacing[32], gap: theme.spacing[8] }}>
        <Text variant="bodySm" color="fgWeak">
          닉네임
        </Text>
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t)}
          placeholder="닉네임을 입력하세요"
          placeholderTextColor={theme.color.fgMuted}
          maxLength={NICKNAME_MAX_LENGTH}
          editable={!savingNickname}
          style={[
            styles.input,
            theme.typography.body,
            {
              color: theme.color.fg,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
              borderRadius: theme.radius.lg,
              paddingVertical: theme.spacing[12],
              paddingHorizontal: theme.spacing[16],
            },
          ]}
        />
        {nicknameMessage ? (
          <Text variant="bodySm" color="error">
            {nicknameMessage}
          </Text>
        ) : null}
        <Button
          title="저장"
          loading={savingNickname}
          disabled={!canSave}
          onPress={handleSave}
          style={{ marginTop: theme.spacing[8] }}
        />
      </View>

      {error ? (
        <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[16] }]}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  avatarSection: { alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth },
});
