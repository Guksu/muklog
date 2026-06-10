// src/navigation/screens/OnboardingScreen.tsx
// 방 진입 전 화면. 새 라우트 추가 없이 내부 step 상태로 흐름을 처리한다(plan §4).
//   choose         : "방 만들기" / "초대코드 입력"
//   select-mode    : "혼자 기록할래요"(솔로) / "둘이 함께 기록할래요"(커플) + "뒤로"
//   create-result  : (커플만) 생성된 6자리 코드 표시 + 복사 + "방으로 가기"
//   join           : 6자리 코드 입력(정규화) + "입장"
//
// 생산자: useCreateRoom / useJoinRoom (RPC) + useMembershipContext.refresh.
// 소비자(전이): 성공 시 refresh() + navigation.reset(RoomTabs) → 즉시·결정적 전이(뒤로가기 복귀 방지, C8).
//   솔로 성공 = 코드 화면 생략하고 즉시 goToRoom / 커플 성공 = create-result 거쳐 전이(C7).
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { Button, Screen, Text } from '@/components';
import {
  INVITE_CODE_LENGTH,
  isInviteCodeComplete,
  normalizeInviteCodeInput,
  ROOM_MODES,
  useCreateRoom,
  useJoinRoom,
  useMembershipContext,
  type RoomMode,
} from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

type Step = 'choose' | 'select-mode' | 'create-result' | 'join';

export const OnboardingScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const membership = useMembershipContext();

  const [step, setStep] = useState<Step>('choose');

  const { createRoom, loading: creating, error: createError } = useCreateRoom();
  const { joinRoom, loading: joining, error: joinError } = useJoinRoom();

  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');

  // 성공 전이: 멤버십 상태 갱신(백그라운드) + 스택 리셋으로 RoomTabs 즉시 진입(뒤로가기 복귀 불가).
  const goToRoom = () => {
    void membership.refresh();
    navigation.reset({ index: 0, routes: [{ name: Routes.RoomTabs }] });
  };

  // 모드 선택 후 생성. 솔로는 코드 화면을 생략하고 즉시 RoomTabs로, 커플은 코드 화면을 거친다(C7).
  const handleCreate = async ({ mode }: { mode: RoomMode }) => {
    try {
      const { inviteCode, mode: createdMode } = await createRoom({ mode });
      if (createdMode === ROOM_MODES.solo) {
        goToRoom();
        return;
      }
      setCreatedCode(inviteCode);
      setCopied(false);
      setStep('create-result');
    } catch {
      // createError(훅 상태)로 메시지 표시. step은 select-mode 유지(입력 손실 없음).
    }
  };

  const handleJoin = async () => {
    try {
      await joinRoom({ code });
      goToRoom();
    } catch {
      // joinError(훅 상태)로 인라인 메시지 표시. 입력값(code)은 유지.
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(createdCode);
    setCopied(true);
  };

  const goChoose = () => {
    setStep('choose');
    setCode('');
  };

  return (
    <Screen>
      <View style={{ marginTop: theme.spacing[24] }}>
        <Text variant="h1" color="fg" style={styles.center}>
          muklog
        </Text>
        <Text variant="body" color="fgWeak" style={[styles.center, { marginTop: theme.spacing[8] }]}>
          커플이 다닌 맛집을 함께 기록해요
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing[40] }}>
        {step === 'choose' ? (
          <View style={{ gap: theme.spacing[12] }}>
            <Button title="방 만들기" onPress={() => setStep('select-mode')} />
            <Button title="초대코드 입력" variant="secondary" onPress={() => setStep('join')} />
          </View>
        ) : null}

        {step === 'select-mode' ? (
          <View style={{ gap: theme.spacing[12] }}>
            <Text variant="bodySm" color="fgWeak" style={styles.center}>
              어떻게 기록할까요?
            </Text>

            <Button
              title="혼자 기록할래요"
              loading={creating}
              onPress={() => handleCreate({ mode: ROOM_MODES.solo })}
            />
            <Button
              title="둘이 함께 기록할래요"
              loading={creating}
              onPress={() => handleCreate({ mode: ROOM_MODES.couple })}
            />

            {createError ? (
              <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[8] }]}>
                {createError}
              </Text>
            ) : null}

            <Button title="뒤로" variant="secondary" disabled={creating} onPress={goChoose} />
          </View>
        ) : null}

        {step === 'create-result' ? (
          <View style={{ gap: theme.spacing[16] }}>
            <Text variant="bodySm" color="fgWeak" style={styles.center}>
              상대에게 이 코드를 알려주세요
            </Text>

            <View
              style={[
                styles.codeBox,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.lg,
                  paddingVertical: theme.spacing[24],
                  paddingHorizontal: theme.spacing[16],
                },
              ]}
            >
              <Text variant="display" color="fg" style={styles.codeText}>
                {createdCode}
              </Text>
            </View>

            <Button
              title={copied ? '복사됨' : '코드 복사'}
              variant="secondary"
              onPress={handleCopy}
            />
            <Button title="방으로 가기" onPress={goToRoom} />
          </View>
        ) : null}

        {step === 'join' ? (
          <View style={{ gap: theme.spacing[12] }}>
            <Text variant="bodySm" color="fgWeak" style={styles.center}>
              받은 6자리 초대코드를 입력하세요
            </Text>

            <TextInput
              value={code}
              onChangeText={(t) => setCode(normalizeInviteCodeInput({ raw: t }))}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={INVITE_CODE_LENGTH}
              placeholder={'─'.repeat(INVITE_CODE_LENGTH)}
              placeholderTextColor={theme.color.fgMuted}
              editable={!joining}
              style={[
                styles.codeInput,
                theme.typography.h2,
                {
                  color: theme.color.fg,
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.lg,
                  paddingVertical: theme.spacing[16],
                },
              ]}
            />

            {joinError ? (
              <Text variant="bodySm" color="error" style={styles.center}>
                {joinError}
              </Text>
            ) : null}

            <Button
              title="입장"
              loading={joining}
              disabled={!isInviteCodeComplete({ code })}
              onPress={handleJoin}
            />
            <Button title="뒤로" variant="secondary" disabled={joining} onPress={goChoose} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  codeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { textAlign: 'center', letterSpacing: 8 },
  codeInput: {
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    letterSpacing: 8,
  },
});
