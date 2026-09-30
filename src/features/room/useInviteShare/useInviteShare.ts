// src/features/room/useInviteShare/useInviteShare.ts
// 초대 공유·복사 훅 (invite-share U72·U37·U23, plan §4.3 · AC5~AC9·AC23).
//
// 생산자: buildInviteMessage(메시지) + useAppStoreLinks → resolveInviteStoreUrl(링크 — 게이트 콜드스타트 조회 재사용).
//   외부: RN 코어 Share.share(OS 공유 시트, 네이티브 추가 0) · expo-clipboard setStringAsync · 전역 토스트(useToastController).
// 소비자: RoomCreatedRoute(축하 화면 카드) · LogScreen(참여자 "초대" · 솔로 이름 변경 다이얼로그 카드).
//
// 네트워크 0 — fetchAppConfig·supabase를 부르지 않는다. 타이머·리스너 0.
// 두 함수 모두 throw하지 않는다(실패는 토스트로 알린다) — 소비처는 `void`로 부른다.
// 공유 연타는 시간 창(SHARE_RETAP_WINDOW_MS)으로 막는다 — 공유 결과로 잠금을 풀지 않는다(iOS 완료 통지 누락, 아래 lastShareAtRef).
import { useRef } from 'react';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useToastController } from '@/components';
import { useAppStoreLinks } from '@/features/appVersion/appStoreLinks';

import { buildInviteMessage, resolveInviteStoreUrl } from '../inviteMessage';
import { INVITE_SHARE_COPY, resolveInviteShareFeedback } from '../inviteShareFeedback';

/**
 * 공유 연타를 막는 시간 창(ms) — 마지막으로 공유 시트를 연 뒤 이 시간 안의 재호출만 무시한다(1000ms째 누름부터 다시 연다).
 * 1000ms로 둔 이유:
 * - 막아야 하는 것: 시트가 화면을 덮기 전(누른 뒤 네이티브 시트 표시 애니메이션이 끝나기 전)에 들어오는 두 번째 탭. 시트가 뜬 뒤에는
 *   시트가 뒤쪽 버튼을 가려 탭이 닿지 않는다. Android는 선택 화면을 연 직후 결과가 와서, 결과로 잠금을 풀면 이 틈이 그대로 열린다.
 * - 막으면 안 되는 것: 시트를 닫고 다시 누르는 정상 재공유. 시트 표시·닫힘 애니메이션과 사람의 반응을 더하면 1초를 넘는다.
 * - 완료 통지가 끝내 오지 않아도(iOS — lastShareAtRef 주석) 1초 뒤에는 버튼이 다시 동작한다. 창을 늘리면 이 대기와 정상 재공유 차단이 함께 길어진다.
 */
const SHARE_RETAP_WINDOW_MS = 1000;

/**
 * 초대 메시지 공유(OS 공유 시트)와 초대코드 복사를 제공하는 훅.
 * @returns shareInvite({ code }) — 메시지 공유(직전 공유 1초 안의 재호출 무시, 결과·실패 토스트),
 *   copyInviteCode({ code }) — 6자 코드만 클립보드에 복사(성공·실패 토스트)
 */
export const useInviteShare = () => {
  const { showToast } = useToastController();
  const { storeUrlIos } = useAppStoreLinks();
  // 연타 가드 — 마지막으로 공유 시트를 연 시각(Date.now). 그 뒤 SHARE_RETAP_WINDOW_MS 안의 재호출만 무시한다(시간 창 잠금).
  //   동기 잠금이라 state 대신 ref다(useAddNearbyWish.submittingRef 선례). 누를 때 시각만 비교한다 — 타이머·리스너·AppState 0.
  //   공유 결과(promise)는 토스트에만 쓰고 잠금 해제에 쓰지 않는다. iOS는 완료 통지가 오지 않을 수 있기 때문이다:
  //   RN 0.76.9 React/CoreModules/RCTActionSheetManager.mm:262-268의 완료 처리기는 completed || activityType == nil일 때만 JS에 알린다.
  //   앱(메시지·카카오톡 등)을 고른 뒤 그 안에서 취소하면(completed NO · activityType 있음) 알림이 없고, 시트가 그대로 닫히면
  //   Share.share가 끝나지 않는다 — 결과로 잠금을 풀던 때는 그 화면을 다시 열 때까지 "공유"가 무시됐다(QA R1).
  const lastShareAtRef = useRef<number | null>(null);

  const shareInvite = async ({ code }: { code: string }): Promise<void> => {
    const now = Date.now();
    const lastShareAt = lastShareAtRef.current;
    // 창 안의 재호출은 무시한다. 시각이 거꾸로 흐르면(기기 시계 변경 — 경과 시간이 음수) 창이 지난 것으로 보고 연다.
    const withinRetapWindow = lastShareAt !== null && now >= lastShareAt && now - lastShareAt < SHARE_RETAP_WINDOW_MS;
    if (withinRetapWindow) return;
    // 연 시각만 기록한다 — 무시된 누름은 기록하지 않아 계속 눌러도 창이 늘어나지 않는다.
    lastShareAtRef.current = now;
    try {
      const message = buildInviteMessage({ code, storeUrl: resolveInviteStoreUrl({ storeUrlIos }) });
      // 메시지 하나만 넘긴다 — url을 따로 넘기면 iOS 일부 앱이 본문을 버린다(링크는 본문 안).
      //   Share.share를 호출 시점에 부른다(구조 분해 금지 — 테스트 대역이 spyOn으로 바꾼다).
      const result = await Share.share({ message });
      const feedback = resolveInviteShareFeedback({
        action: result.action,
        activityType: result.activityType,
        platform: Platform.OS,
      });
      if (feedback) showToast(feedback);
    } catch {
      showToast({ message: INVITE_SHARE_COPY.shareFailed, tone: 'neutral' });
    }
  };

  const copyInviteCode = async ({ code }: { code: string }): Promise<void> => {
    try {
      // 코드 6자만 복사한다(메시지 아님) — 받는 쪽은 입장 화면에 그대로 붙여넣는다.
      const copied = await Clipboard.setStringAsync(code);
      showToast(
        copied
          ? { message: INVITE_SHARE_COPY.codeCopied, tone: 'positive' }
          : { message: INVITE_SHARE_COPY.codeCopyFailed, tone: 'neutral' },
      );
    } catch {
      showToast({ message: INVITE_SHARE_COPY.codeCopyFailed, tone: 'neutral' });
    }
  };

  return { shareInvite, copyInviteCode };
};
