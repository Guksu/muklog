// src/features/profile/profileStats.spec.ts
// 프로필 통계 3칸 순수 계산 명세 (plan §5 B3 / §5-1 ProfileScreen).
//   [로그 수=logs.length / 커플 로그=memberCount≥2 수 / 기록한 맛집=Σ spotCount(킷 totalSpots)].
import { computeProfileStats } from './profileStats';

// 테스트용 MyLog 빌더(필요 필드만).
const makeLog = ({ memberCount, spotCount = 0 }: { memberCount: number; spotCount?: number }) => ({
  roomId: `room-${memberCount}-${spotCount}`,
  mode: 'solo' as const,
  memberCount,
  createdAt: '2026-01-01T00:00:00.000Z',
  joinedAt: '2026-01-01T00:00:00.000Z',
  name: null,
  deleteScheduledAt: null,
  deleteRequestedBy: null,
  previewPaths: [],
  spotCount,
  lastMuklogAt: null,
});

describe('computeProfileStats', () => {
  it('로그 2개(커플 1, 맛집 3+2) → [logCount 2, spotCount 5, coupleCount 1]', () => {
    const logs = [
      makeLog({ memberCount: 2, spotCount: 3 }),
      makeLog({ memberCount: 1, spotCount: 2 }),
    ];
    expect(computeProfileStats({ logs })).toEqual({
      logCount: 2,
      coupleCount: 1,
      spotCount: 5,
    });
  });

  it('빈 로그 → [0, 0, 0]', () => {
    expect(computeProfileStats({ logs: [] })).toEqual({
      logCount: 0,
      coupleCount: 0,
      spotCount: 0,
    });
  });

  it('memberCount 3 이상도 커플로 집계(≥2 안전)', () => {
    const logs = [makeLog({ memberCount: 3 }), makeLog({ memberCount: 2 })];
    expect(computeProfileStats({ logs }).coupleCount).toBe(2);
  });

  it('맛집 수는 Σ spotCount(킷 totalSpots = logs.reduce(+spots))', () => {
    const logs = [
      makeLog({ memberCount: 1, spotCount: 4 }),
      makeLog({ memberCount: 2, spotCount: 0 }),
      makeLog({ memberCount: 1, spotCount: 1 }),
    ];
    expect(computeProfileStats({ logs }).spotCount).toBe(5);
  });
});
