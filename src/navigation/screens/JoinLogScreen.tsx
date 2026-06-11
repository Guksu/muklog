// src/navigation/screens/JoinLogScreen.tsx
// 초대코드 입장 화면 — mk-home JoinScreen + CodeInput 재현 (plan §6.5, AC10–AC15).
//   6셀 코드 입력(정규화) → isInviteCodeComplete면 입장 활성 → joinRoom → refresh → replace(LogScreen).
//   실패 시 useJoinRoom.error(매핑 메시지)를 코드 입력 아래 인라인 에러로 표시. 토스트/Alert 없이 화면 전환으로 성공.
//   이모지(💌) 허용(킷 정책). 스타일은 토큰만(raw hex 0).
//
// 생산자(소비): useJoinRoom(join_room RPC) + useMyLogsContext(refresh) + useNavigation(replace).
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Screen, Text } from '@/components';
import { isInviteCodeComplete, useJoinRoom, useMyLogsContext } from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';
import { CodeInput } from './CodeInput';

const HEART_EMOJI = '💌';

export const JoinLogScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { joinRoom, loading, error } = useJoinRoom();
  const myLogs = useMyLogsContext();

  const [code, setCode] = React.useState('');
  const complete = isInviteCodeComplete({ code });

  const handleJoin = async () => {
    try {
      const { roomId } = await joinRoom({ code });
      // 목록 갱신(+1/멱등) 후 그 로그로 replace(뒤로가기 시 코드 입력으로 안 돌아오게).
      await myLogs.refresh();
      navigation.replace(Routes.LogScreen, { roomId });
    } catch {
      // useJoinRoom이 error(매핑 메시지)를 세팅 → 아래 인라인 에러로 표시. 화면 유지.
    }
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // 킷 JoinScreen 상단 padding 12(plan B5), 좌우/하단 24 유지.
          {
            paddingTop: theme.spacing[12],
            paddingHorizontal: theme.spacing[24],
            paddingBottom: theme.spacing[24],
          },
        ]}
      >
        <Text variant="display" style={[styles.center, { marginTop: theme.spacing[20] }]}>
          {HEART_EMOJI}
        </Text>
        <Text variant="h2" color="fg" style={[styles.center, { marginTop: theme.spacing[8] }]}>
          연인의 로그에 입장하기
        </Text>
        <Text
          variant="body"
          color="fgWeak"
          style={[styles.center, { marginTop: theme.spacing[8], marginBottom: theme.spacing[28] }]}
        >
          {'연인이 공유한 6자리 초대코드를\n입력하면 같은 로그로 연결돼요.'}
        </Text>

        <CodeInput value={code} onChangeText={setCode} />

        {error ? (
          <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[16] }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: theme.spacing[24] }}>
          <Button
            title="입장하기"
            accessibilityLabel="입장하기"
            loading={loading}
            disabled={!complete}
            onPress={() => void handleJoin()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  content: { flexGrow: 1 },
  center: { textAlign: 'center' },
});
