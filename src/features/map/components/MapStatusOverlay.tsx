// src/features/map/components/MapStatusOverlay.tsx
// 지도 상태 오버레이 — 로딩/권한거부/빈/에러 안내의 비주얼만 (map-tab 슬라이스 1, plan §4 상태).
//   차단형 아님: 지도 위에 떠오르는 카드형 배너(지도 자체는 항상 유효 — plan §4 "차단 아님").
//   tone:
//     - loading: 스피너 + 메시지(지도 로드/핀 조회 중).
//     - info:    안내 메시지(권한거부 안내·빈상태). 스피너 없음.
//     - error:   에러 메시지 + 재시도 액션(actionLabel/onAction).
//   메시지·액션 라벨은 props로만 주입(카피·상태 판단은 developer/킷 정합 — 비즈니스 로직 없음).
//   킷 톤 정합: surface 카드 + 헤어라인 보더(떠 있는 안내라 그림자 md). radius.card.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components';
import { useTheme } from '@/theme';

// 오버레이 톤(enum-style 상수). loading=스피너, info=안내, error=재시도 가능.
export const MapStatusTone = {
  Loading: 'loading',
  Info: 'info',
  Error: 'error',
} as const;
export type MapStatusTone = (typeof MapStatusTone)[keyof typeof MapStatusTone];

export type MapStatusOverlayProps = {
  /** 안내 톤. 'loading'만 스피너 표시. */
  tone: MapStatusTone;
  /** 안내 문구(카피는 호출부/킷 정합). */
  message: string;
  /** 액션 버튼 라벨(예: "다시 시도"). 없으면 액션 미표시. */
  actionLabel?: string;
  /** 액션 버튼 탭 콜백(예: refresh). actionLabel과 함께 사용. */
  onAction?: () => void;
};

export const MapStatusOverlay = ({ tone, message, actionLabel, onAction }: MapStatusOverlayProps) => {
  const theme = useTheme();

  return (
    <View
      testID="map-status-overlay"
      pointerEvents="box-none"
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color.hairline,
          borderRadius: theme.radius.card,
          paddingVertical: theme.spacing[16],
          paddingHorizontal: theme.spacing[20],
          gap: theme.spacing[10],
        },
        theme.shadow.md,
      ]}
    >
      {tone === MapStatusTone.Loading ? (
        <ActivityIndicator testID="map-status-spinner" color={theme.color.primary} />
      ) : null}
      <Text variant="bodySm" color="fgWeak" style={styles.message}>
        {message}
      </Text>
      {actionLabel ? (
        <View testID="map-status-action">
          <Button title={actionLabel} variant="soft" size="sm" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 320,
  },
  message: { textAlign: 'center' },
});
