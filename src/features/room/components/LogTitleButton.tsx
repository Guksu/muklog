// src/features/room/components/LogTitleButton.tsx
// LogScreen 헤더 제목 — 프리젠테이션 전담(display-only). 아바타 슬롯 + 로그명(navTitle) 표시.
//   ⚠️ 이름 변경은 ⋯메뉴 "로그 이름 변경"으로 이전(사용자 요청) — 타이틀은 탭 동작 없음(✏️ 제거).
//   데이터 없음: 아바타 스택은 avatarSlot 노드로, 표시명은 title prop으로 받는다(닉/커플/displayLogName 계산은 developer).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

export type LogTitleButtonProps = {
  /** 헤더에 표시할 로그명 — displayLogName(...) 결과(developer 주입). */
  title: string;
  /** 아바타 겹침 스택 노드(me/partner) — LogScreen이 Avatar 데이터로 구성해 주입. */
  avatarSlot?: React.ReactNode;
};

export const LogTitleButton = ({ title, avatarSlot }: LogTitleButtonProps) => {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing[8] }]}>
      {avatarSlot}
      <Text variant="navTitle" color="fg" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // flex 1, 아바타↔제목 가로 정렬(gap은 토큰), marginLeft 2, 세로 패딩 4(헤더 높이 유지).
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 2, paddingVertical: 4 },
  // 제목은 남는 폭을 차지하고 말줄임(ellipsis).
  title: { flexShrink: 1 },
});
