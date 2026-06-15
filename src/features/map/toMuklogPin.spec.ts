// src/features/map/toMuklogPin.spec.ts
// RPC snake row → MuklogPin(camel) 매핑 유틸 단위 테스트 (plan §3.4·§5-1 toMuklogPin).
//   정상 매핑 / null 필드 보존 / lat·lng 문자열도 number 캐스팅.
import { toMuklogPin } from './toMuklogPin';
import { type MuklogPinRow } from './types';

const row = (over?: Partial<MuklogPinRow>): MuklogPinRow => ({
  muklog_id: 'm1',
  room_id: 'r1',
  place_name: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

describe('toMuklogPin', () => {
  it('완전한 row를 camelCase MuklogPin으로 매핑한다 (lat/lng number)', () => {
    expect(toMuklogPin({ row: row() })).toEqual({
      muklogId: 'm1',
      roomId: 'r1',
      placeName: '트라토리아 보나',
      category: 'pasta',
      area: '연남동',
      rating: 5,
      lat: 37.5,
      lng: 127.0,
    });
  });

  it('category/area/rating null을 보존한다', () => {
    const pin = toMuklogPin({ row: row({ category: null, area: null, rating: null }) });
    expect(pin.category).toBeNull();
    expect(pin.area).toBeNull();
    expect(pin.rating).toBeNull();
  });

  it('lat/lng가 문자열로 와도 number로 캐스팅한다', () => {
    const pin = toMuklogPin({
      row: row({ lat: '37.5665' as unknown as number, lng: '126.978' as unknown as number }),
    });
    expect(pin.lat).toBe(37.5665);
    expect(pin.lng).toBe(126.978);
    expect(typeof pin.lat).toBe('number');
  });
});
