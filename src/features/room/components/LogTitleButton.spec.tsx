// src/features/room/components/LogTitleButton.spec.tsx
// LogScreen 헤더 제목 버튼(log-name, plan §4.1 / 결정3) — 프리젠테이션 전담.
//   킷 mk-log:32-41 재현: 아바타 슬롯 + 제목 + ✏️(pencil)을 하나의 탭 가능 버튼으로.
//   데이터(아바타·표시명)는 props/슬롯로 받는다 — 닉/커플/표시명 계산은 developer(LogScreen).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LogTitleButton } from './LogTitleButton';

describe('LogTitleButton', () => {
  it('전달된 title을 표시한다', () => {
    renderWithTheme(<LogTitleButton title="우리 맛집" onEdit={jest.fn()} />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
  });

  it('avatarSlot으로 받은 노드를 렌더한다', () => {
    renderWithTheme(
      <LogTitleButton
        title="우리 맛집"
        onEdit={jest.fn()}
        avatarSlot={<Text>AVATARS</Text>}
      />,
    );
    expect(screen.getByText('AVATARS')).toBeTruthy();
  });

  it('탭 시 onEdit을 호출한다(편집 진입점)', () => {
    const onEdit = jest.fn();
    renderWithTheme(<LogTitleButton title="우리 맛집" onEdit={onEdit} />);
    fireEvent.press(screen.getByLabelText('로그 이름 편집'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('pencil 아이콘을 노출한다', () => {
    renderWithTheme(<LogTitleButton title="우리 맛집" onEdit={jest.fn()} />);
    expect(screen.getByTestId('icon-pencil')).toBeTruthy();
  });
});
