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
      <NearbySpotCard placeName="연남 칼국수" categoryName="음식점 > 한식 > 칼국수" distanceText="320m" />,
    );
    expect(screen.getByText('연남 칼국수')).toBeTruthy();
  });

  it('카테고리명과 거리를 메타줄에 표시한다("카테고리 · 거리")', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="음식점 > 한식 > 칼국수" distanceText="320m" />,
    );
    expect(screen.getByText('음식점 > 한식 > 칼국수 · 320m')).toBeTruthy();
  });

  it('거리(distanceText)가 없으면 카테고리명만 표시한다(거리 조각 생략)', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="음식점 > 한식 > 칼국수" />,
    );
    expect(screen.getByText('음식점 > 한식 > 칼국수')).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('카테고리 커버(FoodCover) 그라데이션을 렌더한다', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="음식점 > 한식 > 칼국수" distanceText="320m" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
  });

  it('별점(Stars)·heart를 렌더하지 않는다(주변 음식점은 그 데이터가 없음)', () => {
    renderWithTheme(
      <NearbySpotCard placeName="연남 칼국수" categoryName="음식점 > 한식 > 칼국수" distanceText="320m" />,
    );
    expect(screen.queryByTestId('star-filled')).toBeNull();
    expect(screen.queryByTestId('star-empty')).toBeNull();
  });
});
