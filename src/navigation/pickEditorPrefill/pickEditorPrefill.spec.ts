// src/navigation/pickEditorPrefill/pickEditorPrefill.spec.ts
// 위시 → 먹로그 에디터 프리필 7필드 공용 함수 (map-wish-card-visit · U12, PP1~PP3).
//   seam: export 함수의 입력 → 출력. 소비처 두 곳(지도 위시 카드 · 위시 목록)이 같은 7필드를 라우트 파라미터로 싣는다.
//   정확한 키 집합으로 잠근다 — 펼치기(`...wish`)로 id·roomId·note 등이 라우트 파라미터로 새면 실패한다.
import { toWishPin } from '@/features/map/toWishPin';
import { toWishlistItem } from '@/features/wishlist/toWishlistItem';

import { pickEditorPrefill } from './pickEditorPrefill';

// 에디터 프리필 키 7개(문자 그대로 — 라우트 파라미터 타입에서 import하지 않는다).
const PREFILL_KEYS = [
  'area',
  'category',
  'kakaoPlaceId',
  'lat',
  'lng',
  'placeName',
  'roadAddress',
];

describe('pickEditorPrefill', () => {
  it('PP1 지도 위시 핀 모양(+id·roomId) → 정확히 7필드만 옮긴다', () => {
    const wishPin = {
      id: 'w7',
      roomId: 'r2',
      placeName: '연남 파스타',
      category: 'pasta',
      area: '연남동',
      roadAddress: '서울 마포구 동교로 1',
      kakaoPlaceId: '777',
      lat: 37.8,
      lng: 127.3,
    };

    const result = pickEditorPrefill({ wish: wishPin });

    expect(result).toEqual({
      placeName: '연남 파스타',
      category: 'pasta',
      area: '연남동',
      roadAddress: '서울 마포구 동교로 1',
      lat: 37.8,
      lng: 127.3,
      kakaoPlaceId: '777',
    });
    expect(Object.keys(result).sort()).toEqual(PREFILL_KEYS);
  });

  it('PP2 위시 목록 항목 모양(+note·addedBy·addedByMe·createdAt, 좌표 null) → 7필드만, 값은 그대로', () => {
    const wishlistItem = {
      id: 'w9',
      roomId: 'r1',
      placeName: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      roadAddress: '서울 성동구 연무장길 1',
      lat: null,
      lng: null,
      kakaoPlaceId: '12345',
      note: '크루아상',
      addedBy: 'u1',
      addedByMe: true,
      createdAt: '2026-09-01T00:00:00Z',
    };

    const result = pickEditorPrefill({ wish: wishlistItem });

    expect(result).toEqual({
      placeName: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      roadAddress: '서울 성동구 연무장길 1',
      lat: null,
      lng: null,
      kakaoPlaceId: '12345',
    });
    expect(Object.keys(result).sort()).toEqual(PREFILL_KEYS);
  });

  it('PP3 nullable 필드가 모두 null이면 그대로 null(빈 문자열·undefined로 바꾸지 않음), 입력과 다른 객체를 돌려준다', () => {
    const wish = {
      placeName: '이름만 있는 곳',
      category: null,
      area: null,
      roadAddress: null,
      lat: null,
      lng: null,
      kakaoPlaceId: null,
    };

    const result = pickEditorPrefill({ wish });

    expect(result).not.toBe(wish);
    expect(result.category).toBeNull();
    expect(result.area).toBeNull();
    expect(result.roadAddress).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.kakaoPlaceId).toBeNull();
    expect(Object.keys(result).sort()).toEqual(PREFILL_KEYS);
  });

  it('PP4 같은 위시 행이면 지도 경로(toWishPin)와 위시 목록 경로(toWishlistItem)가 같은 프리필·같은 로그를 만든다', () => {
    // wishlist_items 한 행 — 지도 위시 핀 조회와 위시 목록 조회가 같은 테이블에서 읽는다.
    const row = {
      id: 'w7',
      room_id: 'r2',
      place_name: '연남 파스타',
      category: 'pasta',
      area: '연남동',
      road_address: '서울 마포구 동교로 1',
      kakao_place_id: '777',
      lat: 37.8,
      lng: 127.3,
      note: '파스타 맛집',
      added_by: 'u1',
      created_at: '2026-09-01T00:00:00Z',
    };

    const mapPin = toWishPin({ row });
    const listItem = toWishlistItem({ row, meId: 'u1' });
    if (!mapPin) throw new Error('좌표가 있는 행은 지도 핀이 된다');

    expect(pickEditorPrefill({ wish: mapPin })).toEqual(pickEditorPrefill({ wish: listItem }));
    expect(pickEditorPrefill({ wish: mapPin })).toEqual({
      placeName: '연남 파스타',
      category: 'pasta',
      area: '연남동',
      roadAddress: '서울 마포구 동교로 1',
      lat: 37.8,
      lng: 127.3,
      kakaoPlaceId: '777',
    });
    // 지도는 위시의 room_id로, 목록은 그 room_id로 조회한 라우트 roomId로 저장한다 — 둘은 같은 로그다.
    expect(mapPin.roomId).toBe(listItem.roomId);
  });
});
