// src/features/wishlist/toWishlistRow.spec.ts
// AddWishlistInput → insert snake row 매핑 명세 (plan §4.3 추가, 경계면 B2·B8).
//   camel→snake 매핑, added_by=userId 주입, note 미지정/undefined → null, nullable 보존.
import { toWishlistRow } from './toWishlistRow';
import { type AddWishlistInput } from '../types';

const fullInput: AddWishlistInput = {
  roomId: 'r1',
  placeName: '성수동 베이커리',
  category: 'cafe',
  area: '성수동',
  roadAddress: '서울 성동구 연무장길 1',
  lat: 37.544,
  lng: 127.055,
  kakaoPlaceId: '12345',
  note: null,
};

describe('toWishlistRow', () => {
  it('camel 입력을 snake insert row로 매핑하고 added_by=userId를 주입한다 (B2)', () => {
    expect(toWishlistRow({ input: fullInput, userId: 'u1' })).toEqual({
      room_id: 'r1',
      place_name: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      road_address: '서울 성동구 연무장길 1',
      lat: 37.544,
      lng: 127.055,
      kakao_place_id: '12345',
      note: null,
      added_by: 'u1',
    });
  });

  it('note 미지정(undefined) → null로 채운다(이번 스프린트 입력 UI OUT)', () => {
    const { note, ...withoutNote } = fullInput;
    const row = toWishlistRow({ input: withoutNote, userId: 'u1' });
    expect(row.note).toBeNull();
  });

  it('좌표/kakao/road/area/category null(좌표없는 검색결과)을 그대로 null로 저장한다 (경계)', () => {
    const sparse: AddWishlistInput = {
      roomId: 'r1',
      placeName: '이름만 있는 곳',
      category: null,
      area: null,
      roadAddress: null,
      lat: null,
      lng: null,
      kakaoPlaceId: null,
    };
    expect(toWishlistRow({ input: sparse, userId: 'u9' })).toEqual({
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
    });
  });
});
