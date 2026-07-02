// src/navigation/screens/CodeInput.spec.tsx
// 6셀 코드 입력 — 셀 렌더·정규화(normalizeInviteCodeInput) 위임·글자별 셀 채움 (plan §6.5 / §5 T6, AC10·C6).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { CodeInput } from './CodeInput';

describe('CodeInput', () => {
  it('6개의 코드 셀을 렌더한다', () => {
    renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('code-cell-0')).toBeTruthy();
    expect(screen.getByTestId('code-cell-5')).toBeTruthy();
    expect(screen.queryByTestId('code-cell-6')).toBeNull();
  });

  it('입력값을 normalizeInviteCodeInput로 정규화해 onChangeText에 전달한다 (AC10·C6)', () => {
    const onChangeText = jest.fn();
    renderWithTheme(<CodeInput value="" onChangeText={onChangeText} />);
    // "abc 12" → 소문자 대문자화 + 공백/혼동문자(0,1) 제거. 0,1은 charset 외라 무시.
    fireEvent.changeText(screen.getByTestId('code-hidden-input'), 'abc 1z');
    expect(onChangeText).toHaveBeenCalledWith('ABCZ');
  });

  it('혼동문자(0/O/1/I)는 정규화로 제거된다 (AC10)', () => {
    const onChangeText = jest.fn();
    renderWithTheme(<CodeInput value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByTestId('code-hidden-input'), '0O1I');
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('value의 글자를 각 셀에 표시한다', () => {
    renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });
});
