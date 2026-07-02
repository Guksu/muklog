// src/features/muklog/formatVisitedDate.ts
// 방문일 표기 유틸 (plan §6.2 / date-picker T2). 'YYYY-MM-DD'(또는 ISO 선행 날짜)를 'YYYY.MM.DD'로 표기한다.
//   타임존 시프트 없이 선행 날짜 부분만 신뢰(표시 전용). null/형식 불일치 → '날짜 미정' fallback(데이터 결측 §9).
//   withDow:true → 'YYYY.MM.DD (요일)'(킷 fmtDate(iso,true), 진입 행 표시용). 기본 false → 기존 호출부 불변.

// 'YYYY-MM-DD'로 시작하는지 검사하는 정규식(선행 날짜 부분만 신뢰).
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

// 요일 라벨(로컬 getDay 0=일..6=토). 킷 fmtDate(iso,true)의 ['일'..'토'] 정합.
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** visitedAt 결측/형식 불일치 시 표기 fallback. */
export const VISITED_DATE_FALLBACK = '날짜 미정';

/**
 * 방문일 문자열을 'YYYY.MM.DD'(또는 withDow:true면 'YYYY.MM.DD (요일)')로 표기한다.
 * null/형식 불일치는 fallback. 요일은 로컬 기준(UTC 시프트 없음).
 * @param visitedAt 'YYYY-MM-DD' 또는 null
 * @param withDow true면 요일 접미사 추가(기본 false — 기존 호출부 불변)
 * @returns 'YYYY.MM.DD' / 'YYYY.MM.DD (요일)' / '날짜 미정'
 */
export const formatVisitedDate = ({
  visitedAt,
  withDow = false,
}: {
  visitedAt: string | null;
  withDow?: boolean;
}): string => {
  if (visitedAt === null) return VISITED_DATE_FALLBACK;
  const matched = ISO_DATE_PREFIX.exec(visitedAt);
  if (matched === null) return VISITED_DATE_FALLBACK;
  const [, year, month, day] = matched;
  const base = `${year}.${month}.${day}`;
  if (!withDow) return base;
  // 로컬 자정 기준 요일(month는 0-11) — toISOString/UTC 미사용으로 시프트 방지.
  const dow = WEEKDAY_LABELS[new Date(Number(year), Number(month) - 1, Number(day)).getDay()];
  return `${base} (${dow})`;
};
