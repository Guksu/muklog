// src/features/map/components/LogPickerSheet.spec.tsx
// 대상 로그 선택 시트 — 킷 직접 시안 없음. 공용 Sheet(mk-ui:196) + 로그 행(이름 + MemberBadge + chevron) 조합.
//   로그 2+개일 때만 부모(MapTabScreen)가 열어 "어느 로그에 담을지" 고르게 한다(plan §4.1·T4).
//   데이터는 props로만(logs/onSelect). 로그 목록 소스·roomId 배선은 developer.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LogPickerSheet } from './LogPickerSheet';

const LOGS = [
  { roomId: 'r1', label: '민준 · 서연', memberCount: 2 },
  { roomId: 'r2', label: '나의 기록', memberCount: 1 },
];

describe('LogPickerSheet', () => {
  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(
      <LogPickerSheet visible={false} onClose={() => {}} logs={LOGS} onSelect={() => {}} />,
    );
    expect(screen.queryByText('민준 · 서연')).toBeNull();
  });

  it('기본 제목("어디에 담을까요?")과 로그별 행을 표시한다', () => {
    renderWithTheme(
      <LogPickerSheet visible onClose={() => {}} logs={LOGS} onSelect={() => {}} />,
    );
    expect(screen.getByText('어디에 담을까요?')).toBeTruthy();
    expect(screen.getByText('민준 · 서연')).toBeTruthy();
    expect(screen.getByText('나의 기록')).toBeTruthy();
  });

  it('멤버 수 배지(혼자/N명)를 로그마다 표시한다', () => {
    renderWithTheme(
      <LogPickerSheet visible onClose={() => {}} logs={LOGS} onSelect={() => {}} />,
    );
    expect(screen.getByText('2명')).toBeTruthy();
    expect(screen.getByText('혼자')).toBeTruthy();
  });

  it('로그 행을 탭하면 그 roomId로 onSelect를 호출한다', () => {
    const onSelect = jest.fn();
    renderWithTheme(
      <LogPickerSheet visible onClose={() => {}} logs={LOGS} onSelect={onSelect} />,
    );
    fireEvent.press(screen.getByTestId('log-picker-row-r1'));
    expect(onSelect).toHaveBeenCalledWith({ roomId: 'r1' });
  });

  it('title prop을 주면 기본 제목을 대체한다', () => {
    renderWithTheme(
      <LogPickerSheet
        visible
        onClose={() => {}}
        title="어느 로그에 담을까요?"
        logs={LOGS}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('어느 로그에 담을까요?')).toBeTruthy();
  });
});
