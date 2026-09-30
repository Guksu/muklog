// src/components/InviteCodeCard/InviteCodeCard.tsx
// 초대코드 카드 — 킷 mk-home:290-303 InviteCodeCard 재현 + invite-share 이탈(U72, 사용자 승인 2026-09-30).
//   accent-weak(primaryWeak) 배경 + "초대코드" 라벨(accentStrong) + 대형 코드(letterSpacing 넓게) + 오른쪽 버튼 열.
//   버튼 열: "공유"(주 — 킷 복사 버튼 자리·프리미티브 그대로 primary sm, 아이콘만 share) 아래 "복사"(보조 — ghost sm, 킷 link 아이콘 승계).
//     킷 CreatedScreen의 "주 버튼 위 · ghost 아래" 쌓기(mk-home:281-283)를 sm 크기로 옮긴 배치다(ui-spec §2).
//   표현 전용 — 클립보드·공유 시트·토스트·타이머 없음. 동작은 onShare·onCopy로 올려 보내고 부모가 배선한다(useInviteShare).
//   두 버튼은 각각 접근성 요소다(카드 View에 accessible 금지 — iOS가 둘을 하나로 합쳐 읽는다).
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from '../Button';
import { IconName } from '../Icon';
import { Text } from '../Text';

const CODE_LETTER_SPACING = 4; // 킷 .18em 근사(대형 코드 가독)
const LABEL_LETTER_SPACING = 0.5; // 킷 .04em 근사

// 최소 터치 타깃 44pt 보정(QA QV-1) — Button sm 실높이 35(9 + 17 + 9, Button.tsx:35)에 세로 9를 더한다(킷 pad·비주얼 불변).
//   두 버튼 사이 간격 6(spacing[6])을 3/3으로 나눠 공유는 아래로, 복사는 위로 3씩만 넓힌다 — 두 터치 영역이 겹치지 않는다.
//   바깥쪽 6은 카드 안쪽 여백(기본 20 · compact 14) 안에 머문다. 가로는 0(코드 칸·카드 밖으로 번지지 않게).
//   ⚠️ 버튼 열 View는 레이아웃 전용으로 둔다(testID·배경 금지) — 새 아키텍처는 넘치는 자식이 없는 네이티브 뷰의 경계 밖 터치를
//   버려서, 버튼 열이 네이티브 뷰가 되면 공유 위·복사 아래로 넓힌 6이 잘린다(spec이 잠근다).
const SHARE_BUTTON_HIT_SLOP = { top: 6, bottom: 3, left: 0, right: 0 } as const;
const COPY_BUTTON_HIT_SLOP = { top: 3, bottom: 6, left: 0, right: 0 } as const;

export type InviteCodeCardProps = {
  /** 표시할 6자리 초대코드. */
  code: string;
  /** 컴팩트 모드(킷 mk-home:293 compact) — 이름 변경 다이얼로그 안에 중첩될 때 패딩 축소(14/16). 기본 false(20). */
  compact?: boolean;
  /** "공유"(주) 탭 — 부모가 초대 메시지 공유 시트로 배선한다(useInviteShare.shareInvite). */
  onShare: () => void;
  /** "복사"(보조) 탭 — 부모가 초대코드 복사 + 전역 토스트로 배선한다(useInviteShare.copyInviteCode). */
  onCopy: () => void;
};

export const InviteCodeCard = ({ code, compact = false, onShare, onCopy }: InviteCodeCardProps) => {
  const theme = useTheme();

  const card: ViewStyle = {
    backgroundColor: theme.color.primaryWeak,
    borderRadius: theme.radius.sheet,
    // 킷 mk-home:293 padding compact ? 14px16px : 20px.
    paddingVertical: compact ? theme.spacing[14] : theme.spacing[20],
    paddingHorizontal: compact ? theme.spacing[16] : theme.spacing[20],
    gap: theme.spacing[14],
  };

  return (
    <View style={[styles.card, card]}>
      <View style={styles.codeBlock}>
        {/* 킷 mk-home:297 라벨 700/12 accent-strong, letterSpacing .04em, marginBottom 7. */}
        <Text
          variant="badge"
          color="accentStrong"
          style={{ letterSpacing: LABEL_LETTER_SPACING, marginBottom: theme.spacing[7] }}
        >
          초대코드
        </Text>
        <Text variant="inviteCode" color="fg" style={{ letterSpacing: CODE_LETTER_SPACING }}>
          {code}
        </Text>
      </View>
      {/* 버튼 열 — 간격 6 = 킷 lg 쌓기 간격 10(패딩 16)을 sm 패딩 9에 비례 환산(10×9/16≈6, ui-spec §2-3). */}
      <View style={[styles.actions, { gap: theme.spacing[6] }]}>
        <Button
          title="공유"
          variant="primary"
          size="sm"
          leftIcon={IconName.Share}
          accessibilityLabel="초대 메시지 공유"
          hitSlop={SHARE_BUTTON_HIT_SLOP}
          onPress={onShare}
        />
        <Button
          title="복사"
          variant="ghost"
          size="sm"
          leftIcon={IconName.Link}
          accessibilityLabel="초대코드 복사"
          hitSlop={COPY_BUTTON_HIT_SLOP}
          onPress={onCopy}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  codeBlock: { flex: 1 },
  // 두 버튼을 같은 폭으로 세운다(열 폭 = 넓은 쪽 버튼) — 공유 알약 아래 복사 글자가 가운데 정렬된다.
  actions: { alignItems: 'stretch' },
});
