// src/features/profile/profileStats.spec.ts
// 프로필 통계 3칸 순수 계산 명세 (plan §5 B3 / §5-1 ProfileScreen).
//   [로그 수=logs.length / 커플 로그=memberCount≥2 수 / 기록한 맛집=집계 미보유 → null("-")].
import { computeProfileStats, SPOT_COUNT_UNAVAILABLE } from './profileStats';

// 테스트용 MyLog 빌더(필요 필드만).
const makeLog = ({ memberCount }: { memberCount: number }) => ({
  roomId: `room-${memberCount}-${Math.floor(memberCount)}`,
  mode: 'solo' as const,
  memberCount,
  createdAt: '2026-01-01T00:00:00.000Z',
  joinedAt: '2026-01-01T00:00:00.000Z',
});

describe('computeProfileStats', () => {
  it('로그 2개(커플 1) → [logCount 2, spotCount null, coupleCount 1]', () => {
    const logs = [makeLog({ memberCount: 2 }), makeLog({ memberCount: 1 })];
    expect(computeProfileStats({ logs })).toEqual({
      logCount: 2,
      coupleCount: 1,
      spotCount: SPOT_COUNT_UNAVAILABLE,
    });
  });

  it('빈 로그 → [0, null, 0]', () => {
    expect(computeProfileStats({ logs: [] })).toEqual({
      logCount: 0,
      coupleCount: 0,
      spotCount: SPOT_COUNT_UNAVAILABLE,
    });
  });

  it('memberCount 3 이상도 커플로 집계(≥2 안전)', () => {
    const logs = [makeLog({ memberCount: 3 }), makeLog({ memberCount: 2 })];
    expect(computeProfileStats({ logs }).coupleCount).toBe(2);
  });

  it('맛집 수는 집계 미보유라 항상 null(차기 백엔드)', () => {
    expect(computeProfileStats({ logs: [makeLog({ memberCount: 1 })] }).spotCount).toBeNull();
    expect(SPOT_COUNT_UNAVAILABLE).toBeNull();
  });
});
