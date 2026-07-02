// src/components/SubBar.spec.tsx
// 공용 서브 헤더 — 킷 mk-home SubBar(233-244): 뒤로 버튼 + 좌측정렬 타이틀 + 우측 슬롯.
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { SubBar } from './SubBar';

describe('SubBar', () => {
  it('타이틀을 렌더한다', () => {
    renderWithTheme(<SubBar title="초대코드 입력" onBack={() => {}} />);
    expect(screen.getByText('초대코드 입력')).toBeTruthy();
  });

  it('뒤로 버튼 탭 시 onBack을 호출한다', () => {
    const onBack = jest.fn();
    renderWithTheme(<SubBar title="프로필" onBack={onBack} />);
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('우측 슬롯(right)을 렌더한다', () => {
    renderWithTheme(
      <SubBar title="새 먹로그" onBack={() => {}} right={<Text>저장</Text>} />,
    );
    expect(screen.getByText('저장')).toBeTruthy();
  });
});
