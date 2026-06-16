// src/components/calendarGrid.ts
// 캘린더 시트 순수 유틸 — 킷 DatePickerSheet(mk-extra.jsx:68-126)의 날짜 계산을 RN으로 번역 (plan §4.3 / T1).
//   월 그리드 생성·ISO 변환/파싱·미래·오늘·월 이동. 모두 순수 함수(부수효과 0) — today는 주입형으로 결정적 테스트.
//   ⚠ 경계: plan §2/§4.3은 본 유틸의 계산·T1 단위 스위트를 developer 소유로 둔다. 단 공용 프리미티브
//          DatePickerSheet가 직접 의존하므로 비주얼 셸 언블록을 위해 ui-publisher가 킷 충실 초기본을 제공한다.
//          developer가 T1 인수조건을 추가·하드닝하고 필요 시 정제한다(계약=아래 시그니처는 유지).
//   타임존: new Date(year, month, day) 로컬 생성자만 사용 — toISOString()/UTC 시프트 금지(plan §7).

/** 그리드 셀 한 칸: 날짜(1..말일) 또는 null(요일 정렬용 선행 빈칸). */
export type MonthCell = number | null;

/** 'YYYY-MM-DD' 형식만 허용하는 패턴(enum-style 상수). */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * 해당 월의 그리드 셀 배열: 선행 빈칸(1일의 요일 수만큼 null) + 1..말일.
 * month는 0-11(JS Date 기준). 킷 mk-extra:75-80과 동일.
 */
export const buildMonthGrid = ({ year, month }: { year: number; month: number }): MonthCell[] => {
  const startDow = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(day);
  return cells;
};

/** (year, month 0-11, day) → 'YYYY-MM-DD'(zero-pad, month+1). 킷 mk-extra:81. */
export const toISODate = ({ year, month, day }: { year: number; month: number; day: number }): string =>
  `${year}-${pad2(month + 1)}-${pad2(day)}`;

/**
 * 'YYYY-MM-DD' → { year, month(0-11), day }. 형식 불일치·비실재 날짜(2026-13-99·2026-02-30 등) → null.
 * 빈/잘못된 value 방어(plan §7) — round-trip 검증으로 실재성 확인.
 */
export const parseISODate = ({ iso }: { iso: string }): { year: number; month: number; day: number } | null => {
  const matched = ISO_DATE_PATTERN.exec(iso ?? '');
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]) - 1;
  const day = Number(matched[3]);
  const probe = new Date(year, month, day);
  const isReal =
    probe.getFullYear() === year && probe.getMonth() === month && probe.getDate() === day;
  return isReal ? { year, month, day } : null;
};

/**
 * (year, month, day)가 today(로컬 자정 기준)보다 미래인가. 킷 mk-extra:82(strict >).
 * today는 주입형 — 내부에서 로컬 자정으로 절삭해 시각 성분 영향 제거.
 */
export const isFutureDate = ({
  year,
  month,
  day,
  today,
}: {
  year: number;
  month: number;
  day: number;
  today: Date;
}): boolean => {
  const target = new Date(year, month, day).getTime();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return target > base;
};

/** (year, month, day)가 today와 같은 날인가. 킷 mk-extra:84. */
export const isToday = ({
  year,
  month,
  day,
  today,
}: {
  year: number;
  month: number;
  day: number;
  today: Date;
}): boolean =>
  today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

/** 월 이동(delta=±1) — 연 경계 래핑(0→11 전년, 11→0 익년). 킷 mk-extra:85. */
export const moveMonth = ({
  year,
  month,
  delta,
}: {
  year: number;
  month: number;
  delta: number;
}): { year: number; month: number } => {
  let nextMonth = month + delta;
  let nextYear = year;
  while (nextMonth < 0) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 11) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
};
