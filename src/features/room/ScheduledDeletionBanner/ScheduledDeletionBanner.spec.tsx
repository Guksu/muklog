// src/features/room/ScheduledDeletionBanner.spec.tsx
// 예약삭제 배너(room-lifecycle, 킷 비종속·기존 패턴 정합) — plan §4.
//   요청자: "이 로그는 {label} 예정이에요" + "삭제 취소" 버튼. 상대: "상대가 로그에서 나가 {label} 예정이에요"(버튼 없음).
//   배너 자체의 노출 조건(deleteScheduledAt!=null)·label 계산·취소 RPC는 developer(이 컴포넌트는 presentational).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { ScheduledDeletionBanner } from './ScheduledDeletionBanner';

const onCancel = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScheduledDeletionBanner', () => {
  it('요청자(isRequester)면 "이 로그는 {label} 예정이에요" 카피와 "삭제 취소" 버튼을 표시한다 (plan §4 요청자)', () => {
    renderWithTheme(
      <ScheduledDeletionBanner countdownLabel="약 23시간 후 삭제" isRequester onCancel={onCancel} />,
    );
    expect(screen.getByText('이 로그는 약 23시간 후 삭제 예정이에요')).toBeTruthy();
    expect(screen.getByLabelText('삭제 취소')).toBeTruthy();
  });

  it('요청자가 아니면(상대) "상대가 로그에서 나가 {label} 예정이에요" 안내만 표시하고 취소 버튼은 없다 (plan §4 상대)', () => {
    renderWithTheme(
      <ScheduledDeletionBanner countdownLabel="곧 삭제" isRequester={false} onCancel={onCancel} />,
    );
    expect(screen.getByText('상대가 로그에서 나가 곧 삭제 예정이에요')).toBeTruthy();
    expect(screen.queryByLabelText('삭제 취소')).toBeNull();
  });

  it('"삭제 취소" 탭 → onCancel 콜백을 호출한다 (취소 RPC는 developer)', () => {
    renderWithTheme(
      <ScheduledDeletionBanner countdownLabel="약 2시간 후 삭제" isRequester onCancel={onCancel} />,
    );
    fireEvent.press(screen.getByLabelText('삭제 취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('취소 진행 중(canceling)이면 "삭제 취소" 버튼이 비활성이다', () => {
    renderWithTheme(
      <ScheduledDeletionBanner
        countdownLabel="약 5시간 후 삭제"
        isRequester
        onCancel={onCancel}
        canceling
      />,
    );
    const cancel = screen.getByLabelText('삭제 취소');
    expect(cancel.props.accessibilityState?.disabled ?? cancel.props.disabled).toBeTruthy();
  });

  it('label을 그대로 카피에 끼워 넣는다("곧 삭제"·"삭제 처리 중" 등 분기 무관 — 계산은 developer)', () => {
    renderWithTheme(
      <ScheduledDeletionBanner countdownLabel="삭제 처리 중" isRequester onCancel={onCancel} />,
    );
    expect(screen.getByText('이 로그는 삭제 처리 중 예정이에요')).toBeTruthy();
  });
});
