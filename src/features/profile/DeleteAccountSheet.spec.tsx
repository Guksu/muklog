// src/features/profile/DeleteAccountSheet.spec.tsx
// 회원 탈퇴 확인 시트 — 파괴 확인 패턴(LeaveLogSheets/MuklogDetail danger 시트) 재사용 (plan §4, AC5).
//   되돌릴 수 없음 강조 카피 + danger "탈퇴하기" + ghost 취소. presentational(콜백만 발신).
//   open/close 오케스트레이션·deleteAccount 실행·성공 후 signOut 은 부모(ProfileScreen, developer 훅 소비).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { DeleteAccountSheet } from './DeleteAccountSheet';

const baseProps = {
  visible: false,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DeleteAccountSheet — 파괴 확인 시트', () => {
  it('visible=true면 제목/본문/되돌릴 수 없음 경고와 "탈퇴하기"·"취소"를 표시한다 (plan §4)', () => {
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible />);
    expect(screen.getByText('정말 탈퇴할까요?')).toBeTruthy();
    expect(screen.getByText(/계정과 내 정보가 삭제돼요/)).toBeTruthy();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
    expect(screen.getByText(/상대방에게 남아요/)).toBeTruthy();
    expect(screen.getByLabelText('탈퇴하기')).toBeTruthy();
    expect(screen.getByLabelText('취소')).toBeTruthy();
  });

  it('visible=false면 시트 내용을 렌더하지 않는다', () => {
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible={false} />);
    expect(screen.queryByText('정말 탈퇴할까요?')).toBeNull();
    expect(screen.queryByLabelText('탈퇴하기')).toBeNull();
  });

  it('"탈퇴하기"(danger) 탭 → onConfirm 콜백을 호출한다(deleteAccount 실행은 부모)', () => {
    const onConfirm = jest.fn();
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible onConfirm={onConfirm} />);
    fireEvent.press(screen.getByLabelText('탈퇴하기'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('"취소" 탭 → onClose 콜백을 호출한다', () => {
    const onClose = jest.fn();
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('취소'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteAccountSheet — 진행 중/에러 상태', () => {
  it('deleting=true면 danger 버튼이 비활성(busy)되어 중복 실행을 막는다', () => {
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible deleting />);
    const confirm = screen.getByLabelText('탈퇴하기');
    expect(confirm.props.accessibilityState.disabled).toBe(true);
    expect(confirm.props.accessibilityState.busy).toBe(true);
  });

  it('deleting=true면 danger 버튼을 눌러도 onConfirm을 호출하지 않는다(중복 방지)', () => {
    const onConfirm = jest.fn();
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible deleting onConfirm={onConfirm} />);
    fireEvent.press(screen.getByLabelText('탈퇴하기'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('error 메시지를 인라인으로 노출한다(재시도 가능, 세션 유지)', () => {
    renderWithTheme(
      <DeleteAccountSheet {...baseProps} visible error="탈퇴에 실패했어요. 다시 시도해 주세요." />,
    );
    expect(screen.getByText('탈퇴에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  it('error 없으면 에러 텍스트 슬롯을 렌더하지 않는다', () => {
    renderWithTheme(<DeleteAccountSheet {...baseProps} visible error={null} />);
    expect(screen.queryByTestId('delete-account-error')).toBeNull();
  });
});
