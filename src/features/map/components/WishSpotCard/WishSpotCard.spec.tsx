// src/features/map/components/WishSpotCard.spec.tsx
// 위시 스팟 카드 — 킷 mk-home.jsx:386-393 스팟 카드 셸 미러(별점·heart·거리·액션 제외).
//   위시 핀(kind:'wish') 탭 시 하단 등장: FoodCover(카테고리 tint + coverEmoji) + 가게명 + "· 카테고리 · area".
//   coverEmoji는 부모(MapTabScreen)가 pin과 동일한 categoryEmoji로 산출·주입(카드↔핀 이모지 단일 출처, plan §7-6).
//   데이터는 props로만 주입. 비즈니스 로직 없음.
import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { WishSpotCard } from './WishSpotCard';

describe('WishSpotCard', () => {
  it('가게명을 표시한다', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.getByText('연남 파스타')).toBeTruthy();
  });

  it('카테고리 라벨과 area를 메타줄에 표시한다("· 라벨 · area")', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    // pasta 라벨(categories SSOT) + area.
    expect(screen.getByText('· 파스타·양식 · 연남동')).toBeTruthy();
  });

  it('area가 없으면 카테고리 라벨만 표시한다(area 조각 생략)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area={null} />,
    );
    expect(screen.getByText('· 파스타·양식')).toBeTruthy();
  });

  it('coverEmoji로 받은 이모지를 커버에 렌더한다(핀과 동일 매핑 — 단일 출처)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
    expect(screen.getByText('🍝')).toBeTruthy();
  });

  it('별점(Stars)·heart·액션을 렌더하지 않는다(위시 최소 카드는 표시 전용)', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    expect(screen.queryByTestId('star-filled')).toBeNull();
    expect(screen.queryByTestId('star-empty')).toBeNull();
    expect(screen.queryByTestId('nearby-add-wish')).toBeNull();
  });

  // category/area 메타 텍스트 상단 클리핑 방지 — lineHeight > fontSize(한글 글리프 윗부분 잘림 방지).
  it('메타 텍스트의 lineHeight가 fontSize보다 커서 상단 클리핑이 없다', () => {
    renderWithTheme(
      <WishSpotCard placeName="연남 파스타" category="pasta" coverEmoji="🍝" area="연남동" />,
    );
    const meta = StyleSheet.flatten(screen.getByText('· 파스타·양식 · 연남동').props.style);
    expect(meta.lineHeight).toBeGreaterThan(meta.fontSize);
  });
});
