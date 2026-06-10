// src/navigation/screens/formatLogDate.spec.ts
// 로그 카드 생성일 표기 유틸 — ISO → 'YYYY.MM.DD'. (plan §4.5)
import { formatLogDate } from './formatLogDate';

describe('formatLogDate', () => {
  it("ISO(UTC, Z)를 'YYYY.MM.DD'로 표기한다", () => {
    expect(formatLogDate({ iso: '2026-06-10T00:00:00.000Z' })).toBe('2026.06.10');
  });

  it('오프셋 표기(+00:00) ISO도 날짜 부분으로 표기한다', () => {
    expect(formatLogDate({ iso: '2026-12-09T23:59:59+00:00' })).toBe('2026.12.09');
  });

  it('파싱 불가 입력이면 빈 문자열을 반환한다', () => {
    expect(formatLogDate({ iso: 'not-a-date' })).toBe('');
    expect(formatLogDate({ iso: '' })).toBe('');
  });
});
