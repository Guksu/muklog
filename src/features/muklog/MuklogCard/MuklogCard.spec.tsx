// src/features/muklog/MuklogCard.spec.tsx
// 맛집 카드 — placeName·별점·카테고리 칩·위치줄(area·날짜)·메모 2줄 클램프·작성자 라벨
//   (plan §6.2 / §5 T8, AC9·AC10) + 데이터 결측(category/area/memo null) 안전 처리(§9).
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { MOTION_DURATION } from '@/theme';

import { MuklogCard } from './MuklogCard';
import { type Muklog } from '../types';

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
  it('장소명·카테고리 칩(라벨만, 이모지 없음)·위치줄(area · 날짜)을 표시한다', () => {
    renderCard();
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    // 킷 §2-2: 작은 배지는 라벨 텍스트만(이모지 제거). 이모지 커버는 FoodCover가 담당.
    expect(screen.getByText('파스타·양식')).toBeTruthy();
    expect(screen.queryByText('🍝 파스타·양식')).toBeNull();
    expect(screen.getByText('연남동 · 2026.02.14')).toBeTruthy();
  });

  it('커버를 FoodCover로 그리고 aspectRatio 16/10이다 (B1)', () => {
    renderCard();
    const cover = screen.getByTestId('food-cover-gradient');
    expect(flatStyle(cover).aspectRatio).toBe(16 / 10);
  });

  it('작성자 행을 렌더하지 않는다 — 아바타/작성자 라벨 부재(S5b §4.4, 킷 MuklogCard 작성자 줄 없음)', () => {
    renderCard({ createdBy: 'author-uid' });
    // 킷 mk-log:180-213 MuklogCard 에는 작성자 줄이 없다 → 카드에서 아바타·라벨 제거.
    expect(screen.queryByTestId('avatar-default')).toBeNull();
    expect(screen.queryByTestId('avatar-anonymous')).toBeNull();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
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

  it('작성자 라벨("내가 기록"/"짝꿍이 기록")을 표시하지 않는다 (S5b §4.4)', () => {
    renderCard({ createdBy: 'me-uid' }, 'me-uid');
    expect(screen.queryByText('내가 기록')).toBeNull();
    screen.unmount();
    renderCard({ createdBy: 'partner-uid' }, 'me-uid');
    expect(screen.queryByText('짝꿍이 기록')).toBeNull();
  });

  it('createdBy가 null(탈퇴자 익명화)이어도 크래시 없이 렌더하고 작성자 라벨은 없다 (S5b §4.4, AC6)', () => {
    // 작성자 표시는 상세(MuklogDetail)로 이관 — 카드는 작성자 줄 자체가 없다.
    renderCard({ createdBy: null }, 'me-uid');
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    expect(screen.queryByText('탈퇴한 사용자')).toBeNull();
    expect(screen.queryByTestId('avatar-anonymous')).toBeNull();
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

describe('MuklogCard — 커버 사진 페이드인 (motion-pass-1 D2)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  const coverOpacity = () =>
    (StyleSheet.flatten(screen.getByTestId('muklog-card-cover-image').props.style) as {
      opacity: number;
    }).opacity;

  const settleFade = () => {
    act(() => jest.advanceTimersByTime(MOTION_DURATION.photoFade + 50));
  };

  it('커버 로드 후 사진이 나타나고(불투명도 1) 그 뒤에도 카드 탭이 동작한다', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <MuklogCard
        muklog={{ ...base, coverUri: 'https://signed.example/cover.jpg', photoCount: 1 }}
        meId="me-uid"
        onPress={onPress}
      />,
    );
    fireEvent(screen.getByTestId('muklog-card-cover-image'), 'load');
    settleFade();
    expect(coverOpacity()).toBe(1);

    fireEvent.press(screen.getByLabelText('트라토리아 보나 상세 보기'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('커버 로드 실패(error)에도 결국 보인다(fail-visible — 투명한 빈칸 금지)', () => {
    renderWithTheme(
      <MuklogCard
        muklog={{ ...base, coverUri: 'https://signed.example/expired.jpg', photoCount: 1 }}
        meId="me-uid"
      />,
    );
    fireEvent(screen.getByTestId('muklog-card-cover-image'), 'error');
    settleFade();
    expect(coverOpacity()).toBe(1);
  });
});
