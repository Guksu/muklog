// src/navigation/screens/CodeInput.tsx
// 6셀 초대코드 입력 — mk-home CodeInput 재현 (plan §6.5, AC10·C6).
//   숨김 TextInput(실 입력) + 6개 시각 셀(글자별). 입력은 normalizeInviteCodeInput로 정규화(자체 정규식 재작성 금지, C6).
//   현재 입력 위치 셀을 하이라이트(accent 보더 + accentWeak 글로우). 스타일은 토큰만(raw hex 0).
import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { INVITE_CODE_LENGTH, normalizeInviteCodeInput } from '@/features/room/code';
import { useTheme } from '@/theme';

import { Text } from '@/components';

const CELL_WIDTH = 46;
const CELL_HEIGHT = 56;
const GLOW_WIDTH = 4;

export type CodeInputProps = {
  /** 정규화된 현재 코드 값. */
  value: string;
  /** 정규화된 새 값. 부모가 그대로 setState 한다. */
  onChangeText: (next: string) => void;
};

export const CodeInput = ({ value, onChangeText }: CodeInputProps) => {
  const theme = useTheme();
  const inputRef = React.useRef<TextInput>(null);

  const cells = Array.from({ length: INVITE_CODE_LENGTH });

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      {/* 숨김 실 입력 — 정규화 후 부모에 전달. autoCapitalize/autoCorrect로 입력 품질 보강. */}
      <TextInput
        testID="code-hidden-input"
        ref={inputRef}
        value={value}
        onChangeText={(raw) => onChangeText(normalizeInviteCodeInput({ raw }))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        maxLength={INVITE_CODE_LENGTH}
        style={styles.hiddenInput}
      />
      <View style={[styles.row, { gap: theme.spacing[8] }]}>
        {cells.map((_, index) => {
          const ch = value[index] ?? '';
          const isActive = index === value.length;
          const filled = ch.length > 0;
          const cell: ViewStyle = {
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
            borderRadius: theme.radius.control,
            backgroundColor: theme.color.surface,
            borderWidth: 2,
            // 킷: 비활성 셀 보더 --line(hairline). 채움/활성만 accent(plan B5).
            borderColor: filled || isActive ? theme.color.primary : theme.color.hairline,
          };
          const glow: ViewStyle = isActive
            ? {
                shadowColor: theme.color.primaryWeak,
                shadowOpacity: 1,
                shadowRadius: GLOW_WIDTH,
                shadowOffset: { width: 0, height: 0 },
                elevation: 2,
              }
            : {};
          return (
            <View key={`code-cell-${index}`} testID={`code-cell-${index}`} style={[styles.cell, cell, glow]}>
              {/* 킷 셀 글자 lineHeight 1 — 셀 내 수직 중앙 정렬 보정. */}
              <Text variant="h2" color="fg" style={styles.cellChar}>
                {ch}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  cellChar: { lineHeight: 24 },
});
