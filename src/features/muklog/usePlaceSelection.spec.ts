// src/features/muklog/usePlaceSelection.spec.ts
// 장소 선택 상태 훅 — 컨테이너(MuklogList/MuklogDetailRoute)가 소유, 시트에 controlled 주입 (plan §5.4·D2).
//   selectPlace({item}) → placeFieldsFromItem(PlaceSelection) 보관 / clearPlace() → null(요약카드 해제).
import { act, renderHook } from '@testing-library/react-native';

import { usePlaceSelection } from './usePlaceSelection';
import { type PlaceSearchItem } from './types';

const item: PlaceSearchItem = {
  kakaoPlaceId: '26338954',
  placeName: '트라토리아 보나',
  categoryName: '음식점 > 양식 > 이탈리안',
  categoryGroupCode: 'FD6',
  addressName: '서울 마포구 연남동 227-15',
  roadAddressName: '서울 마포구 동교로 123',
  lat: 37.561,
  lng: 126.925,
  phone: '',
};

describe('usePlaceSelection', () => {
  it('초기 selectedPlace는 null', () => {
    const { result } = renderHook(() => usePlaceSelection());
    expect(result.current.selectedPlace).toBeNull();
  });

  it('selectPlace({item}) → PlaceSelection(자동채움)으로 세팅', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => result.current.selectPlace({ item }));
    expect(result.current.selectedPlace).toEqual({
      placeName: '트라토리아 보나',
      category: 'pasta',
      area: '연남동',
      address: '서울 마포구 연남동 227-15',
      roadAddress: '서울 마포구 동교로 123',
      kakaoPlaceId: '26338954',
      lat: 37.561,
      lng: 126.925,
    });
  });

  it('clearPlace() → null로 리셋(요약카드 해제)', () => {
    const { result } = renderHook(() => usePlaceSelection());
    act(() => result.current.selectPlace({ item }));
    act(() => result.current.clearPlace());
    expect(result.current.selectedPlace).toBeNull();
  });
});
