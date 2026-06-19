// src/features/muklog/PlaceSelectedSummary.spec.tsx
// 장소 선택 요약 카드 — 킷 mk-log.jsx:302-310 placeChosen 재현. 장소명·📍주소·커버·선택 해제(plan D2).
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { PlaceSelectedSummary } from './PlaceSelectedSummary';
import { MUKLOG_CATEGORIES } from './categories';

describe('PlaceSelectedSummary', () => {
  it('선택된 장소명을 렌더한다', () => {
    renderWithTheme(<PlaceSelectedSummary placeName="트라토리아 보나" onChange={jest.fn()} />);
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
  });

  it('도로명주소를 "📍 {주소}"로 표시한다(plan §4.1)', () => {
    renderWithTheme(
      <PlaceSelectedSummary placeName="보나" roadAddress="서울 마포구 월드컵북로 39" onChange={jest.fn()} />,
    );
    expect(screen.getByText('📍 서울 마포구 월드컵북로 39')).toBeTruthy();
  });

  it('도로명주소가 없으면 area로 폴백한다(킷 road||area)', () => {
    renderWithTheme(<PlaceSelectedSummary placeName="보나" area="연남동" onChange={jest.fn()} />);
    expect(screen.getByText('📍 연남동')).toBeTruthy();
  });

  it('📍 주소 줄의 lineHeight가 fontSize보다 커서 상단이 클립되지 않는다 (회귀: 핀 상단 가림)', () => {
    renderWithTheme(<PlaceSelectedSummary placeName="보나" area="화곡동" onChange={jest.fn()} />);
    const flat = StyleSheet.flatten(screen.getByText('📍 화곡동').props.style);
    expect(flat.lineHeight).toBeGreaterThan(flat.fontSize);
  });

  it('카테고리 커버 그라데이션을 FoodCover로 렌더한다(pasta)', () => {
    renderWithTheme(<PlaceSelectedSummary placeName="보나" category="pasta" onChange={jest.fn()} />);
    expect(screen.getByTestId('food-cover-gradient').props.colors).toEqual(
      MUKLOG_CATEGORIES.pasta.colors,
    );
  });

  it('"변경" 탭 시 onChange를 호출한다(재검색 진입 — 구 "선택 해제" 대체)', () => {
    const onChange = jest.fn();
    renderWithTheme(<PlaceSelectedSummary placeName="보나" onChange={onChange} />);
    expect(screen.getByText('변경')).toBeTruthy();
    expect(screen.queryByText('선택 해제')).toBeNull();
    fireEvent.press(screen.getByLabelText('장소 변경'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
