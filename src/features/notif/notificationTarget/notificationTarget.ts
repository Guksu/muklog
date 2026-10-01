// src/features/notif/notificationTarget/notificationTarget.ts
// 딥링크 목적지 결정 순수 유틸 (push-receive-ux plan §3.2). 앱 상태·SDK와 무관 — 단위 테스트 대상.
//   생산자: send-muklog-push 발송 payload data:{roomId, muklogId}(type 키 없음)
//           · send-join-push 발송 payload data:{type:'member_joined', roomId}(join-push U74).
//   소비자: usePushReceive → navigateToTarget. 라우트명/파라미터명은 Routes(routes.ts)와 정확히 일치(경계면 단일 출처).
//   모르는 type 은 기존 규칙(muklogId → 상세, roomId → 로그)으로 처리한다 — 출시본 1.3.0 은 type 을 보지 않고도
//   합류 알림을 roomId 로 로그 화면에 보낸다(이 해석기가 1.3.0 에 이미 있음).
import { Routes } from '@/navigation/routes';

/** 알림 data 의 type 값. 서버 _shared/pushDelivery.ts 의 PushDataType 과 같은 문자열이어야 한다(양쪽 테스트가 각각 잠근다). */
export const NotificationType = { MemberJoined: 'member_joined' } as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** 알림 탭 딥링크 목적지(판별 유니온). 라우트명은 Routes 리터럴에 바인딩 → AppStackParamList와 컴파일 타임 정합. */
export type NotificationTarget =
  | { screen: typeof Routes.MuklogDetail; params: { muklogId: string } }
  | { screen: typeof Routes.LogScreen; params: { roomId: string } };

/** 비어있지 않은 문자열만 유효 id로 인정(발송 폴백 ''·비문자열은 "없음"). */
const nonEmptyString = ({ value }: { value: unknown }): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * 수신 알림 data에서 딥링크 목적지를 결정한다(판정 불가 시 null).
 *   1) data가 객체가 아니면 null.
 *   2) type 이 member_joined(합류 알림)면 roomId 로 LogScreen(muklogId 는 무시), roomId 가 없으면 null.
 *   3) 그 밖(type 없음·모름)은 muklogId 비어있지 않으면 MuklogDetail(roomId 미전달, 자체 조회).
 *   4) 아니고 roomId 비어있지 않으면 LogScreen. 5) 둘 다 없으면 null(no-op).
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

  if (record.type === NotificationType.MemberJoined) {
    const joinedRoomId = nonEmptyString({ value: record.roomId });
    return joinedRoomId === null
      ? null
      : { screen: Routes.LogScreen, params: { roomId: joinedRoomId } };
  }

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
