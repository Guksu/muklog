// src/components/SubBar.tsx
// 공용 서브 헤더 — 킷 mk-home.jsx:233-244 SubBar 재현 (FLAG-1·3·4 기반).
//   좌측: chevron-left IconButton(24) → onBack. 중앙(좌측정렬): 타이틀(700/17 = cardTitle, flex 1). 우측: right 슬롯.
//   킷 paddingTop=SP(상태바 확보) → RN insets.top + spacing[8](HomeHeader/LogScreen 동일 패턴)으로 동적 번역.
//   네이티브 스택 헤더 대신 이 컴포넌트를 화면 자체 헤더로 쓴다(developer가 headerShown:false 조정).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { IconName } from './Icon';
import { Text } from './Text';

export type SubBarProps = {
  /** 헤더 타이틀(좌측정렬). */
  title: string;
  /** 뒤로 버튼 탭 콜백. */
  onBack: () => void;
  /** 우측 슬롯(예: 저장 버튼). 생략 가능. */
  right?: React.ReactNode;
  /** 뒤로 버튼 접근성 라벨. 기본 '뒤로 가기'. */
  backLabel?: string;
};

export const SubBar = ({ title, onBack, right, backLabel = '뒤로 가기' }: SubBarProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.color.bg,
          // 킷 mk-home:235 paddingTop SP → insets.top + spacing[8]. left 8 / right 12 / bottom 8 / gap 4.
          paddingTop: insets.top + theme.spacing[8],
          paddingLeft: theme.spacing[8],
          paddingRight: theme.spacing[12],
          paddingBottom: theme.spacing[8],
          gap: theme.spacing[4],
        },
      ]}
    >
      <IconButton
        name={IconName.ChevronLeft}
        size={24}
        color="fg"
        accessibilityLabel={backLabel}
        onPress={onBack}
      />
      {/* 킷 mk-home:240 타이틀 700/17/1.3(cardTitle), flex 1 좌측정렬. */}
      <Text variant="cardTitle" color="fg" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
});
