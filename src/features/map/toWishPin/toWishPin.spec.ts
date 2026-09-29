// src/features/map/toWishPin.spec.ts
// wishlist_items snake row → WishPin(camel) 매핑 단위 테스트 (map-wish-pins §3.3 / T2, 경계면 §7-2).
//   정상 매핑 / 좌표 비유한·null 시 제외(null 반환) / category null 통과.
//   map-wish-card-visit(U12): 지도 위시 카드 "기록하기" 프리필용 road_address·kakao_place_id 매핑(TW1~TW3).
import { toWishPin } from './toWishPin';

const row = {
  id: 'w1',
  room_id: 'r1',
  place_name: '성수 칼국수',
  category: 'noodle' as string | null,
  area: '성수동',
  road_address: '서울 성동구 연무장길 1' as string | null,
  kakao_place_id: '12345' as string | null,
  lat: 37.544 as number | null,
  lng: 127.055 as number | null,
};

describe('toWishPin', () => {
  it('TW1 snake row를 WishPin으로 매핑한다(id/roomId/placeName/category/area/roadAddress/kakaoPlaceId/lat/lng)', () => {
    expect(toWishPin({ row })).toEqual({
      id: 'w1',
      roomId: 'r1',
      placeName: '성수 칼국수',
      category: 'noodle',
      area: '성수동',
      roadAddress: '서울 성동구 연무장길 1',
      kakaoPlaceId: '12345',
      lat: 37.544,
      lng: 127.055,
    });
  });

  it('TW2 road_address·kakao_place_id가 null이면 null로 옮긴다', () => {
    const pin = toWishPin({ row: { ...row, road_address: null, kakao_place_id: null } });
    expect(pin?.roadAddress).toBeNull();
    expect(pin?.kakaoPlaceId).toBeNull();
  });

  it('TW3 두 키가 없는 행도 undefined가 아니라 null로 맞춘다(에디터 프리필 계약이 string | null)', () => {
    // 컬럼 확장 전 모양의 행(두 키 없음) — 캐스팅으로 타입을 우회해 런타임 방어만 본다.
    const legacy = { id: 'w1', room_id: 'r1', place_name: '성수 칼국수', category: 'noodle', area: '성수동', lat: 37.544, lng: 127.055 };
    const pin = toWishPin({ row: legacy as unknown as typeof row });
    expect(pin).not.toBeNull();
    expect(pin?.roadAddress).toBeNull();
    expect(pin?.kakaoPlaceId).toBeNull();
    expect(Object.keys(pin ?? {})).toEqual(expect.arrayContaining(['roadAddress', 'kakaoPlaceId']));
  });

  it('category/area가 null이어도 통과한다', () => {
    const pin = toWishPin({ row: { ...row, category: null, area: null } });
    expect(pin?.category).toBeNull();
    expect(pin?.area).toBeNull();
  });

  it('문자열 좌표를 Number로 캐스팅한다(드라이버 차이 방어)', () => {
    const pin = toWishPin({ row: { ...row, lat: '37.5' as unknown as number, lng: '127.1' as unknown as number } });
    expect(pin?.lat).toBe(37.5);
    expect(pin?.lng).toBe(127.1);
  });

  it('lat=NaN이면 null을 반환한다(좌표 비유한 제외)', () => {
    expect(toWishPin({ row: { ...row, lat: NaN } })).toBeNull();
  });

  it('lng=Infinity이면 null을 반환한다', () => {
    expect(toWishPin({ row: { ...row, lng: Infinity } })).toBeNull();
  });

  it('lat/lng가 null이면 null을 반환한다(쿼리 필터 방어)', () => {
    expect(toWishPin({ row: { ...row, lat: null } })).toBeNull();
    expect(toWishPin({ row: { ...row, lng: null } })).toBeNull();
  });
});
