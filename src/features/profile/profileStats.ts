// src/features/profile/profileStats.ts
// 프로필 통계 3칸 순수 계산 (plan §5 B3 / 리더 결정 — 무백엔드 UI-only).
//   보유 데이터(useMyLogs)만으로 산출: 로그 수 / 커플 로그 수. "기록한 맛집" 총합은 집계 미보유 → null("-").
//   소비자: ProfileScreen 통계 카드 3칸. spotCount===null이면 화면이 "-" 플레이스홀더로 표기(차기 백엔드 §9).
import { type MyLog } from '../room';

/** 맛집 총합 집계 미보유 표식(차기 백엔드 스프린트에서 실값으로 교체). 화면은 이 값을 "-"로 렌더. */
export const SPOT_COUNT_UNAVAILABLE = null;

export type ProfileStats = {
  /** 내가 속한 로그 수(= logs.length). */
  logCount: number;
  /** 커플 로그 수(memberCount≥2). */
  coupleCount: number;
  /** 기록한 맛집 총합 — 이번 스프린트 집계 미보유(null="-"). */
  spotCount: number | null;
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
  spotCount: SPOT_COUNT_UNAVAILABLE,
});
