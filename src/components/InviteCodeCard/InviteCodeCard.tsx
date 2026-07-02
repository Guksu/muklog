// src/components/InviteCodeCard.tsx
// 초대코드 카드(복사) — mk-home InviteCodeCard 재현 (plan §6.2, AC1·AC2·C10).
//   accent-weak(primaryWeak) 배경 + "초대코드" 라벨(accentStrong) + 대형 코드(letterSpacing 넓게) + "복사" 버튼.
//   복사 버튼은 킷 mk-home InviteCodeCard(`leftIcon="link"`)대로 link 아이콘을 단다(assets/icons link 글리프 존재).
//   복사: expo-clipboard.setStringAsync(code)(네트워크 0, 권한 불필요). 성공 시 "복사됨" 2초 노출.
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/theme';

import { Button } from '../Button';
import { IconName } from '../Icon';
import { Text } from '../Text';

const COPIED_FEEDBACK_MS = 2000;
const CODE_LETTER_SPACING = 4; // 킷 .18em 근사(대형 코드 가독)
const LABEL_LETTER_SPACING = 0.5; // 킷 .04em 근사

export type InviteCodeCardProps = {
  /** 표시·복사할 6자리 초대코드. */
  code: string;
  /** 컴팩트 모드(킷 mk-home:220 compact) — 솔로배너 등 카드 안에 중첩될 때 패딩 축소(14/16). 기본 false(20). */
  compact?: boolean;
};

export const InviteCodeCard = ({ code, compact = false }: InviteCodeCardProps) => {
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
    // 킷 mk-home:220 padding compact ? 14px16px : 20px.
    paddingVertical: compact ? theme.spacing[14] : theme.spacing[20],
    paddingHorizontal: compact ? theme.spacing[16] : theme.spacing[20],
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
        <Text variant="inviteCode" color="fg" style={{ letterSpacing: CODE_LETTER_SPACING }}>
          {code}
        </Text>
      </View>
      {/* 복사 버튼 — 공용 Button(primary)로 통일(accentShadow 그림자 포함, plan B5). 킷 leftIcon="link". */}
      <Button
        title={copied ? '복사됨' : '복사'}
        variant="primary"
        size="sm"
        leftIcon={IconName.Link}
        accessibilityLabel="초대코드 복사"
        onPress={() => void handleCopy()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  codeBlock: { flex: 1 },
});
