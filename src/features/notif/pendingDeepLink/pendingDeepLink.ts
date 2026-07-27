// src/features/notif/pendingDeepLink/pendingDeepLink.ts
// 대기 딥링크 큐 — 모듈 싱글턴(React 트리 밖에서도 접근). push-receive-ux plan §3.4.
//   왜 싱글턴: 알림 리스너가 AuthProvider/NavigationContainer보다 먼저 등록·발화할 수 있어(콜드스타트),
//   nav 준비 전 도착한 목적지를 트리 밖 상태에 보관했다가 authenticated+nav ready 시 소비해야 한다.
//   1건만 유지(최신 탭이 이전 대기 대체 — D4). 폴링/타이머 0(순수 상태).
import type { NotificationTarget } from '../notificationTarget';

// 대기 중인 목적지(최대 1건). null=대기 없음.
let pendingTarget: NotificationTarget | null = null;

/** 대기 목적지를 설정한다(이전 값 덮어씀 — 1건 큐). */
export const setPending = ({ target }: { target: NotificationTarget }): void => {
  pendingTarget = target;
};

/** 대기 목적지를 소비한다(반환 후 비움). 없으면 null. */
export const takePending = (): NotificationTarget | null => {
  const target = pendingTarget;
  pendingTarget = null;
  return target;
};

/** 대기 목적지를 비우지 않고 조회한다(존재 확인용). */
export const peekPending = (): NotificationTarget | null => pendingTarget;
