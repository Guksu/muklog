// src/features/room/LeaveLogSheets.spec.tsx
// 로그 나가기 메뉴 + 확인 시트(room-lifecycle, 킷 비종속) — MuklogDetail ⋯메뉴 + danger 확인 시트 패턴 재사용.
//   메뉴(단일 danger 행 "로그 나가기") / 확인 시트 카피 분기(커플=24h 유예 / 솔로=즉시 삭제).
//   open/close 오케스트레이션·leaveRoom RPC·성공 후 nav/refresh는 developer(이 컴포넌트는 presentational, 콜백만 발신).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LeaveLogSheets } from './LeaveLogSheets';

const baseProps = {
  menuVisible: false,
  confirmVisible: false,
  isCouple: true,
  onCloseMenu: jest.fn(),
  onSelectLeave: jest.fn(),
  onCloseConfirm: jest.fn(),
  onConfirmLeave: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LeaveLogSheets — ⋯ 메뉴', () => {
  it('menuVisible=true면 "로그 나가기"(danger) 메뉴 행을 표시한다 (MuklogDetail MenuRow 패턴)', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} menuVisible />);
    expect(screen.getByLabelText('로그 나가기')).toBeTruthy();
  });

  it('menuVisible=false면 메뉴 행이 없다', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} menuVisible={false} />);
    expect(screen.queryByLabelText('로그 나가기')).toBeNull();
  });

  it('"로그 나가기" 탭 → onSelectLeave 콜백을 호출한다(메뉴→확인 전환은 부모)', () => {
    const onSelectLeave = jest.fn();
    renderWithTheme(<LeaveLogSheets {...baseProps} menuVisible onSelectLeave={onSelectLeave} />);
    fireEvent.press(screen.getByLabelText('로그 나가기'));
    expect(onSelectLeave).toHaveBeenCalledTimes(1);
  });
});

describe('LeaveLogSheets — 나가기 확인 시트(카피 분기)', () => {
  it('커플(isCouple)이면 "로그에서 나갈까요?" + 24시간 유예 카피 + "나가기" danger 버튼 (plan §4 커플)', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} confirmVisible isCouple />);
    expect(screen.getByText('로그에서 나갈까요?')).toBeTruthy();
    expect(screen.getByText(/24시간 뒤 삭제/)).toBeTruthy();
    expect(screen.getByText(/취소할 수 있어요/)).toBeTruthy();
    expect(screen.getByLabelText('나가기')).toBeTruthy();
  });

  it('솔로(isCouple=false)면 "로그를 삭제할까요?" + 되돌릴 수 없어요 카피 + "삭제하기" danger 버튼 (plan §4 솔로)', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} confirmVisible isCouple={false} />);
    expect(screen.getByText('로그를 삭제할까요?')).toBeTruthy();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
    expect(screen.getByLabelText('삭제하기')).toBeTruthy();
    // 솔로 시트엔 24시간 유예 카피가 없다(즉시 삭제).
    expect(screen.queryByText(/24시간 뒤 삭제/)).toBeNull();
  });

  it('confirmVisible=false면 확인 시트가 없다', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} confirmVisible={false} />);
    expect(screen.queryByText('로그에서 나갈까요?')).toBeNull();
    expect(screen.queryByText('로그를 삭제할까요?')).toBeNull();
  });

  it('커플 확인 danger 버튼("나가기") 탭 → onConfirmLeave 호출 (leaveRoom 배선은 developer)', () => {
    const onConfirmLeave = jest.fn();
    renderWithTheme(
      <LeaveLogSheets {...baseProps} confirmVisible isCouple onConfirmLeave={onConfirmLeave} />,
    );
    fireEvent.press(screen.getByLabelText('나가기'));
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
  });

  it('솔로 확인 danger 버튼("삭제하기") 탭 → onConfirmLeave 호출', () => {
    const onConfirmLeave = jest.fn();
    renderWithTheme(
      <LeaveLogSheets
        {...baseProps}
        confirmVisible
        isCouple={false}
        onConfirmLeave={onConfirmLeave}
      />,
    );
    fireEvent.press(screen.getByLabelText('삭제하기'));
    expect(onConfirmLeave).toHaveBeenCalledTimes(1);
  });

  it('확인 시트 "취소"(ghost) 탭 → onCloseConfirm 호출', () => {
    const onCloseConfirm = jest.fn();
    renderWithTheme(
      <LeaveLogSheets {...baseProps} confirmVisible isCouple onCloseConfirm={onCloseConfirm} />,
    );
    fireEvent.press(screen.getByLabelText('취소'));
    expect(onCloseConfirm).toHaveBeenCalledTimes(1);
  });

  it('나가기 진행 중(leaving)이면 danger 버튼이 비활성이다', () => {
    renderWithTheme(<LeaveLogSheets {...baseProps} confirmVisible isCouple leaving />);
    expect(screen.getByLabelText('나가기').props.accessibilityState?.disabled).toBe(true);
  });

  it('나가기 실패(leaveError)면 확인 시트에 인라인 에러를 표시한다(재시도 가능)', () => {
    renderWithTheme(
      <LeaveLogSheets
        {...baseProps}
        confirmVisible
        isCouple
        leaveError="나가기에 실패했어요. 다시 시도해 주세요."
      />,
    );
    expect(screen.getByText('나가기에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
    // 시트 유지(취소·나가기 모두 노출).
    expect(screen.getByLabelText('취소')).toBeTruthy();
    expect(screen.getByLabelText('나가기')).toBeTruthy();
  });
});
