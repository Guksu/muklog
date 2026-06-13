// src/navigation/screens/MuklogDetailScreen.spec.tsx
// 먹로그 상세(읽기 전용) — 킷 mk-log.jsx:122-192 MuklogDetail 비주얼 골격 (plan §6③⑤, AC a~e).
//   순수 표시 컴포넌트: 데이터/상태/onBack을 props로 받는다(useMuklog/useProfile/navigation 배선은 developer).
//   검증: 캐러셀(0/1/N장·인디케이터), category/rating/memo NULL 폴백, back→onBack, share/more 부재,
//         작성자 라벨, hasCoords stub 분기, loading/notFound/error 상태.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import {
  MuklogDetailScreen,
  type MuklogDetailPhoto,
  type MuklogDetailViewData,
} from './MuklogDetailScreen';

const photo = (over?: Partial<MuklogDetailPhoto>): MuklogDetailPhoto => ({
  orderIndex: 0,
  uri: 'https://signed.example/p0.jpg',
  ...over,
});

const data = (over?: Partial<MuklogDetailViewData>): MuklogDetailViewData => ({
  id: 'm1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '둘이 먹은 까르보나라가 인생 맛.',
  rating: 5,
  visitedAt: '2026-02-14',
  roadAddress: '서울 마포구 연남로 1',
  hasCoords: false,
  createdBy: 'me-uid',
  photos: [photo()],
  ...over,
});

const onBack = jest.fn();
const onRetry = jest.fn();

const renderReady = (over?: Partial<MuklogDetailViewData>) =>
  renderWithTheme(
    <MuklogDetailScreen
      state={{ status: 'ready', muklog: data(over) }}
      meId="me-uid"
      meAvatarUrl={null}
      onBack={onBack}
      onRetry={onRetry}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe('MuklogDetailScreen — 상태 분기', () => {
  it('loading이면 로더를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'loading' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('muklog-detail-loading')).toBeTruthy();
  });

  it('notFound면 "찾을 수 없어요" 안내 + 뒤로가기를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'notFound' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('muklog-detail-notfound')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('error면 메시지 + 다시 시도(onRetry)를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'error', message: '조회 실패' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('조회 실패')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('MuklogDetailScreen — 사진 캐러셀 (AC a/b)', () => {
  it('사진 N(>1)장이면 페이지 인디케이터를 표시한다', () => {
    renderReady({
      photos: [
        photo({ orderIndex: 0, uri: 'u0' }),
        photo({ orderIndex: 1, uri: 'u1' }),
        photo({ orderIndex: 2, uri: 'u2' }),
      ],
    });
    expect(screen.getByTestId('muklog-detail-indicator')).toBeTruthy();
    expect(screen.getAllByTestId('muklog-detail-photo')).toHaveLength(3);
    // FoodCover 폴백은 사진이 있으면 렌더하지 않는다.
    expect(screen.queryByTestId('muklog-detail-cover-fallback')).toBeNull();
  });

  it('사진 1장이면 인디케이터를 표시하지 않는다', () => {
    renderReady({ photos: [photo()] });
    expect(screen.getByTestId('muklog-detail-photo')).toBeTruthy();
    expect(screen.queryByTestId('muklog-detail-indicator')).toBeNull();
  });

  it('사진 0장이면 FoodCover 폴백 1칸 + 인디케이터 없음 (AC b)', () => {
    renderReady({ photos: [] });
    expect(screen.getByTestId('muklog-detail-cover-fallback')).toBeTruthy();
    expect(screen.queryByTestId('muklog-detail-photo')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-indicator')).toBeNull();
  });
});

describe('MuklogDetailScreen — 본문 NULL 폴백 (AC c)', () => {
  it('category가 있으면 카테고리 칩, null이면 칩 미표시', () => {
    renderReady({ category: 'pasta' });
    expect(screen.getByTestId('muklog-detail-category-chip')).toBeTruthy();

    renderReady({ category: null });
    expect(screen.queryByTestId('muklog-detail-category-chip')).toBeNull();
  });

  it('rating이 있으면 평점 숫자, null이면 "미평가"', () => {
    renderReady({ rating: 4 });
    expect(screen.getByText('4.0')).toBeTruthy();

    renderReady({ rating: null });
    expect(screen.getByText('미평가')).toBeTruthy();
  });

  it('memo가 있으면 본문, 없으면 플레이스홀더', () => {
    renderReady({ memo: '맛있었어요' });
    expect(screen.getByText('맛있었어요')).toBeTruthy();

    renderReady({ memo: null });
    expect(screen.getByText('메모가 없어요')).toBeTruthy();
  });

  it('장소명을 타이틀로 표시한다', () => {
    renderReady({ placeName: '연남 파스타집' });
    expect(screen.getByText('연남 파스타집')).toBeTruthy();
  });
});

describe('MuklogDetailScreen — 위치/미니맵 stub (AC ⑤)', () => {
  it('hasCoords=false면 미니맵 stub + 위치 InfoRow에 roadAddress', () => {
    renderReady({ hasCoords: false, roadAddress: '서울 마포구 연남로 1' });
    expect(screen.getByTestId('muklog-detail-map-stub')).toBeTruthy();
    expect(screen.getAllByText('서울 마포구 연남로 1').length).toBeGreaterThan(0);
  });

  it('roadAddress null이면 위치를 "위치 정보 없음"으로 표시한다', () => {
    renderReady({ hasCoords: false, roadAddress: null });
    expect(screen.getAllByText('위치 정보 없음').length).toBeGreaterThan(0);
  });
});

describe('MuklogDetailScreen — 상단 글래스 바 (AC d)', () => {
  it('back 버튼은 활성, share/more 버튼은 미렌더', () => {
    renderReady();
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('공유')).toBeNull();
    expect(screen.queryByLabelText('더보기')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-share')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-more')).toBeNull();
  });
});

describe('MuklogDetailScreen — 작성자 라벨 (AC e)', () => {
  it('createdBy === meId면 "내가 기록"', () => {
    renderReady({ createdBy: 'me-uid' });
    expect(screen.getByText('내가 기록')).toBeTruthy();
  });

  it('createdBy !== meId면 "짝꿍이 기록"', () => {
    renderReady({ createdBy: 'partner-uid' });
    expect(screen.getByText('짝꿍이 기록')).toBeTruthy();
  });
});
