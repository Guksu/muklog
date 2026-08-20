// src/features/map/components/LogPickerSheet.spec.tsx
// 대상 로그 선택 시트 — 킷 직접 시안 없음. 공용 Sheet(mk-ui:196) + 로그 행(이름 + MemberBadge + chevron) 조합.
//   로그 2+개일 때만 부모(MapTabScreen)가 열어 "어느 로그에 담을지" 고르게 한다(plan §4.1·T4).
//   데이터는 props로만(logs/onSelect). 로그 목록 소스·roomId 배선은 developer.
import React from 'react';
import { Gesture, type NativeGesture } from 'react-native-gesture-handler';
import { fireEvent, screen } from '@testing-library/react-native';

import { SHEET_DRAG_GESTURE_TEST_ID } from '@/components/Sheet';
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

  // 리스트 스크롤이 시트 드래그-dismiss에 뺏기지 않으려면 두 제스처의 우선순위 관계가 실제로 맺어져야 한다.
  //   훅 단독 테스트(Sheet.spec S1)는 "Sheet children 위치에서 부르면 된다"만 증명한다 —
  //   이 소비처가 정말 그 위치에서 부르는지는 여기서만 잡힌다(sheet-drag-rework QA L1).
  it('리스트 스크롤이 시트 드래그보다 우선하도록 제스처 관계를 맺는다', () => {
    const created: NativeGesture[] = [];
    const createNativeGesture = Gesture.Native;
    const nativeSpy = jest.spyOn(Gesture, 'Native').mockImplementation(() => {
      const gesture = createNativeGesture.call(Gesture);
      created.push(gesture);
      return gesture;
    });

    renderWithTheme(<LogPickerSheet visible onClose={() => {}} logs={LOGS} onSelect={() => {}} />);

    const blocked = created[0]?.config.blocksHandlers as
      | { current?: { config: { testId?: string } } }[]
      | undefined;
    // 개수까지 잠근다 — 블록 대상이 늘어나면 이 스크롤이 엉뚱한 제스처까지 기다리게 된다.
    expect(blocked).toHaveLength(1);
    expect(blocked?.[0]?.current?.config.testId).toBe(SHEET_DRAG_GESTURE_TEST_ID);
    nativeSpy.mockRestore();
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
