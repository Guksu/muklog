// src/features/appVersion/resolveVersionGate/resolveVersionGate.ts
// 버전 게이트 판정 순수 유틸 (app-version-gate plan §3.4).
//   생산자: useAppVersionGate(콜드스타트 1회 판정). 소비자: 게이트 상태(force 차단 / suggest 권유 / none).
//   원칙: 어느 비교라도 null(결측/형불량)이면 unknown = fail-open(앱을 막지 않음).
import { compareVersion } from '../compareVersion';

/** 게이트 판정 결과(enum-style 단일 출처). */
export const VersionGateDecision = {
  Force: 'force', // current < minSupported → 차단
  Suggest: 'suggest', // minSupported <= current < latest → 권유
  Ok: 'ok', // current >= latest
  Unknown: 'unknown', // 비교 불가(결측/형불량) → fail-open
} as const;
export type VersionGateDecision =
  (typeof VersionGateDecision)[keyof typeof VersionGateDecision];

/**
 * 현재 버전을 최소 지원·최신 버전과 비교해 게이트 판정을 낸다.
 *   current 결측 → unknown. current<min → force. min<=current<latest → suggest. current>=latest → ok.
 *   비교가 필요한데 결과가 null(형불량/결측)이면 unknown(fail-open).
 * @param current 현재 앱 버전(미확보 시 null)
 * @param minSupported 최소 지원 버전(null 가능)
 * @param latest 최신 버전(null 가능)
 * @returns force | suggest | ok | unknown
 */
export const resolveVersionGate = ({
  current,
  minSupported,
  latest,
}: {
  current: string | null;
  minSupported: string | null;
  latest: string | null;
}): VersionGateDecision => {
  if (current === null) return VersionGateDecision.Unknown;

  // 최소 지원 대비 — 비교 불가면 fail-open(dormant/오설정 안전판).
  const vsMin = minSupported === null ? null : compareVersion({ a: current, b: minSupported });
  if (vsMin === null) return VersionGateDecision.Unknown;
  if (vsMin === -1) return VersionGateDecision.Force;

  // 여기부터 current >= minSupported. 최신 대비 — 비교 불가면 suggest 미발화(unknown → fail-open).
  const vsLatest = latest === null ? null : compareVersion({ a: current, b: latest });
  if (vsLatest === null) return VersionGateDecision.Unknown;
  if (vsLatest === -1) return VersionGateDecision.Suggest;

  return VersionGateDecision.Ok;
};
