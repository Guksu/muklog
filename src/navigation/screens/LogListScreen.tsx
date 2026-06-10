// src/navigation/screens/LogListScreen.tsx
// 먹로그 탭(탭1) — 내가 속한 로그 카드 목록 (plan §4.5).
//   loading → 스피너 / error → 메시지+다시 시도(refresh) / ready+[] → 빈 상태 / ready+logs → 카드 리스트.
// 카드: 멤버 배지(둘이/혼자 — memberCount 파생, C2) + 생성일(YYYY.MM.DD) + chevron. 탭→LogScreen({roomId}).
//
// 생산자(소비): useMyLogsContext(state/refresh) + useNavigation. 스타일 원티드 토큰만(raw hex 0).
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Button, Screen, Text } from '@/components';
import { useMyLogsContext, type MyLog } from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';
import { formatLogDate } from './formatLogDate';

// 멤버 배지 문구: 2명=둘이 / 그 외(1)=혼자. mode 컬럼이 아니라 멤버 수에서 파생(plan 함정3).
const memberBadgeLabel = ({ memberCount }: { memberCount: number }): string =>
  memberCount >= 2 ? '둘이' : '혼자';

const LogCard = ({
  log,
  onPress,
}: {
  log: MyLog;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="로그 열기"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
          borderRadius: theme.radius.lg,
          paddingVertical: theme.spacing[16],
          paddingHorizontal: theme.spacing[16],
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.cardBody}>
        <View style={[styles.badge, { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.full, paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[10] }]}>
          <Text variant="caption" color="primary">
            {memberBadgeLabel({ memberCount: log.memberCount })}
          </Text>
        </View>
        <Text variant="bodySm" color="fgWeak" style={{ marginTop: theme.spacing[8] }}>
          {formatLogDate({ iso: log.createdAt })}
        </Text>
      </View>
      <Text variant="h3" color="fgMuted">
        ›
      </Text>
    </Pressable>
  );
};

export const LogListScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { state, refresh } = useMyLogsContext();

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

  // ready & 빈 목록 = 빈 상태(정상, 에러 아님).
  if (state.logs.length === 0) {
    return (
      <Screen center>
        <Text variant="h3" color="fg" style={styles.center}>
          아직 로그가 없어요
        </Text>
        <Text variant="bodySm" color="fgWeak" style={[styles.center, { marginTop: theme.spacing[8] }]}>
          오른쪽 위 + 버튼으로 로그를 만들어 보세요
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={state.logs}
        keyExtractor={(item) => item.roomId}
        contentContainerStyle={{ gap: theme.spacing[12], paddingVertical: theme.spacing[8] }}
        renderItem={({ item }) => (
          <LogCard
            log={item}
            onPress={() => navigation.navigate(Routes.LogScreen, { roomId: item.roomId })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBody: { flex: 1 },
  badge: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
});
