// src/navigation/HomeHeader.tsx
// 홈(먹로그·지도 탭) 공통 커스텀 헤더 — mk-home HomeHeader 재현(ui-redesign 슬라이스 A 충실화).
//   좌측: 워드마크 "먹로그"(SUIT-Bold 최굵게). 헤더 워드마크 옆 이모지는 제거(킷 README·사용자 결정).
//   우측: +버튼(PlusHeaderButton — 액센트-weak 버블 배경/액센트 아이콘, 로그 생성) + 프로필 아바타(36, 누르면 Profile).
//
// 생산자(소비): useAuth(userId) → useProfileContext(공유 닉네임/아바타·#2) → Avatar 표시. PlusHeaderButton(생성+refresh).
//   먹로그·지도 탭 모두 react-navigation `header: () => <HomeHeader />`로 공통 적용(HomeTabs).
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Text } from "@/components";
import { useAuth } from "@/features/auth";
import { defaultNickname, useProfileContext } from "@/features/profile";
import { useTheme } from "@/theme";

import { PlusHeaderButton } from "../PlusHeaderButton";
import { Routes, type AppStackParamList } from "../routes";

const HEADER_AVATAR_SIZE = 36;
// 킷 mk-home: 먹로그 탭 title="먹로그"(:82), 지도 탭 title="지도"(:261). 탭별 워드마크 텍스트.
const DEFAULT_WORDMARK = "먹로그";

export type HomeHeaderProps = {
  /** 헤더 워드마크 텍스트(탭별). 기본 '먹로그'. 지도 탭은 '지도'. */
  title?: string;
};

// 본인 프로필(닉네임/아바타)을 공유 context에서 읽어 헤더 아바타로 렌더(#2 — 다른 화면 변경 즉시 전파).
//   url 없으면 userId 결정적 디폴트(이모지+컬러)로 표시(plan §3.3).
//   닉네임 미설정 시 결정적 기본 닉네임(동물명+숫자)으로 폴백(#3) → 접근성 라벨/이니셜 일관.
const HomeHeaderAvatar = ({ userId }: { userId: string }) => {
  const { state } = useProfileContext();
  const profile = state.status === "ready" ? state.profile : null;
  const nickname =
    profile?.nickname && profile.nickname.length > 0
      ? profile.nickname
      : defaultNickname({ userId });
  return (
    <Avatar
      url={profile?.avatarUrl ?? null}
      userId={userId}
      nickname={nickname}
      size={HEADER_AVATAR_SIZE}
    />
  );
};

export const HomeHeader = ({ title = DEFAULT_WORDMARK }: HomeHeaderProps) => {
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
      <View style={[styles.left, { gap: theme.spacing[7] }]}>
        <Text variant="wordmark" color="fg" style={styles.wordmark}>
          {title}
        </Text>
      </View>

      <View style={[styles.right, { gap: theme.spacing[4] }]}>
        <PlusHeaderButton />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필"
          onPress={() => navigation.navigate(Routes.Profile)}
          hitSlop={theme.spacing[8]}
          style={({ pressed }) => [
            styles.avatarButton,
            pressed ? styles.pressed : null,
          ]}
        >
          {authState.status === "authenticated" ? (
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // 킷: 워드마크/이모지 베이스라인 정렬(alignItems baseline).
  left: { flexDirection: "row", alignItems: "baseline" },
  // 워드마크 = muklog 킷 800/26 (typography.wordmark). 음수 letterSpacing(-0.5)으로 밀착.
  wordmark: { letterSpacing: -0.5 },
  wordmarkEmoji: { fontSize: 19 },
  right: { flexDirection: "row", alignItems: "center" },
  avatarButton: { padding: 2 },
  pressed: { opacity: 0.6 },
});
