// src/navigation/screens/RoomCreatedScreen.tsx
// 로그 생성 완료 축하 화면(비주얼 셸) — 킷 mk-home.jsx:273-289 CreatedScreen 재현 (FLAG-3).
//   SubBar "로그 만들기" + 🎉 + "우리 로그가 만들어졌어요" + 초대코드 카드 + "로그 열기"/"나중에".
//   순수 프리젠테이션 — props 계약만(developer가 멀티로그 생성 플로우·네비 배선).
//   이모지 허용(킷 정책). 스타일은 토큰만(raw hex 0).
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, InviteCodeCard, Screen, SubBar, Text } from '@/components';
import { useTheme } from '@/theme';

const PARTY_EMOJI = '🎉';

export type RoomCreatedScreenProps = {
  /** 생성된 로그의 6자리 초대코드. */
  inviteCode: string;
  /** "로그 열기" — 생성한 로그로 진입. */
  onEnter: () => void;
  /** "나중에" / 뒤로 — 홈으로 복귀. */
  onLater: () => void;
};

export const RoomCreatedScreen = ({ inviteCode, onEnter, onLater }: RoomCreatedScreenProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // 'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 콘텐츠 paddingBottom+insets.bottom으로 인디케이터 클리어.
    <Screen edges={['left', 'right']} style={styles.screen}>
      <SubBar title="로그 만들기" onBack={onLater} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // 킷 mk-home:277 본문 padding 12 / 24(+insets.bottom 인디케이터 클리어).
          { paddingTop: theme.spacing[12], paddingHorizontal: theme.spacing[24], paddingBottom: theme.spacing[24] + insets.bottom },
        ]}
      >
        {/* 킷 mk-home:278 🎉 fontSize 56, center. */}
        <Text style={[styles.center, styles.emoji, { marginTop: theme.spacing[24] }]}>
          {PARTY_EMOJI}
        </Text>
        {/* 킷 mk-home:279 제목 800/22/1.35 center. */}
        <Text variant="profileName" color="fg" style={[styles.center, styles.title, { marginTop: theme.spacing[8] }]}>
          우리 로그가 만들어졌어요
        </Text>
        {/* 킷 mk-home:280-281 본문 500/14.5/1.6 text-alternative center. */}
        <Text
          variant="bodySm"
          color="fgMuted"
          style={[styles.center, { marginTop: theme.spacing[8], marginBottom: theme.spacing[28] }]}
        >
          {'아래 코드를 보내면\n함께 기록할 수 있어요.'}
        </Text>

        <InviteCodeCard code={inviteCode} />

        {/* 킷 mk-home:284 flex 1 스페이서로 버튼을 하단에 밀어냄. */}
        <View style={styles.spacer} />

        <Button title="로그 열기" accessibilityLabel="로그 열기" size="lg" onPress={onEnter} />
        <View style={{ height: theme.spacing[10] }} />
        <Button title="나중에" accessibilityLabel="나중에" variant="ghost" size="lg" onPress={onLater} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { flexGrow: 1 },
  center: { textAlign: 'center' },
  // 킷 제목 lineHeight 22×1.35≈30(profileName 기본 26 보정).
  title: { lineHeight: 30 },
  emoji: { fontSize: 56, lineHeight: 64 },
  spacer: { flex: 1, minHeight: 24 },
});
