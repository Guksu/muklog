// src/features/room/inviteShareFeedback/inviteShareFeedback.spec.ts
// 공유 시트 결과 → 토스트 판정 (invite-share U72, plan R3 — AC6 · 문구는 ui-spec §4-1 확정값).
//   RN Share 실물: iOS 보내기 완료 = sharedAction + activityType, 취소 = dismissedAction + null.
//   Android = 선택 화면을 연 직후 항상 sharedAction + null(보냈는지 알 수 없음 — Libraries/Share/Share.js·ShareModule.kt).
import {
  INVITE_SHARE_COPY,
  IOS_COPY_ACTIVITY_TYPE,
  resolveInviteShareFeedback,
} from './inviteShareFeedback';

// babel 변환을 피하려고 생성자로 만든다(유니코드 속성 이스케이프).
const PICTOGRAPHIC = new RegExp('\\p{Extended_Pictographic}', 'u');

describe('resolveInviteShareFeedback (AC6)', () => {
  it('iOS 보내기 완료(메시지 앱 등) → "초대 메시지를 보냈어요"(positive)', () => {
    expect(
      resolveInviteShareFeedback({
        action: 'sharedAction',
        activityType: 'com.apple.UIKit.activity.Message',
        platform: 'ios',
      }),
    ).toStrictEqual({ message: '초대 메시지를 보냈어요', tone: 'positive' });
  });

  it.each([null, undefined])('iOS 보내기 완료인데 activityType이 %j여도 보낸 것으로 본다', (activityType) => {
    expect(resolveInviteShareFeedback({ action: 'sharedAction', activityType, platform: 'ios' })).toStrictEqual({
      message: INVITE_SHARE_COPY.sent,
      tone: 'positive',
    });
  });

  it('iOS 공유 시트에서 "복사"를 고르면 → "초대 메시지를 복사했어요"(positive, 보냈다고 말하지 않음)', () => {
    expect(
      resolveInviteShareFeedback({ action: 'sharedAction', activityType: IOS_COPY_ACTIVITY_TYPE, platform: 'ios' }),
    ).toStrictEqual({ message: '초대 메시지를 복사했어요', tone: 'positive' });
  });

  it('iOS 취소(dismissedAction) → 무음(null)', () => {
    expect(resolveInviteShareFeedback({ action: 'dismissedAction', activityType: null, platform: 'ios' })).toBeNull();
  });

  it('Android는 항상 sharedAction이라 보냈는지 알 수 없다 → 무음(null)', () => {
    expect(resolveInviteShareFeedback({ action: 'sharedAction', activityType: null, platform: 'android' })).toBeNull();
  });

  it('모르는 action 값 → 무음(null)', () => {
    expect(resolveInviteShareFeedback({ action: 'unknownAction', activityType: null, platform: 'ios' })).toBeNull();
  });
});

describe('INVITE_SHARE_COPY · IOS_COPY_ACTIVITY_TYPE (ui-spec §4-1 확정)', () => {
  it('토스트 문구 5종이 확정값과 같다', () => {
    expect(INVITE_SHARE_COPY).toStrictEqual({
      sent: '초대 메시지를 보냈어요',
      messageCopied: '초대 메시지를 복사했어요',
      shareFailed: '공유하지 못했어요. 다시 시도해 주세요.',
      codeCopied: '초대코드를 복사했어요',
      codeCopyFailed: '초대코드를 복사하지 못했어요. 다시 시도해 주세요.',
    });
  });

  it('문구에 이모지가 없다(킷 HANDOFF 2026-06-30)', () => {
    expect(Object.values(INVITE_SHARE_COPY).filter((copy) => PICTOGRAPHIC.test(copy))).toStrictEqual([]);
  });

  it('iOS 복사 활동 식별자는 UIKit 상수 값이다', () => {
    expect(IOS_COPY_ACTIVITY_TYPE).toBe('com.apple.UIKit.activity.CopyToPasteboard');
  });
});
