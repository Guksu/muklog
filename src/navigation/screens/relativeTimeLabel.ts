// src/navigation/screens/relativeTimeLabel.ts
// 상대시간 라벨 — 킷 mk-ui.jsx:256-265 agoLabel 동등(토스/당근식 '오늘·어제·N일 전·N주 전·N개월 전·N년 전').
//   카드 통계행 "마지막 기록 {상대시간}"(home-fidelity, plan AC3)에서 lastMuklogAt(전체 ISO timestamp|null) 표기.
//   킷 agoLabel은 date-only(00:00 고정) 입력이지만 lastMuklogAt는 시:분:초까지 있는 ISO라
//   일수 계산을 그대로 floor((now-then)/일) 로 이식(킷 임계값 7/28/365·나눗셈 7/30/365 보존).
//   now는 결정성을 위해 주입 가능(미주입 시 Date.now()). iso=null/파싱 불가는 빈 문자열(호출부가 폴백 처리).
//
// 경계 보정(킷 대비): 킷은 28일에서 floor(28/30)=0 → "0개월 전"이 나오는 약점이 있어
//   개월/년 라벨은 최소 1로 클램프(거짓스러운 "0개월/0년" 표기 회피). 그 외 임계·나눗셈은 킷과 동일.

const MS_PER_DAY = 86400000;

/**
 * ISO 시각을 기준 시각(now) 대비 상대시간 라벨로 변환한다.
 * @param iso 대상 시각(전체 ISO timestamp) | null
 * @param now 기준 시각(ISO 또는 epoch ms). 미지정 시 현재 시각.
 * @returns "오늘"·"어제"·"N일 전"·"N주 전"·"N개월 전"·"N년 전". iso 없음/파싱 실패 시 ''.
 */
export const relativeTimeLabel = ({ iso, now }: { iso: string | null; now?: string | number }): string => {
  if (iso === null || iso.length === 0) return '';

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const base = now === undefined ? Date.now() : new Date(now).getTime();
  if (Number.isNaN(base)) return '';

  const days = Math.floor((base - then) / MS_PER_DAY);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 28) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.max(1, Math.floor(days / 30))}개월 전`;
  return `${Math.max(1, Math.floor(days / 365))}년 전`;
};
