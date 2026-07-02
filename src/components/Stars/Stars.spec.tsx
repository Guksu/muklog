// src/components/Stars.spec.tsx
// 별점 표시/입력 컴포넌트 — value만큼 채운 별, editable 시 탭→onChange, 0/null=빈 별 (plan §6.2 / §5 T7, AC4).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Stars } from './Stars';

describe('Stars', () => {
  it('항상 별 5개를 렌더한다', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId(/^star-/)).toHaveLength(5);
  });

  it('value=3이면 3개 채우고 2개 비운다', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
  });

  it('value=0이면 모두 빈 별이다 (AC4: 미평가)', () => {
    renderWithTheme(<Stars value={0} />);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(5);
    expect(screen.queryByTestId('star-filled')).toBeNull();
  });

  it('value=null이면 모두 빈 별로 안전 처리한다', () => {
    renderWithTheme(<Stars value={null} />);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(5);
  });

  it('editable=false면 탭해도 onChange가 없다(비입력)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={2} onChange={onChange} />);
    // 비편집 시 별은 버튼이 아니므로 누를 대상이 없음 → onChange 미호출 보장
    expect(screen.queryByLabelText('별점 3점')).toBeNull();
  });

  it('editable=true면 n번째 별 탭 시 onChange(n)을 호출한다 (입력)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={2} editable onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('채운 별은 킷 starFill(#FFB23E)로 칠한다 (A6)', () => {
    renderWithTheme(<Stars value={3} />);
    const filledIcons = screen.getAllByTestId('icon-star-fill');
    expect(filledIcons[0].props.color).toBe('#FFB23E');
  });
});
