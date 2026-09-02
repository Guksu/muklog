// src/navigation/PlusHeaderButton.tsx
// HomeTabs 헤더 우측의 +버튼 (plan §6.3 / §5 T7). log-invite: 단일 생성 → 액션시트(AddSheet) 분기로 갱신.
//   + 탭 → AddSheet 오픈. "새 로그 만들기"/"초대코드로 들어가기" 두 행의 배선은 useStartLogFlow가 전담한다.
//     ⚠️ ux-entry-trust(U1): 생성 배선을 LogListScreen과 공유하는 훅으로 이관 — 경로마다 다른 결과(코드 노출/미노출)를 막는다.
//   creating(loading) 중 +버튼 비활성(중복 1차 방지). 시트 open/close 상태만 이 컴포넌트의 로컬 관심사.
//
// 생산자(소비): useStartLogFlow(createLog/goToJoin/creating).
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Icon, IconName, MotionPressable } from '@/components';
import { useTheme } from '@/theme';

// 눌렀을 때 도달할 불투명도 — 기존 눌림 스타일(opacity) 값 승계(비주얼 회귀 0).
const PRESSED_OPACITY = 0.6;

import { AddSheet } from '../AddSheet';
import { useStartLogFlow } from '../useStartLogFlow';

export const PlusHeaderButton = () => {
  const theme = useTheme();
  const { createLog, goToJoin, creating } = useStartLogFlow();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleCreate = () => {
    setSheetOpen(false);
    void createLog();
  };

  const handleJoin = () => {
    setSheetOpen(false);
    goToJoin();
  };

  return (
    <>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="로그 만들기"
        accessibilityState={{ disabled: creating, busy: creating }}
        disabled={creating}
        onPress={() => setSheetOpen(true)}
        hitSlop={theme.spacing[8]}
        pressSize="sm"
        pressedOpacity={PRESSED_OPACITY}
        // mk-home HomeHeader 재현: 액센트-weak 버블 배경 + 액센트 아이콘(원형 40 버블).
        style={[
          styles.button,
          { backgroundColor: theme.color.primaryWeak, borderRadius: theme.radius.full },
        ]}
      >
        {creating ? (
          <ActivityIndicator color={theme.color.accentStrong} />
        ) : (
          // 킷 IBTN: accent-strong(#1F4FE0) 아이콘 + accent-weak 버블.
          <Icon name={IconName.Plus} size={24} color="accentStrong" />
        )}
      </MotionPressable>

      <AddSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={handleCreate}
        onJoin={handleJoin}
        creating={creating}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
