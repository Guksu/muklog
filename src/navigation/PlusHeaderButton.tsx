// src/navigation/PlusHeaderButton.tsx
// HomeTabs 헤더 우측의 +버튼 (plan §4.4). 멀티 로그 전환: 이번엔 "로그 생성" 단일 액션.
//   누르면 액션시트 없이 바로 createRoom()(무인자, 정원2 기본) → myLogs.refresh()(목록 즉시 +1).
//   실패 시 Alert로 매핑 메시지. creating(loading) 중 비활성(중복 생성 1차 방지).
//   ⚠️ "로그 입장"(액션시트 확장)은 차기 log-invite 슬라이스에서 도입.
//
// 생산자(소비): useCreateRoom(RPC) + useMyLogsContext(refresh).
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { Icon, IconName } from '@/components';
import { mapRoomError, useCreateRoom, useMyLogsContext } from '@/features/room';
import { useTheme } from '@/theme';

export const PlusHeaderButton = () => {
  const theme = useTheme();
  const { createRoom, loading: creating } = useCreateRoom();
  const myLogs = useMyLogsContext();

  const handleCreate = async () => {
    try {
      await createRoom();
      // 생성은 화면 전환이 없으므로 목록을 직접 refresh → 카드 즉시 +1.
      await myLogs.refresh();
    } catch (err) {
      // 헤더 버튼이라 인라인 영역이 없음 → 네이티브 Alert로 매핑된 메시지 표시.
      Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err }));
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="로그 만들기"
      accessibilityState={{ disabled: creating, busy: creating }}
      disabled={creating}
      onPress={() => void handleCreate()}
      hitSlop={theme.spacing[8]}
      // mk-home HomeHeader 재현: 액센트-weak 버블 배경 + 액센트 아이콘(원형 40 버블).
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.full },
        pressed && !creating ? styles.pressed : null,
      ]}
    >
      {creating ? (
        <ActivityIndicator color={theme.color.primary} />
      ) : (
        <Icon name={IconName.Plus} size={24} color="primary" />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
