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

  it('value=3.5면 꽉 3 + 반 1 + 빈 1을 렌더한다 (AC2)', () => {
    renderWithTheme(<Stars value={3.5} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-half')).toHaveLength(1);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1);
    expect(screen.getAllByTestId(/^star-/)).toHaveLength(5);
  });

  it('정수 value=3은 반 별 없이 꽉 3 + 빈 2 (AC2 회귀)', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
    expect(screen.queryByTestId('star-half')).toBeNull();
  });

  it('반 별은 좌측 절반에 채운 별을 겹쳐 근사한다 (AC2)', () => {
    renderWithTheme(<Stars value={3.5} />);
    // 반 별 위치엔 빈 별 위에 채운 별 오버레이가 겹쳐진다 → icon-star-fill 총 4개(꽉 3 + 반 1).
    expect(screen.getAllByTestId('icon-star-fill')).toHaveLength(4);
  });

  it('editable에서 4번째 별 좌측 탭 → onChange(3.5), 우측 탭 → onChange(4) (AC3)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={0} editable onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('별점 3.5점'));
    expect(onChange).toHaveBeenCalledWith(3.5);
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('editable에서 별1은 단일 탭 영역이고 탭 시 onChange(1)을 호출한다 (클램프 결정)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={0} editable onChange={onChange} />);
    // 별1은 클램프로 좌/우 방출값이 동일(1) → 반 분할 없이 단일 Pressable(라벨 유일).
    expect(screen.getAllByLabelText('별점 1점')).toHaveLength(1);
    fireEvent.press(screen.getByLabelText('별점 1점'));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).not.toHaveBeenCalledWith(0.5);
  });
});
