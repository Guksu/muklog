// src/features/map/components/SelectedSpotCard.spec.tsx
// 선택 스팟 카드 — 킷 mk-home.jsx:287-301 선택 스팟 카드 재현.
//   핀 탭 시 하단 등장: FoodCover(카테고리 이모지) + 가게명 + 별점 + "· 카테고리 · area".
//   데이터는 props로만 주입(plan §3.3 MuklogPin 필드). 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { SelectedSpotCard } from './SelectedSpotCard';

describe('SelectedSpotCard', () => {
  it('가게명을 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
  });

  it('카테고리 라벨과 area를 메타줄에 표시한다(킷 "· 카테고리 · area")', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    expect(screen.getByText('· 파스타·양식 · 연남동')).toBeTruthy();
  });

  it('rating만큼 채운 별을 렌더한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="스시 오마" rating={3} category="sushi" area="청담동" />,
    );
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
  });

  it('카테고리 커버(FoodCover) 그라데이션을 렌더한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="스시 오마" rating={3} category="sushi" area="청담동" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
  });

  it('area가 null이면 카테고리 라벨만 메타줄에 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="이름만 가게" rating={null} category="cafe" area={null} />,
    );
    expect(screen.getByText('· 카페·디저트')).toBeTruthy();
  });

  it('category가 null이면 area만 메타줄에 표시한다', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="무카테고리" rating={4} category={null} area="망원동" />,
    );
    expect(screen.getByText('· 망원동')).toBeTruthy();
  });

  // #5: 카테고리/area 메타 텍스트 상단 클리핑 방지 — lineHeight > fontSize(한글 글리프 윗부분 잘림 방지).
  it('메타 텍스트의 lineHeight가 fontSize보다 커서 상단 클리핑이 없다(#5)', () => {
    renderWithTheme(
      <SelectedSpotCard placeName="트라토리아 보나" rating={5} category="pasta" area="연남동" />,
    );
    const meta = StyleSheet.flatten(screen.getByText('· 파스타·양식 · 연남동').props.style);
    expect(meta.lineHeight).toBeGreaterThan(meta.fontSize);
  });
});
