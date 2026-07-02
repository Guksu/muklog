// src/features/wishlist/toWishlistItem.spec.ts
// 위시 행(snake) → 뷰(camel) 매핑 명세 (plan §4.4, 경계면 B1·B4).
//   snake→camel 전 필드 매핑, nullable(category/area/road/lat/lng/kakao/note) 보존,
//   addedByMe = added_by === meId 파생(본인/짝꿍 분기의 단일 출처).
import { toWishlistItem } from './toWishlistItem';

const fullRow = {
  id: 'w1',
  room_id: 'r1',
  place_name: '성수동 베이커리',
  category: 'cafe',
  area: '성수동',
  road_address: '서울 성동구 연무장길 1',
  lat: 37.544,
  lng: 127.055,
  kakao_place_id: '12345',
  note: '크루아상 맛집',
  added_by: 'u1',
  created_at: '2026-06-16T10:00:00.000Z',
};

describe('toWishlistItem', () => {
  it('snake 행을 camel 뷰로 전 필드 매핑한다', () => {
    expect(toWishlistItem({ row: fullRow, meId: 'u1' })).toEqual({
      id: 'w1',
      roomId: 'r1',
      placeName: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      roadAddress: '서울 성동구 연무장길 1',
      lat: 37.544,
      lng: 127.055,
      kakaoPlaceId: '12345',
      note: '크루아상 맛집',
      addedBy: 'u1',
      addedByMe: true,
      createdAt: '2026-06-16T10:00:00.000Z',
    });
  });

  it('added_by === meId 면 addedByMe=true (본인)', () => {
    expect(toWishlistItem({ row: fullRow, meId: 'u1' }).addedByMe).toBe(true);
  });

  it('added_by !== meId 면 addedByMe=false (짝꿍)', () => {
    expect(toWishlistItem({ row: fullRow, meId: 'partner' }).addedByMe).toBe(false);
  });

  it('meId가 null 이면 addedByMe=false (세션 미확보 시 본인 단정 금지)', () => {
    expect(toWishlistItem({ row: fullRow, meId: null }).addedByMe).toBe(false);
  });

  it('nullable 컬럼이 null/누락이면 그대로 null로 보존한다(좌표없는 수동 검색)', () => {
    const sparse = {
      id: 'w2',
      room_id: 'r1',
      place_name: '이름만 있는 곳',
      category: null,
      area: null,
      road_address: null,
      lat: null,
      lng: null,
      kakao_place_id: null,
      note: null,
      added_by: 'u9',
      created_at: '2026-06-16T11:00:00.000Z',
    };
    expect(toWishlistItem({ row: sparse, meId: 'u1' })).toEqual({
      id: 'w2',
      roomId: 'r1',
      placeName: '이름만 있는 곳',
      category: null,
      area: null,
      roadAddress: null,
      lat: null,
      lng: null,
      kakaoPlaceId: null,
      note: null,
      addedBy: 'u9',
      addedByMe: false,
      createdAt: '2026-06-16T11:00:00.000Z',
    });
  });
});
