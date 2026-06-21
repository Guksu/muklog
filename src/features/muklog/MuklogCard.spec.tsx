// src/features/muklog/MuklogCard.spec.tsx
// 맛집 카드 — placeName·별점·카테고리 칩·위치줄(area·날짜)·메모 2줄 클램프·작성자 라벨
//   (plan §6.2 / §5 T8, AC9·AC10) + 데이터 결측(category/area/memo null) 안전 처리(§9).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MuklogCard } from './MuklogCard';
import { type Muklog } from './types';

const base: Muklog = {
  id: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '트러플 크림 파스타 인생맛집',
  rating: 5,
  visitedAt: '2026-02-14',
  createdBy: 'me-uid',
  createdAt: '2026-02-14T00:00:00.000Z',
  photoCount: 0,
  coverUri: null,
};

const renderCard = (over?: Partial<Muklog>, meId = 'me-uid') =>
  renderWithTheme(<MuklogCard muklog={{ ...base, ...over }} meId={meId} />);

const flatStyle = (node: { props: { style: unknown } }) =>
  Object.assign({}, ...[].concat(node.props.style as never).filter(Boolean)) as Record<string, unknown>;

describe('MuklogCard', () => {
  it('장소명·카테고리 칩(emoji+label)·위치줄(area · 날짜)을 표시한다', () => {
    renderCard();
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    expect(screen.getByText('🍝 파스타·양식')).toBeTruthy();
    expect(screen.getByText('연남동 · 2026.02.14')).toBeTruthy();
  });

  it('카테고리 칩 텍스트에 fontSize보다 큰 lineHeight를 줘 이모지 세로 클리핑을 막는다', () => {
    renderCard();
    const chipText = screen.getByText('🍝 파스타·양식');
    const flat = Object.assign(
      {},
      ...[].concat(chipText.props.style as never).filter(Boolean),
    ) as { fontSize: number; lineHeight: number };
    expect(flat.lineHeight).toBeGreaterThan(flat.fontSize);
  });

  it('커버를 FoodCover로 그리고 aspectRatio 16/10이다 (B1)', () => {
    renderCard();
    const cover = screen.getByTestId('food-cover-gradient');
    expect(flatStyle(cover).aspectRatio).toBe(16 / 10);
  });

  it('작성자 행에 createdBy 디폴트 아바타(22px)를 렌더한다 (B1)', () => {
    renderCard({ createdBy: 'author-uid' });
    expect(screen.getByTestId('avatar-default')).toBeTruthy();
  });

  it('별점 5개를 채운다 (AC9 표시)', () => {
    renderCard({ rating: 5 });
    expect(screen.getAllByTestId('star-filled')).toHaveLength(5);
  });

  it('메모는 2줄 클램프(numberOfLines=2)로 렌더한다 (AC9)', () => {
    renderCard({ memo: '아주 긴 메모'.repeat(50) });
    const memo = screen.getByTestId('muklog-card-memo');
    expect(memo.props.numberOfLines).toBe(2);
  });

  it('내 기록이면 "내가 기록", 아니면 "짝꿍이 기록" 라벨을 표시한다 (AC10)', () => {
    renderCard({ createdBy: 'me-uid' }, 'me-uid');
    expect(screen.getByText('내가 기록')).toBeTruthy();
    screen.unmount();
    renderCard({ createdBy: 'partner-uid' }, 'me-uid');
    expect(screen.getByText('짝꿍이 기록')).toBeTruthy();
  });

  it('createdBy가 null(탈퇴자 익명화)이면 "탈퇴한 사용자" 라벨 + 익명 아바타로 안전 표시한다 (AC6, 크래시 0)', () => {
    renderCard({ createdBy: null }, 'me-uid');
    expect(screen.getByText('탈퇴한 사용자')).toBeTruthy();
    // userId null → Avatar 익명 폴백(기본 아바타). 짝꿍/내 기록으로 오표시되지 않는다.
    expect(screen.getByTestId('avatar-anonymous')).toBeTruthy();
    expect(screen.queryByText('짝꿍이 기록')).toBeNull();
    expect(screen.queryByText('내가 기록')).toBeNull();
  });

  it('category가 null이면 칩을 숨긴다(데이터 결측)', () => {
    renderCard({ category: null });
    expect(screen.queryByTestId('muklog-card-chip')).toBeNull();
  });

  it('area가 null이면 위치줄에 날짜만 표시한다(데이터 결측)', () => {
    renderCard({ area: null });
    expect(screen.getByText('2026.02.14')).toBeTruthy();
  });

  it('memo가 null이면 메모줄을 숨긴다(데이터 결측)', () => {
    renderCard({ memo: null });
    expect(screen.queryByTestId('muklog-card-memo')).toBeNull();
  });

  it('visitedAt이 null이면 "날짜 미정" fallback을 표시한다(데이터 결측)', () => {
    renderCard({ visitedAt: null, area: null });
    expect(screen.getByText('날짜 미정')).toBeTruthy();
  });

  it('coverUri가 있으면 대표 썸네일 이미지를 커버로 렌더한다 (⑥)', () => {
    renderCard({ coverUri: 'https://signed.example/cover.jpg', photoCount: 3 });
    const cover = screen.getByTestId('muklog-card-cover-image');
    expect(cover.props.source).toEqual({ uri: 'https://signed.example/cover.jpg' });
  });

  it('coverUri가 null이면 FoodCover 폴백을 쓴다 (⑥ 0장 폴백)', () => {
    renderCard({ coverUri: null, photoCount: 0 });
    expect(screen.getByTestId('food-cover-gradient')).toBeTruthy();
    expect(screen.queryByTestId('muklog-card-cover-image')).toBeNull();
  });

  it('photoCount > 0이면 카메라+장수 배지를 표시한다 (⑥)', () => {
    renderCard({ photoCount: 3, coverUri: 'https://signed.example/c.jpg' });
    const badge = screen.getByTestId('muklog-card-photo-badge');
    expect(badge).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('photoCount 0이면 사진 배지를 숨긴다 (⑥)', () => {
    renderCard({ photoCount: 0, coverUri: null });
    expect(screen.queryByTestId('muklog-card-photo-badge')).toBeNull();
  });

  it('onPress가 주어지면 카드 탭 시 호출한다(상세 진입 배선, plan §4.3)', () => {
    const onPress = jest.fn();
    renderWithTheme(<MuklogCard muklog={base} meId="me-uid" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('트라토리아 보나 상세 보기'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('onPress가 없으면 비활성(기존 사용처 안전 — 누르지 못하고 라벨 없음)', () => {
    renderCard();
    // onPress 미연결 시 카드 자체에 button role/상세 라벨이 없어야 한다(기존 사용처 회귀 방지).
    expect(screen.queryByLabelText('트라토리아 보나 상세 보기')).toBeNull();
  });
});
