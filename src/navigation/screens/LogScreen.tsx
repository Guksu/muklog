// src/navigation/screens/LogScreen.tsx
// 로그 상세 화면 — useRoom 조회 → 초대코드 표시·복사(솔로) / 코드 숨김(커플) 분기 (plan §6.1, AC1·AC3·AC4·AC5).
//   route.params.roomId(카드 탭/입장 직후/딥링크 진입) → useRoom 자급 조회(목록 캐시 비의존).
//   loading=로더 / error=메시지+다시 시도(refresh) / ready=솔로(InviteCodeCard+안내) 또는 커플("둘이 함께 기록 중").
//   맛집 리스트·상세·에디터는 OUT(차기 muklog-list) → 하단 placeholder만. 이모지 허용(킷 정책).
//
// 생산자(소비): useRoom(get_room RPC) → RoomDetail{inviteCode,memberCount,mode}. InviteCodeCard(복사).
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Badge, Button, InviteCodeCard, Screen, Text } from '@/components';
import { useRoom } from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

// 솔로/커플 멤버 배지 문구(멤버 수 파생 — plan 함정3).
const memberBadgeLabel = ({ memberCount }: { memberCount: number }): string =>
  memberCount >= 2 ? '둘이' : '혼자';

export const LogScreen = () => {
  const theme = useTheme();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.LogScreen>>();
  const roomId = route.params?.roomId;

  // ⚠️ 훅은 조건부 호출 불가 → roomId 없을 때도 안전한 더미 id로 호출하고 렌더에서 분기.
  //    (실제로 roomId 없으면 아래에서 즉시 안전 메시지를 반환해 결과를 쓰지 않는다.)
  const { state, refresh } = useRoom({ roomId: roomId ?? '' });

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

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing[20], gap: theme.spacing[16] }}>
        {/* 헤더 영역: 멤버 배지(혼자/둘이) */}
        <View style={styles.headerRow}>
          <Badge label={memberBadgeLabel({ memberCount: room.memberCount })} tone="primary" />
        </View>

        {isCouple ? (
          // 커플: 코드 숨김(정원 찼으므로) + "둘이 함께 기록 중" 안내.
          <View style={[styles.coupleNote, { gap: theme.spacing[6] }]}>
            <Text variant="display" style={styles.center}>
              💑
            </Text>
            <Text variant="h3" color="fg" style={styles.center}>
              둘이 함께 기록 중이에요
            </Text>
            <Text variant="bodySm" color="fgWeak" style={styles.center}>
              둘만의 맛집 지도를 함께 채워가요.
            </Text>
          </View>
        ) : (
          // 솔로: 초대코드 카드(표시+복사) + 초대 안내.
          <View style={{ gap: theme.spacing[10] }}>
            <InviteCodeCard code={room.inviteCode} />
            <Text variant="bodySm" color="fgWeak" style={{ paddingHorizontal: theme.spacing[4] }}>
              초대코드로 짝꿍을 초대하세요
            </Text>
          </View>
        )}

        {/* 맛집 기록 placeholder — muklog-list 슬라이스 자리(OUT). */}
        <View
          style={[
            styles.placeholder,
            {
              borderColor: theme.color.hairline,
              borderRadius: theme.radius.card,
              padding: theme.spacing[24],
              marginTop: theme.spacing[8],
            },
          ]}
        >
          <Text variant="bodySm" color="fgMuted" style={styles.center}>
            맛집 기록은 곧 추가돼요 🍽️
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  center: { textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  coupleNote: { alignItems: 'center', paddingVertical: 24 },
  placeholder: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
});
