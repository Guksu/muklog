// src/features/muklog/PlaceSearchField.spec.tsx
// 장소검색 입력 + 상태 5종(plan §4.2) — 킷 mk-log.jsx PlaceSearch 인라인 번역.
//   idle 미표시 / loading 스피너 / ready≥1 결과행 / ready 0건 안내 / error 인라인 안내 + 입력 콜백·선택 콜백.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { PlaceSearchField } from './PlaceSearchField';
import { type PlaceSearchItem } from './types';

const item = (over?: Partial<PlaceSearchItem>): PlaceSearchItem => ({
  kakaoPlaceId: 'k1',
  placeName: '트라토리아 보나',
  categoryName: '음식점 > 양식 > 이탈리안',
  categoryGroupCode: 'FD6',
  addressName: '서울 마포구 연남동 227-15',
  roadAddressName: '서울 마포구 월드컵북로 39',
  lat: 37.56,
  lng: 126.92,
  phone: '',
  ...over,
});

const baseProps = {
  query: '',
  onChangeQuery: jest.fn(),
  onSelectResult: jest.fn(),
  results: [] as PlaceSearchItem[],
};

describe('PlaceSearchField', () => {
  it('검색 입력(돋보기 pill)을 렌더하고 입력 시 onChangeQuery를 호출한다', () => {
    const onChangeQuery = jest.fn();
    renderWithTheme(
      <PlaceSearchField {...baseProps} status="idle" onChangeQuery={onChangeQuery} />,
    );
    expect(screen.getByTestId('icon-search')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('장소 검색'), '보나');
    expect(onChangeQuery).toHaveBeenCalledWith('보나');
  });

  it('idle 상태는 결과/안내를 표시하지 않는다(기존 수동 입력 그대로)', () => {
    renderWithTheme(<PlaceSearchField {...baseProps} status="idle" />);
    expect(screen.queryByTestId('place-search-results')).toBeNull();
    expect(screen.queryByTestId('place-search-empty')).toBeNull();
    expect(screen.queryByTestId('place-search-spinner')).toBeNull();
  });

  it('loading 상태는 스피너를 표시한다', () => {
    renderWithTheme(<PlaceSearchField {...baseProps} status="loading" query="보나" />);
    expect(screen.getByTestId('place-search-spinner')).toBeTruthy();
  });

  it('ready & 결과≥1이면 결과 행을 렌더한다', () => {
    renderWithTheme(
      <PlaceSearchField {...baseProps} status="ready" query="보나" results={[item(), item({ kakaoPlaceId: 'k2', placeName: '보나 베이커리' })]} />,
    );
    expect(screen.getByTestId('place-search-results')).toBeTruthy();
    expect(screen.getByText('트라토리아 보나')).toBeTruthy();
    expect(screen.getByText('보나 베이커리')).toBeTruthy();
  });

  it('결과 행 탭 시 onSelectResult({item})을 호출한다', () => {
    const onSelectResult = jest.fn();
    renderWithTheme(
      <PlaceSearchField {...baseProps} status="ready" query="보나" results={[item()]} onSelectResult={onSelectResult} />,
    );
    fireEvent.press(screen.getByTestId('place-result-0'));
    expect(onSelectResult).toHaveBeenCalledWith({ item: item() });
  });

  it('resolveCategory로 결과 커버 카테고리를 매핑한다(developer mapKakaoCategory 주입)', () => {
    renderWithTheme(
      <PlaceSearchField
        {...baseProps}
        status="ready"
        query="보나"
        results={[item()]}
        resolveCategory={() => 'pasta'}
      />,
    );
    // pasta 라벨이 보조행에 합성됨.
    expect(screen.getByText('파스타·양식 · 서울 마포구 월드컵북로 39')).toBeTruthy();
  });

  it('ready & 0건이면 "검색 결과가 없어요. 직접 입력해도 돼요."를 안내한다(plan §4.2)', () => {
    renderWithTheme(<PlaceSearchField {...baseProps} status="ready" query="없는가게" results={[]} />);
    expect(screen.getByText('검색 결과가 없어요. 직접 입력해도 돼요.')).toBeTruthy();
  });

  it('error 상태는 errorMessage를 인라인 안내한다(수동 입력 폴백 유지)', () => {
    renderWithTheme(
      <PlaceSearchField
        {...baseProps}
        status="error"
        query="보나"
        errorMessage="장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요."
      />,
    );
    expect(
      screen.getByText('장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.'),
    ).toBeTruthy();
  });
});
