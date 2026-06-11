// src/features/muklog/formatVisitedDate.ts
// 방문일 표기 유틸 (plan §6.2). 'YYYY-MM-DD'(또는 ISO 선행 날짜)를 'YYYY.MM.DD'로 표기한다.
//   타임존 시프트 없이 선행 날짜 부분만 신뢰(표시 전용). null/형식 불일치 → '날짜 미정' fallback(데이터 결측 §9).

// 'YYYY-MM-DD'로 시작하는지 검사하는 정규식(선행 날짜 부분만 신뢰).
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** visitedAt 결측/형식 불일치 시 표기 fallback. */
export const VISITED_DATE_FALLBACK = '날짜 미정';

/**
 * 방문일 문자열을 'YYYY.MM.DD'로 표기한다(null/형식 불일치는 fallback).
 * @param visitedAt 'YYYY-MM-DD' 또는 null
 * @returns 'YYYY.MM.DD' 또는 '날짜 미정'
 */
export const formatVisitedDate = ({ visitedAt }: { visitedAt: string | null }): string => {
  if (visitedAt === null) return VISITED_DATE_FALLBACK;
  const matched = ISO_DATE_PREFIX.exec(visitedAt);
  if (matched === null) return VISITED_DATE_FALLBACK;
  const [, year, month, day] = matched;
  return `${year}.${month}.${day}`;
};
