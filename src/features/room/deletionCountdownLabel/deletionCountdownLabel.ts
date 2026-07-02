// src/features/room/deletionCountdownLabel.ts
// 예약 삭제까지 남은 시간을 사람이 읽는 라벨로 변환 (plan §3.7·§5 T7, room-lifecycle).
//
// 생산자: rooms.delete_scheduled_at(예약 시각 ISO) ← leave_room/cancel_room_deletion.
// 소비자: LogScreen 예약삭제 배너("이 로그는 {라벨} 예정이에요" / "상대가 나가 {라벨} 예정이에요").
//
// 규칙(경계 포함):
//   - 남은 시간 ≤ 0(경과/동시각): "삭제 처리 중" (cron이 곧 처리).
//   - 0 < 남은 시간 < 1시간: "곧 삭제".
//   - 남은 시간 ≥ 1시간: "약 N시간 후 삭제" (N = floor(시간)).

const ONE_HOUR_MS = 3_600_000;

/**
 * 예약 삭제 시각과 현재 시각으로 카운트다운 라벨을 만든다.
 * @param scheduledAt 삭제 예약 시각(ISO 문자열, rooms.delete_scheduled_at)
 * @param now 현재 시각(epoch ms, 보통 Date.now())
 * @returns "약 N시간 후 삭제" | "곧 삭제" | "삭제 처리 중"
 */
export const deletionCountdownLabel = ({
  scheduledAt,
  now,
}: {
  scheduledAt: string;
  now: number;
}): string => {
  const remainingMs = Date.parse(scheduledAt) - now;

  if (remainingMs <= 0) return '삭제 처리 중';
  if (remainingMs < ONE_HOUR_MS) return '곧 삭제';

  const hours = Math.floor(remainingMs / ONE_HOUR_MS);
  return `약 ${hours}시간 후 삭제`;
};
