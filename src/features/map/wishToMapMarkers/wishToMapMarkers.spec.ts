// src/features/map/wishToMapMarkers.spec.ts
// WishPin[] → MapMarker[](kind:'wish') 변환 단위 테스트 (map-wish-pins §3.3 / T3, 경계면 §7-6).
//   category→CAT 이모지(categories.ts 재사용, 먹로그 핀과 동일) / null→🍽️ 폴백 / 좌표 비유한 제외 / 빈→빈.
import { MUKLOG_CATEGORIES } from '@/features/muklog/categories';

import { wishToMapMarkers } from './wishToMapMarkers';
import { MapPinKind, type WishPin } from '../types';

const wishPin = (over?: Partial<WishPin>): WishPin => ({
  id: 'w1',
  roomId: 'r1',
  placeName: '성수 칼국수',
  category: 'noodle',
  area: '성수동',
  lat: 37.5,
  lng: 127.0,
  ...over,
});

describe('wishToMapMarkers', () => {
  it('각 WishPin을 {id, lat, lng, emoji, kind:wish} 마커로 변환한다(id=wishlist_items.id)', () => {
    const markers = wishToMapMarkers({ pins: [wishPin({ id: 'wX', lat: 1, lng: 2, category: 'noodle' })] });
    expect(markers).toEqual([
      { id: 'wX', lat: 1, lng: 2, emoji: MUKLOG_CATEGORIES.noodle.emoji, kind: MapPinKind.Wish },
    ]);
  });

  it('category가 null/미지면 폴백 이모지(🍽️)를 쓴다', () => {
    const markers = wishToMapMarkers({ pins: [wishPin({ category: null })] });
    expect(markers[0].emoji).toBe('🍽️');
  });

  it('좌표 비유한(NaN/Infinity) 항목은 제외한다(지도 핀 보호)', () => {
    const markers = wishToMapMarkers({
      pins: [wishPin({ id: 'ok' }), wishPin({ id: 'nan', lat: NaN }), wishPin({ id: 'inf', lng: Infinity })],
    });
    expect(markers.map((m) => m.id)).toEqual(['ok']);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(wishToMapMarkers({ pins: [] })).toEqual([]);
  });
});
