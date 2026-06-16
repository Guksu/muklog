// src/features/room/ScheduledDeletionBanner.tsx
// 예약삭제 배너 — room-lifecycle(킷 비종속·기존 패턴 정합) (plan §4 예약삭제 배너).
//   LogScreen 헤더 아래·세그 위에 노출(노출 조건 deleteScheduledAt!=null은 developer가 게이팅).
//   presentational: countdownLabel(developer의 deletionCountdownLabel 결과)·isRequester(meId==deleteRequestedBy)·
//     onCancel(cancelRoomDeletion)을 props로 받는다. 데이터 계산·RPC 없음.
//   비주얼: SoloInviteBanner(mk-log:33-45) 약톤 카드 패턴 + status-negative 톤(negativeWeak 배경, plan §4).
//   스타일=토큰만(raw hex 0).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Button, Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

// 배너 카피(퍼블리싱 SSOT) — plan §4. label은 developer가 deletionCountdownLabel로 계산해 주입.
const REQUESTER_PREFIX = '이 로그는 ';
const OTHER_PREFIX = '상대가 로그에서 나가 ';
const COPY_SUFFIX = ' 예정이에요';
const CANCEL_LABEL = '삭제 취소';
const BANNER_ICON_SIZE = 18;

export type ScheduledDeletionBannerProps = {
  /** 카운트다운 문구(developer의 deletionCountdownLabel 결과). 예: "약 23시간 후 삭제" · "곧 삭제" · "삭제 처리 중". */
  countdownLabel: string;
  /** 나가기 요청자(meId == deleteRequestedBy)면 취소 버튼 노출. 상대면 안내만. */
  isRequester: boolean;
  /** "삭제 취소" 탭 — developer가 cancelRoomDeletion 실행을 연결(요청자만 호출 가능). */
  onCancel: () => void;
  /** 취소 진행 중(useCancelRoomDeletion.loading) — 버튼 비활성/로딩. */
  canceling?: boolean;
};

export const ScheduledDeletionBanner = ({
  countdownLabel,
  isRequester,
  onCancel,
  canceling = false,
}: ScheduledDeletionBannerProps) => {
  const theme = useTheme();
  const message = `${isRequester ? REQUESTER_PREFIX : OTHER_PREFIX}${countdownLabel}${COPY_SUFFIX}`;

  const banner: ViewStyle = {
    backgroundColor: theme.color.negativeWeak,
    borderRadius: theme.radius.sheet,
    paddingVertical: theme.spacing[12],
    paddingHorizontal: theme.spacing[14],
    gap: theme.spacing[10],
  };

  return (
    <View testID="scheduled-deletion-banner" style={[styles.banner, banner]}>
      <Icon name={IconName.CircleInfo} size={BANNER_ICON_SIZE} color="negative" />
      <Text variant="bodySm" color="fg" style={styles.message}>
        {message}
      </Text>
      {/* 취소 버튼 — 요청자만(상대는 이중 방어로 미노출). secondary(흰 pill)로 약톤 배경 위 가독·중립 액션. */}
      {isRequester ? (
        <Button
          title={CANCEL_LABEL}
          accessibilityLabel={CANCEL_LABEL}
          variant="secondary"
          size="sm"
          loading={canceling}
          disabled={canceling}
          onPress={onCancel}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center' },
  message: { flex: 1 },
});
