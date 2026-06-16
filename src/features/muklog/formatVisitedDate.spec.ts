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

  // T2 — withDow 확장 (date-picker, 킷 fmtDate(iso,true))
  it('withDow 미지정이면 기존대로 요일 없이 표기한다(회귀 — MkCard/Detail 불변)', () => {
    expect(formatVisitedDate({ visitedAt: '2026-06-16' })).toBe('2026.06.16');
    expect(formatVisitedDate({ visitedAt: '2026-06-16', withDow: false })).toBe('2026.06.16');
  });

  it("withDow:true → 'YYYY.MM.DD (요일)'로 표기한다 (2026-06-16=화)", () => {
    expect(formatVisitedDate({ visitedAt: '2026-06-16', withDow: true })).toBe('2026.06.16 (화)');
  });

  it('withDow:true도 요일을 로컬 기준으로 계산한다 (2026-02-14=토)', () => {
    expect(formatVisitedDate({ visitedAt: '2026-02-14', withDow: true })).toBe('2026.02.14 (토)');
  });

  it('null/형식불일치는 withDow:true여도 fallback 불변', () => {
    expect(formatVisitedDate({ visitedAt: null, withDow: true })).toBe(VISITED_DATE_FALLBACK);
    expect(formatVisitedDate({ visitedAt: 'oops', withDow: true })).toBe(VISITED_DATE_FALLBACK);
  });
});
