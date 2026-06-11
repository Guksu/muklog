// src/navigation/AddSheet.tsx
// + 액션시트 — mk-home AddSheet/SheetAction 재현 (plan §6.3, AC6·AC7·AC8).
//   공용 Sheet 위 2개 행: "새 로그 만들기"(🥢) / "초대코드로 입장"(💌). 이모지 허용(킷 정책).
//   순수 프리젠테이션 — createRoom/navigate 등 부수효과는 부모(PlusHeaderButton)가 주입(onCreate/onJoin).
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, IconName, Sheet, Text } from '@/components';
import { useTheme } from '@/theme';

const ICON_BADGE_SIZE = 46;

export type AddSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** "새 로그 만들기" 선택. */
  onCreate: () => void;
  /** "초대코드로 입장" 선택. */
  onJoin: () => void;
  /** 생성 진행 중 — 생성 행 비활성(중복 생성 1차 방지). */
  creating: boolean;
};

const SheetAction = ({
  emoji,
  title,
  desc,
  onPress,
  disabled,
}: {
  emoji: string;
  title: string;
  desc: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const theme = useTheme();
  const row: ViewStyle = {
    borderColor: theme.color.hairline,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surface,
    padding: theme.spacing[14],
    gap: theme.spacing[14],
    opacity: disabled ? 0.5 : 1,
  };
  const badge: ViewStyle = {
    width: ICON_BADGE_SIZE,
    height: ICON_BADGE_SIZE,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.primaryWeak,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, row, pressed && !disabled ? styles.pressed : null]}
    >
      <View style={[styles.badge, badge]}>
        <Text variant="h3">{emoji}</Text>
      </View>
      <View style={styles.body}>
        <Text variant="cardTitle" color="fg">
          {title}
        </Text>
        <Text variant="bodySm" color="fgWeak" style={{ marginTop: theme.spacing[2] }}>
          {desc}
        </Text>
      </View>
      <Icon name={IconName.ChevronRight} size={18} color="fgMuted" />
    </Pressable>
  );
};

export const AddSheet = ({ visible, onClose, onCreate, onJoin, creating }: AddSheetProps) => {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="무엇을 할까요?">
      <View style={{ gap: theme.spacing[10] }}>
        <SheetAction
          emoji="🥢"
          title="새 로그 만들기"
          desc="혼자 시작하고, 나중에 초대해요"
          onPress={onCreate}
          disabled={creating}
        />
        <SheetAction
          emoji="💌"
          title="초대코드로 입장"
          desc="연인이 보낸 6자리 코드 입력"
          onPress={onJoin}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  badge: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  pressed: { opacity: 0.6 },
});
