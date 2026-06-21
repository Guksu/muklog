// src/navigation/screens/JoinLogScreen.tsx
// 초대코드 입력 화면 — mk-home JoinScreen + CodeInput 재현 (plan §6.5, AC10–AC15).
//   6셀 코드 입력(정규화) → isInviteCodeComplete면 입장 활성 → joinRoom → refresh → 전역 토스트 + replace(LogScreen).
//   성공 시 전역 토스트 "로그에 들어왔어요! 💕"(킷 SPEC §2-2) — 루트 ToastProvider라 replace 후 LogScreen 위에서 표시.
//   실패 시 useJoinRoom.error(매핑 메시지)를 코드 입력 아래 인라인 에러로 표시(화면 유지, 토스트 없음).
//   이모지(💌) 허용(킷 정책). 스타일은 토큰만(raw hex 0).
//
// 생산자(소비): useJoinRoom(join_room RPC) + useMyLogsContext(refresh) + useToastController + useNavigation(replace).
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Screen, SubBar, Text, useToastController } from '@/components';
import { isInviteCodeComplete, useJoinRoom, useMyLogsContext } from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';
import { CodeInput } from './CodeInput';

const HEART_EMOJI = '💌';

export const JoinLogScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { joinRoom, loading, error } = useJoinRoom();
  const myLogs = useMyLogsContext();
  // 입장 성공 피드백 — 전역 토스트(루트 단일 <Toast>). replace 후 LogScreen 위에서 표시(언마운트 무관).
  const { showToast } = useToastController();

  const [code, setCode] = React.useState('');
  const complete = isInviteCodeComplete({ code });

  const handleJoin = async () => {
    try {
      const { roomId } = await joinRoom({ code });
      // 목록 갱신(+1/멱등) 후 그 로그로 replace(뒤로가기 시 코드 입력으로 안 돌아오게).
      await myLogs.refresh();
      // 킷 SPEC §2-2 성공 토스트. 전역이라 replace로 화면이 바뀌어도 LogScreen 위에서 유지된다.
      showToast({ message: '로그에 들어왔어요! 💕', tone: 'positive' });
      navigation.replace(Routes.LogScreen, { roomId });
    } catch {
      // useJoinRoom이 error(매핑 메시지)를 세팅 → 아래 인라인 에러로 표시. 화면 유지.
    }
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 킷 mk-home:226 SubBar "초대코드 입력"(좌측정렬). 네이티브 헤더는 AppNavigator에서 headerShown:false.
          'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 콘텐츠 paddingBottom+insets.bottom으로 인디케이터 클리어. */}
      <SubBar title="초대코드 입력" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // 킷 JoinScreen 상단 padding 12(plan B5), 좌우/하단 24 유지(+insets.bottom 인디케이터 클리어).
          {
            paddingTop: theme.spacing[12],
            paddingHorizontal: theme.spacing[24],
            paddingBottom: theme.spacing[24] + insets.bottom,
          },
        ]}
      >
        <Text variant="display" style={[styles.center, { marginTop: theme.spacing[20] }]}>
          {HEART_EMOJI}
        </Text>
        <Text variant="h2" color="fg" style={[styles.center, { marginTop: theme.spacing[8] }]}>
          연인의 로그에 들어가기
        </Text>
        <Text
          variant="body"
          color="fgWeak"
          style={[styles.center, { marginTop: theme.spacing[8], marginBottom: theme.spacing[28] }]}
        >
          {'연인이 보낸 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요.'}
        </Text>

        <CodeInput value={code} onChangeText={setCode} />

        {error ? (
          <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[16] }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: theme.spacing[24] }}>
          <Button
            title="들어가기"
            accessibilityLabel="들어가기"
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
