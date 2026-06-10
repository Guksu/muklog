// src/navigation/HomeHeader.tsx
// 홈(먹로그·지도 탭) 공통 커스텀 헤더 — mk-home HomeHeader 재현(ui-redesign 슬라이스 A 충실화).
//   좌측: 워드마크 "먹로그"(Pretendard-Bold 최굵게) + 🍽️ 이모지(muklog 킷 정책 — 이모지 허용).
//   우측: +버튼(PlusHeaderButton — 액센트-weak 버블 배경/액센트 아이콘, 로그 생성) + 프로필 아바타(36, 누르면 Profile).
//
// 생산자(소비): useAuth(userId) → useProfile(닉네임/아바타) → Avatar 표시. PlusHeaderButton(생성+refresh).
//   먹로그·지도 탭 모두 react-navigation `header: () => <HomeHeader />`로 공통 적용(HomeTabs).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { useTheme } from '@/theme';

import { PlusHeaderButton } from './PlusHeaderButton';
import { Routes, type AppStackParamList } from './routes';

const HEADER_AVATAR_SIZE = 36;
const WORDMARK = '먹로그';
const WORDMARK_EMOJI = '🍽️';

// 본인 프로필(닉네임/아바타)을 조회해 헤더 아바타로 렌더. userId가 있을 때만 마운트(useProfile 보장).
const HomeHeaderAvatar = ({ userId }: { userId: string }) => {
  const { state } = useProfile({ userId });
  const profile = state.status === 'ready' ? state.profile : null;
  return (
    <Avatar
      url={profile?.avatarUrl ?? null}
      nickname={profile?.nickname ?? null}
      size={HEADER_AVATAR_SIZE}
    />
  );
};

export const HomeHeader = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { state: authState } = useAuth();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.color.bg,
          paddingTop: insets.top + theme.spacing[8],
          paddingBottom: theme.spacing[12],
          paddingLeft: theme.spacing[20],
          paddingRight: theme.spacing[12],
        },
      ]}
    >
      <View style={[styles.left, { gap: theme.spacing[6] }]}>
        <Text variant="wordmark" color="fg" style={styles.wordmark}>
          {WORDMARK}
        </Text>
        <Text variant="bodyLg">{WORDMARK_EMOJI}</Text>
      </View>

      <View style={[styles.right, { gap: theme.spacing[4] }]}>
        <PlusHeaderButton />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필"
          onPress={() => navigation.navigate(Routes.Profile)}
          hitSlop={theme.spacing[8]}
          style={({ pressed }) => [styles.avatarButton, pressed ? styles.pressed : null]}
        >
          {authState.status === 'authenticated' ? (
            <HomeHeaderAvatar userId={authState.userId} />
          ) : (
            <Avatar url={null} nickname={null} size={HEADER_AVATAR_SIZE} />
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center' },
  // 워드마크 = muklog 킷 800/26 (typography.wordmark). 음수 letterSpacing(-0.5)으로 밀착.
  wordmark: { letterSpacing: -0.5 },
  right: { flexDirection: 'row', alignItems: 'center' },
  avatarButton: { padding: 2 },
  pressed: { opacity: 0.6 },
});
