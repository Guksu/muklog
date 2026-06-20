// src/features/map/components/NearbySpotCard.spec.tsx
// 주변 음식점 카드 — 킷 mk-home.jsx:287-301 선택 스팟 카드 셸 재사용(별점/area/heart 제외).
//   주변 핀(saved:false) 탭 시 하단 등장: FoodCover + 가게명 + "카테고리 · 거리".
//   주변 음식점은 별점·area·heart 데이터가 없다(plan §4). 거리(distanceText)는 developer가 formatDistance로 만들어 주입.
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { NearbySpotCard } from './NearbySpotCard';

describe('NearbySpotCard', () => {
  it('가게명을 표시한다', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="칼국수" coverEmoji="🍜" distanceText="320m" />,
    );
    expect(screen.getByText('연남 칼국수')).toBeTruthy();
  });

  it('카테고리(마지막 세그먼트)와 거리를 메타줄에 표시한다("카테고리 · 거리")', () => {
    // categoryName은 부모(MapTabScreen)가 lastCategorySegment로 가공해 넘긴 마지막 세그먼트 텍스트.
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="칼국수" coverEmoji="🍜" distanceText="320m" />,
    );
    expect(screen.getByText('칼국수 · 320m')).toBeTruthy();
  });

  it('거리(distanceText)가 없으면 카테고리명만 표시한다(거리 조각 생략)', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="칼국수" coverEmoji="🍜" />,
    );
    expect(screen.getByText('칼국수')).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('coverEmoji로 받은 종목 이모지를 커버에 렌더한다(☕ 일괄 폴백 버그 제거)', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 고깃집" categoryName="고기" coverEmoji="🍖" distanceText="120m" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
    expect(screen.getByText('🍖')).toBeTruthy();
    // raw 브레드크럼을 FoodCover에 넘기지 않으므로 더 이상 ☕로 폴백되지 않는다.
    expect(screen.queryByText('☕')).toBeNull();
  });

  it('별점(Stars)·heart를 렌더하지 않는다(주변 음식점은 그 데이터가 없음)', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="칼국수" coverEmoji="🍜" distanceText="320m" />,
    );
    expect(screen.queryByTestId('star-filled')).toBeNull();
    expect(screen.queryByTestId('star-empty')).toBeNull();
  });
});
