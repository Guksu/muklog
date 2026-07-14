// src/features/wishlist/nearbyToWishlistInput.spec.ts
// 주변 음식점(NearbyPlaceItem) → 위시 입력(AddWishlistInput) 매핑 순수 유틸 (plan §3.2 / T1, 경계면 §7-1·2·5).
//   category는 mapKakaoCategory(단일 출처) 결과, area/roadAddress/note는 null(주소 필드 없음),
//   좌표는 lat·lng 둘 다 유한일 때만 채우고 하나라도 비유한이면 둘 다 null(쌍 무결성 — placeFieldsFromItem 선례).
import { type NearbyPlaceItem } from '@/features/map/types';

import { nearbyToWishlistInput } from './nearbyToWishlistInput';

const baseItem: NearbyPlaceItem = {
  kakaoPlaceId: 'k-100',
  placeName: '성수 칼국수',
  categoryName: '음식점 > 한식 > 칼국수',
  categoryGroupCode: 'FD6',
  lat: 37.544,
  lng: 127.055,
  distance: 320,
};

describe('nearbyToWishlistInput', () => {
  it('정상 항목을 필드별로 매핑한다 — category=noodle, area/roadAddress/note=null, 좌표·id·이름 통과 (T1)', () => {
    const input = nearbyToWishlistInput({ item: baseItem, roomId: 'r1' });

    expect(input).toEqual({
      roomId: 'r1',
      placeName: '성수 칼국수',
      category: 'noodle',
      area: null,
      roadAddress: null,
      lat: 37.544,
      lng: 127.055,
      kakaoPlaceId: 'k-100',
      note: null,
    });
  });

  it('category_group_code CE7는 카테고리명과 무관하게 cafe (mapKakaoCategory 규칙)', () => {
    const input = nearbyToWishlistInput({
      item: { ...baseItem, categoryName: '음식점 > 카페', categoryGroupCode: 'CE7' },
      roomId: 'r1',
    });
    expect(input.category).toBe('cafe');
  });

  it('categoryName 빈 문자열이면 category=null (매칭 실패)', () => {
    const input = nearbyToWishlistInput({
      item: { ...baseItem, categoryName: '', categoryGroupCode: 'FD6' },
      roomId: 'r1',
    });
    expect(input.category).toBeNull();
  });

  it('lat=NaN이면 lat·lng 둘 다 null (쌍 무결성), kakaoPlaceId는 통과', () => {
    const input = nearbyToWishlistInput({
      item: { ...baseItem, lat: NaN },
      roomId: 'r1',
    });
    expect(input.lat).toBeNull();
    expect(input.lng).toBeNull();
    expect(input.kakaoPlaceId).toBe('k-100');
  });

  it('lng=Infinity이면 lat·lng 둘 다 null (쌍 무결성)', () => {
    const input = nearbyToWishlistInput({
      item: { ...baseItem, lng: Infinity },
      roomId: 'r1',
    });
    expect(input.lat).toBeNull();
    expect(input.lng).toBeNull();
  });

  it('roomId를 그대로 전달한다', () => {
    const input = nearbyToWishlistInput({ item: baseItem, roomId: 'room-xyz' });
    expect(input.roomId).toBe('room-xyz');
  });
});
