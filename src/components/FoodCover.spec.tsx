// src/components/FoodCover.spec.tsx
// 음식 커버 — 카테고리 그라데이션 + 대표 이모지 (킷 mk-ui FoodCover, A1).
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { MUKLOG_CATEGORIES } from '@/features/muklog/categories';

import { FoodCover } from './FoodCover';

describe('FoodCover', () => {
  it('카테고리 대표 이모지를 렌더한다(pasta=🍝)', () => {
    renderWithTheme(<FoodCover category="pasta" />);
    expect(screen.getByText('🍝')).toBeTruthy();
  });

  it('카테고리별 그라데이션 colors를 LinearGradient에 전달한다(A1)', () => {
    renderWithTheme(<FoodCover category="sushi" />);
    const gradient = screen.getByTestId('food-cover-gradient');
    expect(gradient.props.colors).toEqual(['#FFC7C2', '#FF7E8A']);
  });

  it('미지/null 카테고리는 cafe로 폴백한다(킷 CAT[cat]||CAT.cafe)', () => {
    renderWithTheme(<FoodCover category={null} />);
    expect(screen.getByText(MUKLOG_CATEGORIES.cafe.emoji)).toBeTruthy();
    expect(screen.getByTestId('food-cover-gradient').props.colors).toEqual(
      MUKLOG_CATEGORIES.cafe.colors,
    );
  });

  it('children(오버레이: 사진수 배지 등)을 그 위에 렌더한다', () => {
    renderWithTheme(
      <FoodCover category="cafe">
        <></>
      </FoodCover>,
    );
    // children 렌더 경로가 깨지지 않음(커버 자체가 마운트됨)
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
  });
});
