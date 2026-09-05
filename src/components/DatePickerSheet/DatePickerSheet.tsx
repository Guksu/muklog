// src/components/DatePickerSheet.tsx
// 공용 방문일 캘린더 시트 — 킷 DatePickerSheet(mk-extra.jsx:68-126) RN 번역 (date-picker plan §4.2·§5).
//   기존 Sheet(하단 시트) 위에 월 네비 + 요일 헤더 + 6주 날짜 그리드(미래 disable·오늘 dot·선택 하이라이트)를 얹는다.
//   controlled: value(현재 선택 ISO)·visible은 부모 소유. 내부 상태는 표시 중인 월(view)뿐.
//   배선(setVisitedAt·시트 오픈 토글)·저장 계약은 developer 몫 — 여기선 비주얼 + onSelect/onClose 콜백만.
//
// 킷→RN 번역 근사(ui-spec 기록):
//   · 요일 색 일=#E5484D/토=#3B82F6 raw hex → color.calendarSun/calendarSat 전용 토큰(킷=SSOT).
//   · CSS grid repeat(7,1fr) gap 2 → flexWrap 행 + 셀 width 1/7 + padding(gap/2)로 2px 간격 근사.
//   · 날짜 계산(그리드·미래·오늘·월이동·ISO)은 calendarGrid 순수 유틸에 위임(plan §4.3, developer 소유).
//   · today는 new Date() 로컬 자정 절삭(킷 today.setHours(0,0,0,0)) — UTC 시프트 없음(plan §6/§7).
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

import {
  buildMonthGrid,
  isFutureDate,
  isToday,
  moveMonth,
  parseISODate,
  toISODate,
} from '../calendarGrid';
import { Icon, IconName } from '../Icon';
import { MotionPressable } from '../MotionPressable';
import { Sheet } from '../Sheet';
import { Text } from '../Text';

const SHEET_TITLE = '방문일 선택';

// 부여 판정: IconButton sm/0.6 승계(motion-press-c §2 C1·C2)
const NAV_ARROW_PRESSED_OPACITY = 0.6;
// 부여 판정: 46 아바타 sm/0.6 승계(motion-press-c §2 C3)
const DAY_CELL_PRESSED_OPACITY = 0.6;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const GRID_COLUMNS = 7;

// 킷 verbatim 레이아웃 수치(4px 그리드 밖 → 토큰화 안 함, RenameDialog 선례).
const CAL_LAYOUT = {
  navSize: 40, // 킷 ex.navArrow 40×40
  navIcon: 22, // 킷 chevron size 22
  navRowPadX: 4, // 킷 월 네비 padding "0 4px 12px"
  navRowPadBottom: 12,
  dowMarginBottom: 4, // 킷 요일 헤더 marginBottom 4
  dowPadV: 6, // 킷 요일 셀 padding "6px 0"(상·하 6) — 요일 행 수직 리듬

  cellGap: 2, // 킷 그리드 gap 2 → 셀 패딩 gap/2로 근사
  todayDot: 4, // 킷 오늘 dot 4×4
  todayDotBottom: 5, // 킷 dot bottom 5
} as const;

export type DatePickerSheetProps = {
  /** 시트 표시 여부(킷 open). false면 미렌더. */
  visible: boolean;
  /** 현재 선택값 'YYYY-MM-DD'. 초기 표시 월·선택 하이라이트 기준. 빈/형식불일치 → 오늘 월. */
  value: string;
  /** 딤 탭/취소/요청 시 닫기(선택 없이). */
  onClose: () => void;
  /** 날짜 선택 → date='YYYY-MM-DD' 전달(named-object). 호출 직후 onClose도 호출(킷 onSelect→onClose). */
  onSelect: ({ date }: { date: string }) => void;
};

// new Date() 로컬 자정(시각 성분 절삭) — 미래·오늘 판정 기준(킷 today.setHours(0,0,0,0)).
const localMidnightToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// 표시 시작 월 — value가 유효하면 그 월, 아니면 오늘 월(킷 init).
const monthFromValue = ({ value, today }: { value: string; today: Date }): { year: number; month: number } => {
  const parsed = parseISODate({ iso: value });
  if (parsed) return { year: parsed.year, month: parsed.month };
  return { year: today.getFullYear(), month: today.getMonth() };
};

export const DatePickerSheet = ({ visible, value, onClose, onSelect }: DatePickerSheetProps) => {
  const theme = useTheme();
  const today = localMidnightToday();
  const [view, setView] = useState(() => monthFromValue({ value, today }));

  // visible false→true 재오픈 시 표시 월을 value 월로 리셋(킷 useEffect([open]) — 이전 월 이동 잔상 제거).
  //   value/today는 의도적으로 deps에서 제외(킷과 동일하게 open 전환에만 반응).
  const resetMonthOnOpen = () => {
    if (visible) setView(monthFromValue({ value, today }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetMonthOnOpen, [visible]);

  const monthLabel = `${view.year}년 ${view.month + 1}월`;
  const cells = buildMonthGrid({ year: view.year, month: view.month });
  // 주(7칸) 단위 행으로 분할 — 각 셀 flex:1(요일 헤더와 동일 모델)로 7열 정렬 보장.
  //   width '14.285…%'+flexWrap은 7칸 누적이 100%를 초과(100/7×7≈100.0000001)해 토요일 칸이 줄바꿈됨 → 행 분할로 회피.
  //   마지막 주의 빈 칸은 null로 채워 열 정렬 유지.
  const weeks: (number | null)[][] = [];
  for (let start = 0; start < cells.length; start += GRID_COLUMNS) {
    const week = cells.slice(start, start + GRID_COLUMNS);
    while (week.length < GRID_COLUMNS) week.push(null);
    weeks.push(week);
  }

  const goPrevMonth = () => setView(moveMonth({ year: view.year, month: view.month, delta: -1 }));
  const goNextMonth = () => setView(moveMonth({ year: view.year, month: view.month, delta: 1 }));
  const selectDay = ({ day }: { day: number }) => {
    onSelect({ date: toISODate({ year: view.year, month: view.month, day }) });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      {/* 월 네비 — ‹ {YYYY년 M월} › */}
      <View style={styles.navRow}>
        <MotionPressable
          testID="date-prev"
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          onPress={goPrevMonth}
          pressSize="sm"
          pressedOpacity={NAV_ARROW_PRESSED_OPACITY}
          style={[styles.navArrow, { backgroundColor: theme.color.fillAlt }]}
        >
          <Icon name={IconName.ChevronLeft} size={CAL_LAYOUT.navIcon} color="fgWeak" />
        </MotionPressable>
        <Text variant="calendarMonth" color="fg">
          {monthLabel}
        </Text>
        <MotionPressable
          testID="date-next"
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          onPress={goNextMonth}
          pressSize="sm"
          pressedOpacity={NAV_ARROW_PRESSED_OPACITY}
          style={[styles.navArrow, { backgroundColor: theme.color.fillAlt }]}
        >
          <Icon name={IconName.ChevronRight} size={CAL_LAYOUT.navIcon} color="fgWeak" />
        </MotionPressable>
      </View>

      {/* 요일 헤더 — 일(빨강)·토(파랑)·평일(muted) */}
      <View style={styles.dowRow}>
        {WEEKDAYS.map((dow, index) => {
          const dowColor: ColorToken =
            index === 0 ? 'calendarSun' : index === GRID_COLUMNS - 1 ? 'calendarSat' : 'fgMuted';
          return (
            <Text key={dow} variant="calendarDow" color={dowColor} style={styles.dowCell}>
              {dow}
            </Text>
          );
        })}
      </View>

      {/* 날짜 그리드 — 주 단위 행(7열 flex:1), 선택=accent 배경/흰 글자, 오늘=dot, 미래=disabled */}
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} testID={`date-week-${weekIndex}`} style={styles.weekRow}>
            {week.map((cell, colIndex) => {
              if (cell === null) {
                return <View key={`blank-${weekIndex}-${colIndex}`} style={styles.cell} />;
              }
              const day = cell;
              const date = toISODate({ year: view.year, month: view.month, day });
              const selected = value === date;
              const future = isFutureDate({ year: view.year, month: view.month, day, today });
              const todayCell = isToday({ year: view.year, month: view.month, day, today });
              const strong = selected || todayCell;
              const dayColor: ColorToken = future ? 'fgDisabled' : selected ? 'primaryFg' : 'fg';
              return (
                <View key={date} style={styles.cell}>
                  <MotionPressable
                    testID={`date-cell-${day}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${monthLabel} ${day}일`}
                    accessibilityState={{ selected, disabled: future }}
                    disabled={future}
                    onPress={() => selectDay({ day })}
                    pressSize="sm"
                    pressedOpacity={DAY_CELL_PRESSED_OPACITY}
                    style={[styles.dayButton, selected ? { backgroundColor: theme.color.primary } : null]}
                  >
                    <Text variant={strong ? 'calendarDayStrong' : 'calendarDay'} color={dayColor}>
                      {day}
                    </Text>
                    {todayCell && !selected ? (
                      <View
                        testID="date-today-dot"
                        style={[styles.todayDot, { backgroundColor: theme.color.primary }]}
                      />
                    ) : null}
                  </MotionPressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* 킷 하단 여백 <div style={{height:10}}/> */}
      <View style={styles.bottomSpacer} />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CAL_LAYOUT.navRowPadX,
    paddingBottom: CAL_LAYOUT.navRowPadBottom,
  },
  navArrow: {
    width: CAL_LAYOUT.navSize,
    height: CAL_LAYOUT.navSize,
    borderRadius: CAL_LAYOUT.navSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dowRow: { flexDirection: 'row', marginBottom: CAL_LAYOUT.dowMarginBottom },
  dowCell: { flex: 1, textAlign: 'center', paddingVertical: CAL_LAYOUT.dowPadV },
  grid: {},
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, padding: CAL_LAYOUT.cellGap / 2 },
  dayButton: { flex: 1, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  todayDot: {
    position: 'absolute',
    bottom: CAL_LAYOUT.todayDotBottom,
    width: CAL_LAYOUT.todayDot,
    height: CAL_LAYOUT.todayDot,
    borderRadius: CAL_LAYOUT.todayDot / 2,
  },
  bottomSpacer: { height: 10 },
});
