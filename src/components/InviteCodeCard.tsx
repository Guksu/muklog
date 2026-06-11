// src/components/InviteCodeCard.tsx
// 초대코드 카드(복사) — mk-home InviteCodeCard 재현 (plan §6.2, AC1·AC2·C10).
//   accent-weak(primaryWeak) 배경 + "초대코드" 라벨(accentStrong) + 대형 코드(letterSpacing 넓게) + "복사" 버튼.
//   ⚠️ D4: 아이콘셋에 link/copy 글리프 없음 → 복사 버튼은 텍스트 라벨("복사"). 텍스트 글리프 아이콘 금지(아이콘 위치 한정).
//   복사: expo-clipboard.setStringAsync(code)(네트워크 0, 권한 불필요). 성공 시 "복사됨" 2초 노출.
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/theme';

import { Text } from './Text';

const COPIED_FEEDBACK_MS = 2000;
const CODE_LETTER_SPACING = 4; // 킷 .18em 근사(대형 코드 가독)
const LABEL_LETTER_SPACING = 0.5; // 킷 .04em 근사

export type InviteCodeCardProps = {
  /** 표시·복사할 6자리 초대코드. */
  code: string;
};

export const InviteCodeCard = ({ code }: InviteCodeCardProps) => {
  const theme = useTheme();
  const [copied, setCopied] = React.useState(false);

  // 복사 성공 후 "복사됨"을 2초간 노출하고 자동 해제. 타이머는 명명 함수(컨벤션 §useEffect).
  React.useEffect(
    function clearCopiedFeedback() {
      if (!copied) return;
      const resetCopied = () => setCopied(false);
      const id = setTimeout(resetCopied, COPIED_FEEDBACK_MS);
      return function stopCopiedTimer() {
        clearTimeout(id);
      };
    },
    [copied],
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  const card: ViewStyle = {
    backgroundColor: theme.color.primaryWeak,
    borderRadius: theme.radius.sheet,
    padding: theme.spacing[20],
    gap: theme.spacing[14],
  };

  return (
    <View style={[styles.card, card]}>
      <View style={styles.codeBlock}>
        <Text
          variant="badge"
          color="accentStrong"
          style={{ letterSpacing: LABEL_LETTER_SPACING, marginBottom: theme.spacing[6] }}
        >
          초대코드
        </Text>
        <Text variant="h2" color="fg" style={{ letterSpacing: CODE_LETTER_SPACING }}>
          {code}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="초대코드 복사"
        onPress={() => void handleCopy()}
        style={({ pressed }) => [
          styles.copyButton,
          {
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.control,
            paddingVertical: theme.spacing[10],
            paddingHorizontal: theme.spacing[16],
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text variant="button" color="primaryFg">
          {copied ? '복사됨' : '복사'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  codeBlock: { flex: 1 },
  copyButton: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
});
