// src/navigation/screens/LogScreen.tsx
// 로그 상세 화면(최소 stub) (plan §4.7). 카드 탭으로 진입하며 route.params.roomId를 받는다.
//   초대코드 표시·먹로그 리스트는 OUT-OF-SCOPE(차기 log-invite/muklog-list).
//   roomId 누락(직접 진입 등) 시 크래시 대신 안전 메시지.
import React from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Screen, Text } from '@/components';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

export const LogScreen = () => {
  const theme = useTheme();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.LogScreen>>();
  const roomId = route.params?.roomId;

  if (!roomId) {
    return (
      <Screen center>
        <Text variant="body" color="fgWeak" style={{ textAlign: 'center' }}>
          로그를 찾을 수 없어요
        </Text>
      </Screen>
    );
  }

  return (
    <Screen center>
      <Text variant="h3" color="fg" style={{ textAlign: 'center' }}>
        로그 화면 (준비 중)
      </Text>
      <Text variant="caption" color="fgMuted" style={{ textAlign: 'center', marginTop: theme.spacing[8] }}>
        {roomId}
      </Text>
    </Screen>
  );
}
