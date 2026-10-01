// src/features/room/inviteShareFeedback/inviteShareFeedback.ts
// 초대 공유·복사 피드백 문구와 공유 시트 결과 판정 (invite-share U72·U23, plan §4.2 · AC6 — 문구는 ui-spec §4-1 확정).
//   RN Share 결과(0.76): iOS 보내기 완료 = sharedAction + activityType, 취소 = dismissedAction.
//     Android는 선택 화면을 연 직후 항상 sharedAction(보냈는지 알 수 없음) → 성공 토스트를 띄우지 않는다(거짓 피드백 방지).
import { Platform, Share } from 'react-native';

import type { ShowToastInput } from '@/components';

/** 초대 공유·복사 토스트 문구(해요체, 이모지 없음). 단일 출처. */
export const INVITE_SHARE_COPY = {
  sent: '초대 메시지를 보냈어요',
  messageCopied: '초대 메시지를 복사했어요',
  shareFailed: '공유하지 못했어요. 다시 시도해 주세요.',
  codeCopied: '초대코드를 복사했어요',
  codeCopyFailed: '초대코드를 복사하지 못했어요. 다시 시도해 주세요.',
} as const;

/** iOS 공유 시트의 "복사" 활동 식별자(UIActivityTypeCopyToPasteboard) — 보낸 것이 아니라 복사한 것이다. */
export const IOS_COPY_ACTIVITY_TYPE = 'com.apple.UIKit.activity.CopyToPasteboard';

const IOS_PLATFORM: typeof Platform.OS = 'ios';

/**
 * 공유 시트 결과를 보여 줄 토스트로 바꾼다.
 * @param action Share.share 결과 action(Share.sharedAction | Share.dismissedAction)
 * @param activityType iOS가 알려 준 고른 활동(없으면 null·undefined)
 * @param platform 현재 플랫폼(Platform.OS)
 * @returns 토스트 입력, 알리지 않을 결과(취소·Android·모르는 값)면 null
 */
export const resolveInviteShareFeedback = ({
  action,
  activityType,
  platform,
}: {
  action: string;
  activityType: string | null | undefined;
  platform: typeof Platform.OS;
}): ShowToastInput | null => {
  if (platform !== IOS_PLATFORM || action !== Share.sharedAction) return null;
  if (activityType === IOS_COPY_ACTIVITY_TYPE) return { message: INVITE_SHARE_COPY.messageCopied, tone: 'positive' };
  return { message: INVITE_SHARE_COPY.sent, tone: 'positive' };
};
