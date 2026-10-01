// src/navigation/screens/JoinLogScreen.tsx
// 초대코드 입력 화면 — mk-home JoinScreen + CodeInput 재현 (plan §6.5, AC10–AC15).
//   6셀 코드 입력(정규화) → isInviteCodeComplete면 입장 활성 → joinRoom → refresh → 전역 토스트 + replace(LogScreen).
//   성공 시 전역 토스트 "로그에 들어왔어요"(킷 mk-home:232) — 루트 ToastProvider라 replace 후 LogScreen 위에서 표시.
//   실패 시 useJoinRoom.error(매핑 메시지)를 코드 입력 아래 인라인 에러로 표시(화면 유지, 토스트 없음).
//   이모지(💌) 허용(킷 정책). 스타일은 토큰만(raw hex 0).
//
// ux-entry-trust(U2) — 키보드가 다음 행동을 가리지 않게 하는 3종(비주얼·카피 변경 0):
//   ① keyboardShouldPersistTaps="handled" — 키보드가 떠 있어도 "들어가기" 첫 탭이 곧바로 입장에 쓰인다(첫 탭 소모 방지).
//   ② KeyboardAvoidingView — iOS는 padding으로 버튼을 밀어 올리고, Android는 네이티브 adjustResize에 맡긴다.
//   ③ 6자 완성 시 Keyboard.dismiss() — 완성 판정은 isInviteCodeComplete 단일 출처(길이 6 하드코딩 금지).
//   셀 탭 재포커스(CodeInput Pressable)는 코드를 고치려는 사용자의 복귀 수단이라 그대로 둔다.
//
// invite-share(U73·U24 ②) — 코드 칸 아래 "붙여넣기"·"지우기" 줄(CodeInputActions, ui-spec §3). 킷에 없는 요소(킷 침묵 영역).
//   CodeInput의 감싸는 Pressable 밖 형제로 둔다(코드 영역의 화면 읽기 항목은 입력란 하나 — code-input-a11y).
//   순서: 코드 칸 → 버튼 줄 → 안내·오류 문구 한 칸 → "들어가기"(킷 24 간격 유지). 버튼 줄이 문구 위라 문구가 떠도 버튼이 밀리지 않는다.
//   배선: 붙여넣기 = 누를 때만 클립보드 1회 읽기(readInviteCodeFromClipboard) → 코드면 통째 교체, 없으면 키보드를 내리고 입력 아래
//     안내(토스트 아님 — iOS 키보드가 하단 토스트를 가린다. 키보드를 내리는 이유는 handlePaste 주석). 지우기 = 비우고 숨김 입력란
//     포커스(키보드 다시 올림). 코드가 실제로 바뀌면 입장 실패 문구(useJoinRoom.clearError)와 붙여넣기 안내를 지운다(U24 ①).
//     붙여넣기는 입장을 자동 실행하지 않는다(시도 제한 10회/1시간 보호). 읽는 동안 다시 눌러도 한 번만 읽는다(진행 중 잠금).
//
// 생산자(소비): useJoinRoom(join_room RPC) + useMyLogsContext(refresh) + useToastController + useNavigation(replace).
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Screen, SubBar, Text, useToastController } from '@/components';
import {
  isInviteCodeComplete,
  readInviteCodeFromClipboard,
  useJoinRoom,
  useMyLogsContext,
} from '@/features/room';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../../routes';
import { CodeInput, resolveCodeCellRowWidth } from '../CodeInput';
import { CodeInputActions } from '../CodeInputActions';

const HEART_EMOJI = '💌';
// 붙여넣기 실패 안내(ui-spec §4-2 확정) — 같은 칸의 입장 실패 문구처럼 마침표로 끝난다.
const PASTE_NOT_FOUND_NOTICE = '복사한 글에서 초대코드를 찾지 못했어요.';

export const JoinLogScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { joinRoom, loading, error, clearError } = useJoinRoom();
  const myLogs = useMyLogsContext();
  // 입장 성공 피드백 — 전역 토스트(루트 단일 <Toast>). replace 후 LogScreen 위에서 표시(언마운트 무관).
  const { showToast } = useToastController();

  const [code, setCode] = React.useState('');
  // 붙여넣기 실패 안내(클립보드에 코드 없음). 입장 실패 문구와 같은 칸을 쓴다 — 표시 = pasteNotice ?? error.
  const [pasteNotice, setPasteNotice] = React.useState<string | null>(null);
  const complete = isInviteCodeComplete({ code });
  // "지우기" 뒤 키보드를 다시 올릴 때 쓰는 숨김 입력란 ref(CodeInput inputRef).
  const codeInputRef = React.useRef<TextInput>(null);
  // 붙여넣기 진행 중 잠금 — iOS 16+는 클립보드를 읽을 때마다 붙여넣기 허용 창을 띄우므로, 읽는 동안 또 눌러도 한 번만 읽어
  //   창이 두 번 뜨지 않게 한다(QA S6). 읽기는 허용·거부 모두 끝나므로(expo-clipboard ios/ClipboardModule.swift:14-17
  //   — 거부도 빈 문자열) 끝나면 finally에서 푼다. 동기 잠금이라 state 대신 ref(useInviteShare 선례). 타이머 0.
  const pastingRef = React.useRef(false);

  // 코드가 6자로 완성되는 순간 키보드를 내려 "들어가기"를 즉시 노출한다(재완성마다 반복).
  //   값이 실제로 바뀌면 이전 코드에 대한 입장 실패 문구·붙여넣기 안내를 지운다(U24 ①). 허용 안 되는 글자처럼
  //   값이 그대로인 변경은 문구를 남긴다(같은 코드는 같은 결과).
  const handleChangeCode = (next: string) => {
    if (next !== code) {
      clearError();
      setPasteNotice(null);
    }
    setCode(next);
    if (isInviteCodeComplete({ code: next })) Keyboard.dismiss();
  };

  // "붙여넣기" — 누를 때만 클립보드를 1회 읽는다(마운트·포커스 때 읽지 않음). 코드면 통째 교체(이미 채웠어도),
  //   없으면 입력은 그대로 두고 안내한다. 입장 중에는 버튼이 비활성이라 불리지 않는다(CodeInputActions disabled).
  const handlePaste = async () => {
    if (pastingRef.current) return;
    pastingRef.current = true;
    try {
      const pasted = await readInviteCodeFromClipboard();
      if (pasted === null) {
        setPasteNotice(PASTE_NOT_FOUND_NOTICE);
        // 안내가 실패의 유일한 피드백이다 — iPhone SE에서 추천 단어 줄·서드파티 키보드가 떠 있으면 안내 줄이 보이는 영역 밖이라
        //   키보드를 내린다(QA QV-2 ①, ui-spec §3-3). 성공(6자 완성) 때와 같은 동작이고, 다시 입력하려면 셀을 탭한다(기존 복귀 수단).
        Keyboard.dismiss();
        return;
      }
      // 찾았으니 "찾지 못했어요" 안내는 값이 같아도 지운다(입장 실패 문구는 값이 바뀔 때만 — handleChangeCode).
      setPasteNotice(null);
      handleChangeCode(pasted);
    } finally {
      pastingRef.current = false;
    }
  };

  // "지우기" — 6칸을 한 번에 비우고 키보드를 다시 올린다(6자 완성 때 내려갔으므로). 코드가 1자 이상일 때만 보인다.
  const handleClear = () => {
    handleChangeCode('');
    codeInputRef.current?.focus();
  };

  const handleJoin = async () => {
    // 제출하면 붙여넣기 안내는 끝난 이야기다 — 입장 결과(실패 문구)는 훅이 새로 세팅한다.
    setPasteNotice(null);
    try {
      const { roomId } = await joinRoom({ code });
      // 목록 갱신(+1/멱등) 후 그 로그로 replace(뒤로가기 시 코드 입력으로 안 돌아오게).
      await myLogs.refresh();
      // 킷 mk-home:232 성공 토스트(§4 토스트 이모지 제거). 전역이라 replace로 화면이 바뀌어도 LogScreen 위에서 유지된다.
      showToast({ message: '로그에 들어왔어요', tone: 'positive' });
      navigation.replace(Routes.LogScreen, { roomId });
    } catch {
      // useJoinRoom이 error(매핑 메시지)를 세팅 → 아래 인라인 에러로 표시. 화면 유지.
    }
  };

  const notice = pasteNotice ?? error;

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 킷 mk-home:226 SubBar "초대코드 입력"(좌측정렬). 네이티브 헤더는 AppNavigator에서 headerShown:false.
          'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 콘텐츠 paddingBottom+insets.bottom으로 인디케이터 클리어. */}
      <SubBar title="초대코드 입력" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        testID="join-kav"
        style={styles.avoider}
        // iOS만 padding — Android는 windowSoftInputMode(adjustResize)가 이미 처리해 이중 보정이 되면 레이아웃이 튄다.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          testID="join-scroll"
          keyboardShouldPersistTaps="handled"
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
            초대받은 로그에 들어가기
          </Text>
          <Text
            variant="body"
            color="fgWeak"
            style={[styles.center, { marginTop: theme.spacing[8], marginBottom: theme.spacing[28] }]}
          >
            {'받은 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요.'}
          </Text>

          <CodeInput value={code} onChangeText={handleChangeCode} inputRef={codeInputRef} />

          {/* 붙여넣기·지우기 — 코드 칸 아래 12(코드 칸과 한 묶음으로 읽히는 근접 간격, ui-spec §3-3).
              줄 폭 = 셀 줄 폭(가운데) — "지우기"가 기기 폭과 무관하게 셀 줄 끝(입력 끝)에 맞는다(QA QV-3). 좁은 화면은 콘텐츠 폭까지만.
              ⚠️ 레이아웃 전용으로 둔다(testID·배경 금지): 새 아키텍처는 넘치는 자식이 없는 네이티브 뷰의 경계 밖 터치를 버려,
              이 줄이 네이티브 뷰가 되면 버튼 위아래로 넓힌 터치 영역(hitSlop)이 잘린다(spec이 잠근다). */}
          <View
            style={[styles.codeActions, { marginTop: theme.spacing[12], width: resolveCodeCellRowWidth({ theme }) }]}
          >
            <CodeInputActions
              onPaste={() => void handlePaste()}
              onClear={handleClear}
              canClear={code.length > 0}
              disabled={loading}
            />
          </View>

          {/* 안내·오류 문구 한 칸(입장 실패 + 붙여넣기 실패 안내가 같이 쓴다 — 방금 누른 붙여넣기의 안내가 먼저). */}
          {notice ? (
            <Text variant="bodySm" color="error" style={[styles.center, { marginTop: theme.spacing[12] }]}>
              {notice}
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
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  // SubBar 아래 남은 높이를 KAV가 그대로 차지해야 ScrollView가 기존 레이아웃(패딩·insets)을 유지한다.
  avoider: { flex: 1 },
  content: { flexGrow: 1 },
  center: { textAlign: 'center' },
  // 셀 줄과 같은 가운데 축 · 콘텐츠보다 넓어지지 않게(셀 줄 폭보다 좁은 화면).
  codeActions: { alignSelf: 'center', maxWidth: '100%' },
});
