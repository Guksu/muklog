// src/navigation/AddSheet.tsx
// + 액션시트 — mk-home AddSheet/SheetAction 재현 (plan §6.3, AC6·AC7·AC8).
//   공용 Sheet 위 2개 행: "새 로그 만들기"(🥢) / "초대코드로 들어가기"(💌). 이모지 허용(킷 정책).
//   순수 프리젠테이션 — createRoom/navigate 등 부수효과는 부모(PlusHeaderButton)가 주입(onCreate/onJoin).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, IconName, MotionPressable, Sheet, Text } from '@/components';
import { useTheme } from '@/theme';

const ICON_BADGE_SIZE = 46;
// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.6;

export type AddSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** "새 로그 만들기" 선택. */
  onCreate: () => void;
  /** "초대코드로 들어가기" 선택. */
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
    borderRadius: theme.radius.action, // 킷 SheetAction radius 18(plan B5)
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
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      pressSize="lg"
      pressedOpacity={PRESSED_OPACITY}
      style={[styles.row, row]}
    >
      <View style={[styles.badge, badge]}>
        {/* 킷 mk-home:134 이모지 배지 fontSize 24. */}
        <Text style={styles.badgeEmoji}>{emoji}</Text>
      </View>
      <View style={styles.body}>
        <Text variant="cardTitle" color="fg">
          {title}
        </Text>
        <Text variant="bodySm" color="fgWeak" style={{ marginTop: theme.spacing[2] }}>
          {desc}
        </Text>
      </View>
      <Icon name={IconName.ChevronRight} size={18} color="fgAssistive" />
    </MotionPressable>
  );
};

export const AddSheet = ({ visible, onClose, onCreate, onJoin, creating }: AddSheetProps) => {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="어떻게 시작할까요?">
      <View style={{ gap: theme.spacing[10] }}>
        <SheetAction
          emoji="🥢"
          title="새 로그 만들기"
          desc="새로 시작하고 사람을 초대해요"
          onPress={onCreate}
          disabled={creating}
        />
        <SheetAction
          emoji="💌"
          title="초대코드로 들어가기"
          desc="받은 초대코드로 들어가요"
          onPress={onJoin}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  // 킷 SheetAction 보더 1px solid(mk-home:131) — hairlineWidth(~0.5)보다 또렷.
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 24 },
  body: { flex: 1 },
});
