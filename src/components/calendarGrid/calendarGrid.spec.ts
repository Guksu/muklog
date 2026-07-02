// src/components/calendarGrid.spec.ts
// 캘린더 순수 유틸 단위 검증 — plan §6 T1(AC1.1~1.7). today 주입형이라 결정적.
//   ⚠ 본 유틸의 최종 소유는 developer(plan §4.3) — ui-publisher가 비주얼 셸 언블록용 초기본·기준 스위트를 제공.
//      developer가 케이스를 확장·하드닝할 수 있다(계약 시그니처는 유지).
import {
  buildMonthGrid,
  toISODate,
  parseISODate,
  isFutureDate,
  isToday,
  moveMonth,
} from './calendarGrid';

describe('calendarGrid — buildMonthGrid', () => {
  // AC1.1 — 2026-06(June, 0-idx 5). 6/1 = 월요일(getDay 1) → 선행 빈칸 1개 + 1..30.
  it('선행 빈칸(1일 요일 수) + 1..말일을 만든다', () => {
    const cells = buildMonthGrid({ year: 2026, month: 5 });
    expect(cells.length).toBe(1 + 30); // 빈칸 1 + 30일
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe(1);
    expect(cells[cells.length - 1]).toBe(30);
  });

  // AC1.6 — 윤년 경계.
  it('윤년 2월 말일=29, 평년 2월 말일=28', () => {
    const leap = buildMonthGrid({ year: 2024, month: 1 }).filter((c) => c !== null);
    const common = buildMonthGrid({ year: 2026, month: 1 }).filter((c) => c !== null);
    expect(leap[leap.length - 1]).toBe(29);
    expect(common[common.length - 1]).toBe(28);
  });
});

describe('calendarGrid — buildMonthGrid (요일 정렬 경계)', () => {
  // 1일이 일요일인 달은 선행 빈칸이 없다(startDow=0). 2026-03-01 = 일요일.
  it('1일이 일요일이면 선행 빈칸 0, 첫 셀=1', () => {
    const cells = buildMonthGrid({ year: 2026, month: 2 }); // 3월
    expect(cells[0]).toBe(1);
    expect(cells.filter((c) => c === null)).toHaveLength(0);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
  });

  // 12월(31일) 말일까지 끊김 없이 생성(연말 경계).
  it('12월 그리드 말일=31', () => {
    const days = buildMonthGrid({ year: 2026, month: 11 }).filter((c) => c !== null);
    expect(days[days.length - 1]).toBe(31);
  });
});

describe('calendarGrid — toISODate', () => {
  // AC1.2 — zero-pad, month+1.
  it('(2026,5,3) → "2026-06-03"', () => {
    expect(toISODate({ year: 2026, month: 5, day: 3 })).toBe('2026-06-03');
  });

  it('(2026,11,31) → "2026-12-31"', () => {
    expect(toISODate({ year: 2026, month: 11, day: 31 })).toBe('2026-12-31');
  });

  // 타임존 — 자정 경계일도 컴포넌트 그대로(UTC 시프트로 1일 당겨지지 않음). 순수 문자열 조합 보증.
  it('1월 1일이 전년 12월로 시프트하지 않는다(로컬 기준)', () => {
    expect(toISODate({ year: 2026, month: 0, day: 1 })).toBe('2026-01-01');
  });

  // round-trip: parseISODate(toISODate(x)) === x (월 0-11 보존).
  it('toISODate↔parseISODate round-trip 보존', () => {
    const input = { year: 2026, month: 0, day: 1 };
    expect(parseISODate({ iso: toISODate(input) })).toEqual(input);
  });
});

describe('calendarGrid — parseISODate', () => {
  // AC1.3 — 정상/실패.
  it('"2026-06-16" → {2026,5,16}', () => {
    expect(parseISODate({ iso: '2026-06-16' })).toEqual({ year: 2026, month: 5, day: 16 });
  });

  it('형식 불일치/비실재 → null', () => {
    expect(parseISODate({ iso: 'bad' })).toBeNull();
    expect(parseISODate({ iso: '' })).toBeNull();
    expect(parseISODate({ iso: '2026-13-99' })).toBeNull();
    expect(parseISODate({ iso: '2026-02-30' })).toBeNull();
  });
});

describe('calendarGrid — moveMonth', () => {
  // AC1.4 — 연 경계 래핑.
  it('(2026,0,-1) → 전년 12월 {2025,11}', () => {
    expect(moveMonth({ year: 2026, month: 0, delta: -1 })).toEqual({ year: 2025, month: 11 });
  });

  it('(2026,11,1) → 익년 1월 {2027,0}', () => {
    expect(moveMonth({ year: 2026, month: 11, delta: 1 })).toEqual({ year: 2027, month: 0 });
  });
});

describe('calendarGrid — isFutureDate / isToday (today 주입)', () => {
  const today = new Date(2026, 5, 16); // 2026-06-16 로컬 자정

  // AC1.5
  it('내일=true, 오늘=false, 어제=false', () => {
    expect(isFutureDate({ year: 2026, month: 5, day: 17, today })).toBe(true);
    expect(isFutureDate({ year: 2026, month: 5, day: 16, today })).toBe(false);
    expect(isFutureDate({ year: 2026, month: 5, day: 15, today })).toBe(false);
  });

  it('today의 시각 성분이 있어도 자정 기준으로 판정한다', () => {
    const noon = new Date(2026, 5, 16, 12, 30, 0);
    expect(isFutureDate({ year: 2026, month: 5, day: 16, today: noon })).toBe(false);
  });

  // AC1.7
  it('isToday: 같은 날=true, 다른 날=false', () => {
    expect(isToday({ year: 2026, month: 5, day: 16, today })).toBe(true);
    expect(isToday({ year: 2026, month: 5, day: 15, today })).toBe(false);
  });
});
