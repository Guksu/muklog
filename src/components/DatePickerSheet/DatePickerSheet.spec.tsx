// src/components/DatePickerSheet.spec.tsx
// 공용 방문일 캘린더 시트 — 킷 mk-extra DatePickerSheet RN 번역.
//   프리젠테이션/상호작용 검증(plan §6 T3): 월 헤더·요일·선택 강조·월 이동·미래 disable·오늘 dot·선택/취소 콜백·방어/리셋.
//   today는 fake timer로 2026-06-16 고정 → 미래·오늘 판정 결정적. 날짜 계산은 calendarGrid(실제) 경유.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { DatePickerSheet } from './DatePickerSheet';

const noop = () => {};

describe('DatePickerSheet', () => {
  beforeAll(() => {
    // 오늘 = 2026-06-16(로컬). new Date()가 이 시점을 반환하도록 고정.
    jest.useFakeTimers({ now: new Date(2026, 5, 16, 9, 0, 0) });
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  // AC3.1 — value 월 헤더 + 선택 강조.
  it('visible·value=2026-02-14면 "2026년 2월" 헤더와 14일 셀을 선택 표시한다', () => {
    renderWithTheme(
      <DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={noop} />,
    );
    expect(screen.getByText('2026년 2월')).toBeTruthy();
    expect(screen.getByTestId('date-cell-14').props.accessibilityState.selected).toBe(true);
  });

  it('visible=false면 시트 내용을 렌더하지 않는다', () => {
    renderWithTheme(
      <DatePickerSheet visible={false} value="2026-02-14" onClose={noop} onSelect={noop} />,
    );
    expect(screen.queryByText('2026년 2월')).toBeNull();
    expect(screen.queryByText('방문일 선택')).toBeNull();
  });

  it('요일 헤더 7개(일~토)를 렌더한다', () => {
    renderWithTheme(<DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={noop} />);
    ['일', '월', '화', '수', '목', '금', '토'].forEach((dow) => {
      expect(screen.getByText(dow)).toBeTruthy();
    });
  });

  // 회귀 가드 — 날짜 그리드를 주(7열) 단위 행으로 분할 렌더해 토요일 열 줄바꿈을 방지한다.
  //   과거 버그: cell width '100/7%'(≈14.2857)×7 ≈ 100.0000001% + flexWrap → 7번째(토) 셀이 매주 줄바꿈,
  //   요일 헤더(flex:1 7열)와 어긋나 토요일 열이 비어 보임. 행 분할(각 셀 flex:1)로 회피.
  //   jest는 실제 레이아웃을 못 그리므로 "7열 행" 구조를 잠가 회귀를 막는다(시각 확인은 디바이스 스모크).
  it('날짜 그리드를 주 단위 행(각 7열)으로 분할 렌더한다 — 토요일 열 래핑 회귀 가드', () => {
    renderWithTheme(<DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={noop} />);
    // 2026-02는 일요일 시작·28일 → 정확히 4주.
    const rows = screen.getAllByTestId(/^date-week-/);
    expect(rows).toHaveLength(4);
    rows.forEach((row) => expect(row.props.children).toHaveLength(7));
    // 토요일(마지막 열) 날짜 2/7·14·21·28이 모두 존재.
    [7, 14, 21, 28].forEach((d) => expect(screen.getByTestId(`date-cell-${d}`)).toBeTruthy());
  });

  // AC3.2 — ‹ 월 이동, value 불변.
  it('이전 달 탭 → "2026년 1월"로 헤더가 바뀌고 onSelect는 호출되지 않는다', () => {
    const onSelect = jest.fn();
    renderWithTheme(
      <DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByTestId('date-prev'));
    expect(screen.getByText('2026년 1월')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  // AC3.3 — › 연 경계.
  it('12월에서 다음 달 탭 → "2027년 1월"(연도 +1)', () => {
    renderWithTheme(
      <DatePickerSheet visible value="2026-12-10" onClose={noop} onSelect={noop} />,
    );
    fireEvent.press(screen.getByTestId('date-next'));
    expect(screen.getByText('2027년 1월')).toBeTruthy();
  });

  // AC3.4 — 선택(미래 아님) → onSelect({date}) + onClose.
  it('미래 아닌 날짜 탭 → onSelect({date}) 1회 + onClose 호출', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    renderWithTheme(
      <DatePickerSheet visible value="2026-02-14" onClose={onClose} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByTestId('date-cell-10'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ date: '2026-02-10' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // AC3.5 — 미래일 disabled → onSelect 미호출.
  it('현재 월의 미래일 탭 → onSelect 미호출(disabled)', () => {
    const onSelect = jest.fn();
    renderWithTheme(
      <DatePickerSheet visible value="2026-06-01" onClose={noop} onSelect={onSelect} />,
    );
    const futureCell = screen.getByTestId('date-cell-20'); // today=16 → 20은 미래
    expect(futureCell.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(futureCell);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // AC3.6 — 오늘 dot(미선택 상태).
  it('오늘(미선택) 셀에 today dot이 있다', () => {
    renderWithTheme(
      <DatePickerSheet visible value="2026-06-01" onClose={noop} onSelect={noop} />,
    );
    expect(screen.getByTestId('date-today-dot')).toBeTruthy();
  });

  it('오늘이 선택된 상태면 dot을 숨긴다', () => {
    renderWithTheme(
      <DatePickerSheet visible value="2026-06-16" onClose={noop} onSelect={noop} />,
    );
    expect(screen.queryByTestId('date-today-dot')).toBeNull();
    expect(screen.getByTestId('date-cell-16').props.accessibilityState.selected).toBe(true);
  });

  // AC3.7 — 딤/취소 → onSelect 미호출.
  it('딤 배경 탭 → onClose 호출, onSelect 미호출', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    renderWithTheme(
      <DatePickerSheet visible value="2026-02-14" onClose={onClose} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // AC3.8 — 빈/형식불일치 value → 오늘 월 폴백, 크래시 없음.
  it('value="" → 오늘 월("2026년 6월")로 폴백 렌더', () => {
    renderWithTheme(<DatePickerSheet visible value="" onClose={noop} onSelect={noop} />);
    expect(screen.getByText('2026년 6월')).toBeTruthy();
  });

  it('value="2026-13-99"(비실재) → 오늘 월로 폴백', () => {
    renderWithTheme(<DatePickerSheet visible value="2026-13-99" onClose={noop} onSelect={noop} />);
    expect(screen.getByText('2026년 6월')).toBeTruthy();
  });

  // AC3.9 — 재오픈 시 표시 월이 value 월로 리셋(이전 월 이동 잔상 없음).
  it('월 이동 후 닫았다 다시 열면 value 월로 리셋한다', () => {
    const { rerender } = renderWithTheme(
      <DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={noop} />,
    );
    fireEvent.press(screen.getByTestId('date-next')); // 3월
    fireEvent.press(screen.getByTestId('date-next')); // 4월
    expect(screen.getByText('2026년 4월')).toBeTruthy();

    rerender(<DatePickerSheet visible={false} value="2026-02-14" onClose={noop} onSelect={noop} />);
    rerender(<DatePickerSheet visible value="2026-02-14" onClose={noop} onSelect={noop} />);
    expect(screen.getByText('2026년 2월')).toBeTruthy();
  });
});

// ── 프레스 부여 C1·C2·C3(motion-press-c T2 / ui-spec §2) ────────────────────────
//   seam = testID로 조회한 노드의 (a) flatten style의 transform/opacity 키 유무 (b) onSelect 발화.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §8-2 — 실값은 motion.spec가 잠갔다).
describe('DatePickerSheet — 월 네비·날짜 셀 눌림 피드백(motion-press-c C1·C2·C3)', () => {
  beforeAll(() => {
    // 오늘 = 2026-06-16(로컬) — 미래 셀(C3 P5) 판정을 결정적으로 만든다.
    jest.useFakeTimers({ now: new Date(2026, 5, 16, 9, 0, 0) });
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ testId }: { testId: string }) =>
    StyleSheet.flatten(screen.getByTestId(testId).props.style) as Record<string, unknown>;

  const renderSheet = ({ onSelect = noop }: { onSelect?: (arg: { date: string }) => void } = {}) => {
    renderWithTheme(
      <DatePickerSheet visible value="2026-06-16" onClose={noop} onSelect={onSelect} />,
    );
  };

  it('C1 이전 달 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-prev' }).transform).toBeDefined());
  });

  it('C1 이전 달 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-prev' }).opacity).toBeDefined());
    expect(flatten({ testId: 'date-prev' }).transform).toBeUndefined();
  });

  it('C2 다음 달 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-next' }).transform).toBeDefined());
  });

  it('C2 다음 달 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-next' }).opacity).toBeDefined());
    expect(flatten({ testId: 'date-next' }).transform).toBeUndefined();
  });

  it('C3 날짜 셀(과거) — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-cell-10' }).transform).toBeDefined());
  });

  it('C3 날짜 셀(과거) — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderSheet();
    await waitFor(() => expect(flatten({ testId: 'date-cell-10' }).opacity).toBeDefined());
    expect(flatten({ testId: 'date-cell-10' }).transform).toBeUndefined();
  });

  it('C3 미래 셀(disabled) — transform이 부착되지 않고 onSelect도 발화하지 않는다', () => {
    mockReduceMotion({ enabled: false });
    const onSelect = jest.fn();
    renderSheet({ onSelect });
    expect(flatten({ testId: 'date-cell-30' }).transform).toBeUndefined();
    fireEvent.press(screen.getByTestId('date-cell-30'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderSheet();
    expect(warn).not.toHaveBeenCalled();
  });
});
