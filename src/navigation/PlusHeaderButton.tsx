// src/navigation/PlusHeaderButton.tsx
// HomeTabs 헤더 우측의 +버튼 (plan §6.3 / §5 T7). log-invite: 단일 생성 → 액션시트(AddSheet) 분기로 갱신.
//   + 탭 → AddSheet 오픈. "새 로그 만들기" → createRoom() → 성공 시 refresh() + RoomCreated 축하화면 navigate(FLAG-3).
//     ⚠️ FLAG-3 갱신: 기존 "생성→LogScreen 직행"에서 축하화면(초대코드 공유)을 경유하도록 변경. 축하화면에서 로그 열기/나중에 분기.
//   "초대코드로 입장" → JoinLog 라우트 navigate. 생성 실패 시 Alert(매핑 메시지)·navigate/refresh 미발생.
//   creating(loading) 중 +버튼 비활성(중복 1차 방지).
//
// 생산자(소비): useCreateRoom(RPC → {roomId, inviteCode}) + useMyLogsContext(refresh) + useNavigation(navigate).
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Icon, IconName } from '@/components';
import { mapRoomError, useCreateRoom, useMyLogsContext } from '@/features/room';
import { useTheme } from '@/theme';

import { AddSheet } from './AddSheet';
import { Routes, type AppStackParamList } from './routes';

export const PlusHeaderButton = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { createRoom, loading: creating } = useCreateRoom();
  const myLogs = useMyLogsContext();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleCreate = async () => {
    setSheetOpen(false);
    try {
      const { roomId, inviteCode } = await createRoom();
      // 목록 갱신(+1) 후 생성 완료 축하화면으로 이동(초대코드 공유 → 로그 열기/나중에 분기, FLAG-3).
      await myLogs.refresh();
      navigation.navigate(Routes.RoomCreated, { roomId, code: inviteCode });
    } catch (err) {
      // 헤더 버튼이라 인라인 영역이 없음 → 네이티브 Alert로 매핑된 메시지 표시(navigate/refresh 없음).
      Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err }));
    }
  };

  const handleJoin = () => {
    setSheetOpen(false);
    navigation.navigate(Routes.JoinLog);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그 만들기"
        accessibilityState={{ disabled: creating, busy: creating }}
        disabled={creating}
        onPress={() => setSheetOpen(true)}
        hitSlop={theme.spacing[8]}
        // mk-home HomeHeader 재현: 액센트-weak 버블 배경 + 액센트 아이콘(원형 40 버블).
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.full },
          pressed && !creating ? styles.pressed : null,
        ]}
      >
        {creating ? (
          <ActivityIndicator color={theme.color.accentStrong} />
        ) : (
          // 킷 IBTN: accent-strong(#1F4FE0) 아이콘 + accent-weak 버블.
          <Icon name={IconName.Plus} size={24} color="accentStrong" />
        )}
      </Pressable>

      <AddSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={() => void handleCreate()}
        onJoin={handleJoin}
        creating={creating}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
