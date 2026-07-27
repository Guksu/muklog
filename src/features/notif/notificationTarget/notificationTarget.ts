// src/features/notif/notificationTarget/notificationTarget.ts
// 딥링크 목적지 결정 순수 유틸 (push-receive-ux plan §3.2). 앱 상태·SDK와 무관 — 단위 테스트 대상.
//   생산자: send-muklog-push 발송 payload data:{roomId, muklogId}(muklogId 없으면 '' 폴백).
//   소비자: usePushReceive → navigateToTarget. 라우트명/파라미터명은 Routes(routes.ts)와 정확히 일치(경계면 단일 출처).
import { Routes } from '@/navigation/routes';

/** 알림 탭 딥링크 목적지(판별 유니온). 라우트명은 Routes 리터럴에 바인딩 → AppStackParamList와 컴파일 타임 정합. */
export type NotificationTarget =
  | { screen: typeof Routes.MuklogDetail; params: { muklogId: string } }
  | { screen: typeof Routes.LogScreen; params: { roomId: string } };

/** 비어있지 않은 문자열만 유효 id로 인정(발송 폴백 ''·비문자열은 "없음"). */
const nonEmptyString = ({ value }: { value: unknown }): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * 수신 알림 data에서 딥링크 목적지를 결정한다(판정 불가 시 null).
 *   1) data가 객체가 아니면 null. 2) muklogId 비어있지 않으면 MuklogDetail(roomId 미전달, 자체 조회).
 *   3) 아니고 roomId 비어있지 않으면 LogScreen. 4) 둘 다 없으면 null(no-op).
 * @param data 알림 payload(Record<string, unknown> 기대, 비객체는 안전 흡수)
 * @returns NotificationTarget 또는 null
 */
export const resolveNotificationTarget = ({
  data,
}: {
  data: unknown;
}): NotificationTarget | null => {
  if (typeof data !== 'object' || data === null) return null;

  const record = data as Record<string, unknown>;

  const muklogId = nonEmptyString({ value: record.muklogId });
  if (muklogId !== null) {
    return { screen: Routes.MuklogDetail, params: { muklogId } };
  }

  const roomId = nonEmptyString({ value: record.roomId });
  if (roomId !== null) {
    return { screen: Routes.LogScreen, params: { roomId } };
  }

  return null;
};
