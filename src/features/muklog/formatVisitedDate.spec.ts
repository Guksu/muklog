// src/features/muklog/formatVisitedDate.spec.ts
// 방문일 표기 — 'YYYY-MM-DD'→'YYYY.MM.DD', null/형식불일치→fallback (plan §6.2, §9 데이터 결측).
import { formatVisitedDate, VISITED_DATE_FALLBACK } from './formatVisitedDate';

describe('formatVisitedDate', () => {
  it("'YYYY-MM-DD'를 'YYYY.MM.DD'로 표기한다", () => {
    expect(formatVisitedDate({ visitedAt: '2026-02-14' })).toBe('2026.02.14');
  });

  it('null이면 fallback을 반환한다', () => {
    expect(formatVisitedDate({ visitedAt: null })).toBe(VISITED_DATE_FALLBACK);
  });

  it('형식 불일치도 fallback으로 안전 처리한다', () => {
    expect(formatVisitedDate({ visitedAt: 'oops' })).toBe(VISITED_DATE_FALLBACK);
  });
});
