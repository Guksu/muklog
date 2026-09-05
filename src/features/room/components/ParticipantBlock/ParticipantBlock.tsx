// src/features/room/components/ParticipantBlock.tsx
// 참여자 블록 — 킷 mk-log.jsx:79-103 재현 (plan §4.1, qa-visual 경계 §7-7).
//   "참여자 N · 최대 5명" 헤더 + 멤버 행(아바타46·meId=나 ring·닉 1줄 ellipsis·width50) + members<5면 dashed 초대 버튼.
//   presentational — 데이터는 props 주입(useRoomMembers 호출·RPC·클립보드·토스트 없음). 배선은 developer 2단계.
//
// 킷 매핑:
//   헤더 행(mk-log:82) alignItems baseline, gap 7, marginBottom 12 → "참여자 N"(800/14 mk-ink) + "· 최대 5명"(600/12 text-alternative)
//   멤버 행(mk-log:86) gap 16, flexWrap → 각 항목 width 50, column, gap 6: Avatar 46 ring={userId===meId} + 닉(600/12 mk-ink2, maxWidth50, 1줄 ellipsis, center)
//   초대 버튼(mk-log:93-100) canInvite일 때: dashed 원 46(accentLine 2px, radius full) + plus 20(accentStrong) + "초대"(700/12 accentStrong)
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, IconName, MotionPressable, Text } from '@/components';
import { defaultNickname } from '@/features/profile/defaultNickname';
import { useTheme } from '@/theme';

import { type RoomMember } from '../../logName';

export type ParticipantBlockProps = {
  /** 참여자 목록(joined_at asc). useRoomMembers.ready → members, 미로드/error → 상위에서 미렌더. */
  members: RoomMember[];
  /** 현재 사용자 uuid — "나" 판정(첫 항목 아닌 meId 매칭 멤버에 ring). */
  meId: string;
  /** 초대 버튼 노출 여부(= members.length < 5). false면 초대 버튼 숨김(만석). */
  canInvite: boolean;
  /** 초대 버튼 탭 콜백 — 클립보드 복사+토스트는 developer가 배선(초대코드는 상위 소유). */
  onInvite: () => void;
};

// 킷 mk-log:89 아바타 46 · mk-log:88/90 항목 width 50.
const AVATAR_SIZE = 46;
const ITEM_WIDTH = 50;
// 킷 mk-log:95-96 dashed 원 46 · plus 20.
const INVITE_PLUS_SIZE = 20;

// 부여 판정: 46 아바타 sm/0.6 승계 — 같은 행에 나란히 서는 46 컨트롤(motion-press-c §2 C7)
const INVITE_PRESSED_OPACITY = 0.6;

/** 멤버 표시 닉 — nickname 우선, null/빈이면 결정적 defaultNickname(userId) (킷 mk-log:90 폴백). */
const memberDisplayName = ({ member }: { member: RoomMember }): string =>
  member.nickname != null && member.nickname.trim().length > 0
    ? member.nickname
    : defaultNickname({ userId: member.userId });

export const ParticipantBlock = ({ members, meId, canInvite, onInvite }: ParticipantBlockProps) => {
  const theme = useTheme();

  return (
    <View
      testID="participant-block"
      style={{ paddingTop: theme.spacing[12], paddingHorizontal: theme.spacing[20], paddingBottom: theme.spacing[2] }}
    >
      {/* 헤더 — "참여자 N" + "· 최대 5명" (킷 mk-log:82-85). baseline 정렬, gap 7, marginBottom 12. */}
      <View style={[styles.header, { gap: theme.spacing[7], marginBottom: theme.spacing[12] }]}>
        <Text variant="participantHeader" color="fg">
          {`참여자 ${members.length}`}
        </Text>
        <Text variant="participantMeta" color="fgMuted">
          · 최대 5명
        </Text>
      </View>

      {/* 멤버 행 + 초대 버튼 — gap 16, flexWrap (킷 mk-log:86). */}
      <View style={[styles.row, { gap: theme.spacing[16] }]}>
        {members.map((member) => (
          <View key={member.userId} style={[styles.item, { gap: theme.spacing[6], width: ITEM_WIDTH }]}>
            <Avatar
              url={member.avatarUrl}
              userId={member.userId}
              nickname={member.nickname}
              size={AVATAR_SIZE}
              ring={member.userId === meId}
            />
            <Text variant="participantMeta" color="fgWeak" numberOfLines={1} style={styles.name}>
              {memberDisplayName({ member })}
            </Text>
          </View>
        ))}

        {canInvite ? (
          <MotionPressable
            testID="participant-invite"
            accessibilityRole="button"
            accessibilityLabel="참여자 초대"
            onPress={onInvite}
            pressSize="sm"
            pressedOpacity={INVITE_PRESSED_OPACITY}
            style={[styles.item, { gap: theme.spacing[6], width: ITEM_WIDTH }]}
          >
            <View
              style={[
                styles.inviteCircle,
                {
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: theme.radius.full,
                  borderColor: theme.color.accentLine,
                },
              ]}
            >
              <Icon name={IconName.Plus} size={INVITE_PLUS_SIZE} color="accentStrong" />
            </View>
            <Text variant="participantInvite" color="accentStrong" numberOfLines={1} style={styles.name}>
              초대
            </Text>
          </MotionPressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  item: { flexDirection: 'column', alignItems: 'center' },
  // 킷 mk-log:90 닉 maxWidth 50 · textAlign center · 1줄 ellipsis(numberOfLines=1 은 JSX prop).
  name: { maxWidth: ITEM_WIDTH, textAlign: 'center' },
  // 킷 mk-log:95 dashed 원 — 2px dashed accentLine. RN borderStyle 'dashed' + borderWidth 2.
  inviteCircle: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
