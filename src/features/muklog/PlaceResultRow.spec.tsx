// src/features/muklog/PlaceResultRow.spec.tsx
// 장소검색 결과 1행 — 킷 mk-log.jsx:402-409 재현. 장소명·카테고리라벨·주소·탭 콜백·커버 그라데이션.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { PlaceResultRow } from './PlaceResultRow';
import { MUKLOG_CATEGORIES } from './categories';

describe('PlaceResultRow', () => {
  it('장소명을 렌더한다', () => {
    renderWithTheme(<PlaceResultRow placeName="트라토리아 보나" onPress={jest.fn()} />);
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
  });

  it('매핑 카테고리 라벨 · 도로명주소를 보조행으로 합성한다(킷 `CATLBL · road`)', () => {
    renderWithTheme(
      <PlaceResultRow
        placeName="보나"
        category="pasta"
        roadAddress="서울 마포구 월드컵북로 39"
        address="서울 마포구 연남동 227-15"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('파스타·양식 · 서울 마포구 월드컵북로 39')).toBeTruthy();
  });

  it('도로명주소가 없으면 지번 주소로 폴백한다', () => {
    renderWithTheme(
      <PlaceResultRow placeName="보나" category="cafe" address="서울 마포구 연남동 227-15" onPress={jest.fn()} />,
    );
    expect(screen.getByText('카페·디저트 · 서울 마포구 연남동 227-15')).toBeTruthy();
  });

  it('미매핑(null) 카테고리는 라벨을 생략하고 주소만 표시한다(enum 드리프트 안전)', () => {
    renderWithTheme(
      <PlaceResultRow placeName="보나" category={null} roadAddress="서울 마포구 월드컵북로 39" onPress={jest.fn()} />,
    );
    expect(screen.getByText('서울 마포구 월드컵북로 39')).toBeTruthy();
  });

  it('카테고리 커버 그라데이션을 FoodCover로 렌더한다(sushi)', () => {
    renderWithTheme(<PlaceResultRow placeName="스시 보나" category="sushi" onPress={jest.fn()} />);
    expect(screen.getByTestId('food-cover-gradient').props.colors).toEqual(
      MUKLOG_CATEGORIES.sushi.colors,
    );
  });

  it('행 탭 시 onPress를 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(<PlaceResultRow placeName="보나" onPress={onPress} testID="result-0" />);
    fireEvent.press(screen.getByTestId('result-0'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('접근성 라벨은 "<장소명> 선택"이다', () => {
    renderWithTheme(<PlaceResultRow placeName="보나" onPress={jest.fn()} />);
    expect(screen.getByLabelText('보나 선택')).toBeTruthy();
  });
});
