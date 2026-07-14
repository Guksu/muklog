// src/features/map/toWishPin.spec.ts
// wishlist_items snake row → WishPin(camel) 매핑 단위 테스트 (map-wish-pins §3.3 / T2, 경계면 §7-2).
//   정상 매핑 / 좌표 비유한·null 시 제외(null 반환) / category null 통과.
import { toWishPin } from './toWishPin';

const row = {
  id: 'w1',
  room_id: 'r1',
  place_name: '성수 칼국수',
  category: 'noodle' as string | null,
  area: '성수동',
  lat: 37.544 as number | null,
  lng: 127.055 as number | null,
};

describe('toWishPin', () => {
  it('snake row를 WishPin으로 매핑한다(id/roomId/placeName/category/area/lat/lng)', () => {
    expect(toWishPin({ row })).toEqual({
      id: 'w1',
      roomId: 'r1',
      placeName: '성수 칼국수',
      category: 'noodle',
      area: '성수동',
      lat: 37.544,
      lng: 127.055,
    });
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
