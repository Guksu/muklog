// src/features/notif/deepLinkRouter/deepLinkRouter.ts
// 딥링크 라우팅 디스패처 (push-receive-ux plan §3.4 T3 · §5 T5).
//   navigateToTarget: nav 준비됐으면 즉시 이동, 아니면 대기 큐 저장(콜드스타트/미인증 타이밍 가드).
//   consumePendingDeepLink: authenticated+nav ready 시점에 대기 목적지를 1회 소비·이동.
//   생산자: usePushReceive(수신 응답)·AuthGate onReady(nav ready 게이트). 소비자: navigationRef.navigate.
import { Routes } from '@/navigation/routes';
import { navigationRef } from '@/navigation/navigationRef';

import { setPending, takePending } from '../pendingDeepLink';
import type { NotificationTarget } from '../notificationTarget';

// 유니온 target을 라우트별로 좁혀 navigate(각 분기에서 screen↔params 쌍 타입이 정확히 맞물림). navigationRef는 SDK ref.
//   분기 본문이 같아 보여도, discriminated union은 분기 안에서만 screen과 params가 상관지어져 타입이 성립한다.
const navigateNow = ({ target }: { target: NotificationTarget }): void => {
  switch (target.screen) {
    case Routes.MuklogDetail:
      navigationRef.navigate(target.screen, target.params);
      return;
    case Routes.LogScreen:
      navigationRef.navigate(target.screen, target.params);
      return;
  }
};

/**
 * 목적지로 이동한다. nav 준비(=authenticated 트리 렌더) 시 즉시 navigate, 아니면 대기 큐에 저장(최신 1건).
 * @param target 딥링크 목적지
 */
export const navigateToTarget = ({ target }: { target: NotificationTarget }): void => {
  if (navigationRef.isReady()) {
    navigateNow({ target });
    return;
  }
  setPending({ target });
};

/**
 * 대기 중인 딥링크를 소비한다. nav 준비 전이면 no-op(큐 유지 — 다음 ready 시 재시도).
 *   authenticated 전이 + nav ready 시점에 호출(usePendingDeepLinkConsumer).
 */
export const consumePendingDeepLink = (): void => {
  if (!navigationRef.isReady()) return;
  const target = takePending();
  if (target === null) return;
  navigateNow({ target });
};
