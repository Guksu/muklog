// src/features/room/components/LogTitleButton.tsx
// LogScreen 헤더 제목 버튼(log-name, plan §4.1 / 결정3) — 프리젠테이션 전담. 킷 mk-log:32-41 재현.
//   아바타 슬롯 + 제목(navTitle) + ✏️(pencil)을 하나의 탭 가능 버튼으로 묶는다(탭 → onEdit = 이름 편집 시트).
//   ⚠️ 데이터 없음: 아바타 스택은 avatarSlot 노드로, 표시명은 title prop으로 받는다(닉/커플/displayLogName 계산은 developer).
//   기존 LogScreen 헤더 inner row(styles.headerMain: flex 1, gap 8, marginLeft 2)를 이 버튼이 대체한다.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

// 킷 mk-log:40 ✏️ 크기 15.
const PENCIL_SIZE = 15;

export type LogTitleButtonProps = {
  /** 헤더에 표시할 로그명 — displayLogName(...) 결과(developer 주입). */
  title: string;
  /** 탭 시 호출 — 이름 편집 시트 open(developer 배선). */
  onEdit: () => void;
  /** 아바타 겹침 스택 노드(me/partner) — LogScreen이 Avatar 데이터로 구성해 주입. */
  avatarSlot?: React.ReactNode;
};

export const LogTitleButton = ({ title, onEdit, avatarSlot }: LogTitleButtonProps) => {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="로그 이름 편집"
      onPress={onEdit}
      style={({ pressed }) => [
        styles.button,
        { gap: theme.spacing[8] },
        pressed ? styles.pressed : null,
      ]}
    >
      {avatarSlot}
      <Text variant="navTitle" color="fg" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {/* 킷 mk-log:40 — color var(--text-assistive) → fgAssistive. */}
      <Icon name={IconName.Pencil} size={PENCIL_SIZE} color="fgAssistive" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // 킷 mk-log:32 — flex 1, 아바타↔제목↔✏️ 가로 정렬(gap은 토큰), marginLeft 2, 세로 패딩 4.
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 2, paddingVertical: 4 },
  // 킷 mk-log:37 — 제목은 남는 폭을 차지하고 말줄임(ellipsis).
  title: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});
