// src/features/room/deletionCountdownLabel.spec.ts
// 예약 삭제 카운트다운 라벨 유틸 — 경계값 명세 (plan §3.7·§5-1 T7).
import { deletionCountdownLabel } from './deletionCountdownLabel';

// 고정 기준 시각(테스트 결정성): 2026-06-16T00:00:00.000Z
const NOW = Date.parse('2026-06-16T00:00:00.000Z');
const hoursLater = ({ h, m = 0 }: { h: number; m?: number }): string =>
  new Date(NOW + h * 3_600_000 + m * 60_000).toISOString();

describe('deletionCountdownLabel', () => {
  it('23시간 30분 후 → "약 23시간 후 삭제" (floor)', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 23, m: 30 }), now: NOW })).toBe(
      '약 23시간 후 삭제',
    );
  });

  it('정확히 23시간 후 → "약 23시간 후 삭제"', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 23 }), now: NOW })).toBe(
      '약 23시간 후 삭제',
    );
  });

  it('정확히 1시간 후 → "약 1시간 후 삭제" (1h 경계는 미만 아님)', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 1 }), now: NOW })).toBe(
      '약 1시간 후 삭제',
    );
  });

  it('40분 후(1시간 미만) → "곧 삭제"', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 0, m: 40 }), now: NOW })).toBe(
      '곧 삭제',
    );
  });

  it('59분 후(1시간 미만 상한) → "곧 삭제"', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 0, m: 59 }), now: NOW })).toBe(
      '곧 삭제',
    );
  });

  it('정확히 0(now == scheduledAt) → "삭제 처리 중"', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 0 }), now: NOW })).toBe(
      '삭제 처리 중',
    );
  });

  it('이미 경과(-5분) → "삭제 처리 중"', () => {
    expect(deletionCountdownLabel({ scheduledAt: hoursLater({ h: 0, m: -5 }), now: NOW })).toBe(
      '삭제 처리 중',
    );
  });
});
