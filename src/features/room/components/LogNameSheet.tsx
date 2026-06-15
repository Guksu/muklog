// src/features/room/components/LogNameSheet.tsx
// 로그 이름 편집 시트(log-name, plan §4.2) — 프리젠테이션 전담. 킷 mk-log:91-102 재현.
//   공용 Sheet(상단 26 radius·핸들바·딤) + 단일 텍스트 입력(autoFocus·maxLength 20) + 힌트 + 저장(full·lg).
//   ⚠️ 검증/정규화/RPC 없음 — onSave에 입력 원문(draft)을 그대로 전달한다(정규화·서버 호출은 developer/서버).
//   입력 draft만 컴포넌트 로컬 state. open 전환 시 initialValue로 리셋한다.
//   색·radius·폰트는 토큰만(raw hex/숫자 색 0). 입력 보더만 킷 mk-log:95 "2px solid --mk-accent" 정합.
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { useTheme } from '@/theme';

// 길이 단일 출처(C-LEN) — DB rename_room NAME_TOO_LONG·logName.LOG_NAME_MAX_LENGTH(20)와 일치.
//   이 컴포넌트는 검증을 하지 않고 입력 차단(maxLength)만 한다.
const LOG_NAME_INPUT_MAX_LENGTH = 20;
// 킷 mk-log:95 입력 보더 = "2px solid var(--mk-accent)". 헤어라인이 아닌 강조 포커스 보더(편집 입력).
const INPUT_BORDER_WIDTH = 2;
// 킷 mk-log:95 입력 패딩 "14px 16px"(컨트롤 내부 수치, 4px 그리드 밖이라 토큰화 안 함).
const INPUT_PADDING_VERTICAL = 14;
const INPUT_PADDING_HORIZONTAL = 16;
// 킷 mk-log:95 입력 폰트 "600 17px/1" — SemiBold 17, lineHeight=size(ratio 1).
const INPUT_FONT_SIZE = 17;
// 킷 mk-log:97 힌트 이모지(💡) 크기.
const HINT_EMOJI_SIZE = 13;

export type LogNameSheetProps = {
  /** 표시 여부. false면 미렌더(Sheet가 children 마운트 안 함). */
  open: boolean;
  /** 입력 초기값. 이름 있으면 name, 없으면 빈 문자열(폴백은 placeholder로 노출). */
  initialValue: string;
  /** 비었을 때 보여줄 폴백명(displayLogName({ name: null, ... }) 결과 — developer 주입). */
  placeholder: string;
  /** 딤/요청 시 닫기. */
  onClose: () => void;
  /** 저장 탭 시 현재 입력 원문(draft)을 그대로 전달. 정규화·RPC는 호출자(developer). */
  onSave: (next: string) => void;
  /** 저장 진행 중. 버튼 로딩·비활성. */
  saving?: boolean;
  /** 인라인 에러 메시지(서버 NAME_TOO_LONG 등). 없으면 null/미전달. */
  error?: string | null;
};

export const LogNameSheet = ({
  open,
  initialValue,
  placeholder,
  onClose,
  onSave,
  saving = false,
  error = null,
}: LogNameSheetProps) => {
  const theme = useTheme();
  const [draft, setDraft] = React.useState(initialValue);

  // open이 열릴 때(또는 initialValue 변동 시) draft를 초기값으로 동기화한다.
  React.useEffect(function syncDraftOnOpen() {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  const handleSave = () => onSave(draft);

  const inputStyle = {
    borderColor: theme.color.primary,
    borderWidth: INPUT_BORDER_WIDTH,
    borderRadius: theme.radius.control,
    paddingVertical: INPUT_PADDING_VERTICAL,
    paddingHorizontal: INPUT_PADDING_HORIZONTAL,
    backgroundColor: theme.color.surface,
    color: theme.color.fg,
    fontSize: INPUT_FONT_SIZE,
    fontFamily: theme.typography.cardTitle.fontFamily,
  };

  return (
    <Sheet visible={open} onClose={onClose} title="로그 이름">
      <TextInput
        accessibilityLabel="로그 이름"
        value={draft}
        onChangeText={setDraft}
        maxLength={LOG_NAME_INPUT_MAX_LENGTH}
        autoFocus
        placeholder={placeholder}
        placeholderTextColor={theme.color.fgMuted}
        editable={!saving}
        style={[styles.input, inputStyle]}
      />

      {/* 힌트 — 킷 mk-log:96-99 (💡 + 안내 카피) */}
      <View style={[styles.hint, { marginTop: theme.spacing[10], marginHorizontal: theme.spacing[4] }]}>
        <Text style={{ fontSize: HINT_EMOJI_SIZE }}>💡</Text>
        <Text variant="sectionCaption" color="fgMuted">
          우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요.
        </Text>
      </View>

      {error ? (
        <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[12] }}>
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[16] }} />

      <Button
        accessibilityLabel="저장"
        title="저장"
        variant="primary"
        size="lg"
        full
        loading={saving}
        onPress={handleSave}
      />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: { width: '100%' },
  // 킷 mk-log:96 gap 6(💡↔텍스트).
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
