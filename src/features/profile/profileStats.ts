// src/features/profile/profileStats.ts
// 프로필 통계 3칸 순수 계산 (plan §5 B3 / profile-fidelity S5 §4).
//   보유 데이터(useMyLogs)만으로 산출: 로그 수 / 기록한 맛집 총합(Σ spotCount) / 커플 로그 수.
//   킷 mk-log.jsx:535·576 totalSpots = logs.reduce((s,l)=>s+l.spots,0) 재현 — MyLog.spotCount는 S2 집계 보유.
//   소비자: ProfileScreen 통계 카드 3칸(로딩 중에만 빈 배열로 0).
import { type MyLog } from '../room';

export type ProfileStats = {
  /** 내가 속한 로그 수(= logs.length). */
  logCount: number;
  /** 커플 로그 수(memberCount≥2). */
  coupleCount: number;
  /** 기록한 맛집 총합 — Σ myLogs.spotCount(킷 totalSpots). */
  spotCount: number;
};

/**
 * 내 로그 목록으로 프로필 통계 3칸을 계산한다(추가 쿼리 없음 — 보유 데이터만).
 * @param logs useMyLogs가 반환한 내 로그 목록
 * @returns 통계 3칸({ logCount, coupleCount, spotCount })
 */
export const computeProfileStats = ({ logs }: { logs: MyLog[] }): ProfileStats => ({
  logCount: logs.length,
  // mode 컬럼이 아니라 멤버 수에서 파생(plan 함정3 — 솔로/커플은 memberCount로 판정).
  coupleCount: logs.filter((log) => log.memberCount >= 2).length,
  // 킷 totalSpots: 각 로그의 맛집 수(spotCount, S2 집계)를 합산. 빈 배열 → 0.
  spotCount: logs.reduce((sum, log) => sum + log.spotCount, 0),
});
