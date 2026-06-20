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

  it('emoji 오버라이드를 주면 그 이모지를 렌더한다(category 폴백 미사용 — 주변 음식점 종목 이모지)', () => {
    // category=null이라 기존 경로면 cafe(☕)로 폴백하지만, emoji='🍖'가 우선해 🍖를 렌더한다.
    renderWithTheme(<FoodCover category={null} emoji="🍖" />);
    expect(screen.getByText('🍖')).toBeTruthy();
    expect(screen.queryByText(MUKLOG_CATEGORIES.cafe.emoji)).toBeNull();
  });

  it('emoji 오버라이드여도 그라데이션은 category 기준 유지한다(주변 카드 = cafe 중립 배경 + 종목 이모지)', () => {
    renderWithTheme(<FoodCover category={null} emoji="🍖" />);
    // category=null → cafe 중립 그라데이션(배경 다채화는 Out-of-scope), 이모지만 종목별.
    expect(screen.getByTestId('food-cover-gradient').props.colors).toEqual(
      MUKLOG_CATEGORIES.cafe.colors,
    );
  });

  it('emoji 미지정이면 기존 category 경로로 동작한다(회귀 — pasta=🍝)', () => {
    renderWithTheme(<FoodCover category="pasta" />);
    expect(screen.getByText('🍝')).toBeTruthy();
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
