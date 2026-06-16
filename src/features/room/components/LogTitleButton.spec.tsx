// src/features/room/components/LogTitleButton.spec.tsx
// LogScreen 헤더 제목 — 프리젠테이션 전담(display-only).
//   아바타 슬롯 + 제목 표시만. ⚠️ 이름 변경은 ⋯메뉴 "로그 이름 변경"으로 이전(사용자 요청) → 타이틀 탭 동작·✏️ 없음.
//   데이터(아바타·표시명)는 props/슬롯로 받는다 — 닉/커플/표시명 계산은 developer(LogScreen).
import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LogTitleButton } from './LogTitleButton';

describe('LogTitleButton (display-only)', () => {
  it('전달된 title을 표시한다', () => {
    renderWithTheme(<LogTitleButton title="우리 맛집" />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
  });

  it('avatarSlot으로 받은 노드를 렌더한다', () => {
    renderWithTheme(<LogTitleButton title="우리 맛집" avatarSlot={<Text>AVATARS</Text>} />);
    expect(screen.getByText('AVATARS')).toBeTruthy();
  });

  it('편집 진입점(버튼/✏️)이 없다 — 이름 변경은 ⋯메뉴로 이전(타이틀 탭 동작 없음)', () => {
    renderWithTheme(<LogTitleButton title="우리 맛집" />);
    expect(screen.queryByLabelText('로그 이름 편집')).toBeNull();
    expect(screen.queryByTestId('icon-pencil')).toBeNull();
  });
});
