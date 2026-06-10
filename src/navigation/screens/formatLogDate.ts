// src/navigation/screens/formatLogDate.ts
// 로그 카드 생성일 표기 유틸 (plan §4.5). ISO 날짜의 'YYYY-MM-DD' 선행 부분만 사용해
// 타임존 시프트 없이 'YYYY.MM.DD'로 표기한다(표시 전용).

// 'YYYY-MM-DD'로 시작하는지 검사하는 정규식(선행 날짜 부분만 신뢰).
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * ISO 8601 날짜 문자열을 'YYYY.MM.DD'로 표기한다.
 * @param iso ISO 날짜 문자열(예: '2026-06-10T00:00:00.000Z')
 * @returns 'YYYY.MM.DD' (선행 날짜 파싱 실패 시 빈 문자열)
 */
export const formatLogDate = ({ iso }: { iso: string }): string => {
  const matched = ISO_DATE_PREFIX.exec(iso);
  if (matched === null) return '';
  const [, year, month, day] = matched;
  return `${year}.${month}.${day}`;
};
