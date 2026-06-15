// src/features/map/nearbyToMapMarkers.spec.ts
// NearbyPlaceItem[] → MapMarker[](saved:false) 변환 단위 테스트 (plan §3.4·§5-1 nearbyToMapMarkers).
//   emoji = mapKakaoCategory→categoryEmoji(미매핑 폴백) / id=kakaoPlaceId / 좌표 비유한 제외 / 빈→빈.
import { MUKLOG_CATEGORIES } from '@/features/muklog/categories';

import { nearbyToMapMarkers } from './nearbyToMapMarkers';
import { PIN_FALLBACK_EMOJI } from './pinsToMapMarkers';
import { type NearbyPlaceItem } from './types';

const item = (over?: Partial<NearbyPlaceItem>): NearbyPlaceItem => ({
  kakaoPlaceId: 'k1',
  placeName: '연남 칼국수',
  categoryName: '음식점 > 한식 > 칼국수',
  categoryGroupCode: 'FD6',
  lat: 37.56,
  lng: 126.92,
  distance: 320,
  ...over,
});

describe('nearbyToMapMarkers', () => {
  it('각 item을 {id:kakaoPlaceId, lat, lng, emoji, saved:false} 마커로 변환한다', () => {
    const markers = nearbyToMapMarkers({ items: [item({ kakaoPlaceId: 'kX', lat: 1, lng: 2 })] });
    expect(markers).toEqual([
      { id: 'kX', lat: 1, lng: 2, emoji: MUKLOG_CATEGORIES.noodle.emoji, saved: false },
    ]);
  });

  it('categoryName을 mapKakaoCategory→CAT 이모지로 매핑한다(한식→noodle)', () => {
    const markers = nearbyToMapMarkers({ items: [item({ categoryName: '음식점 > 한식 > 칼국수' })] });
    expect(markers[0].emoji).toBe(MUKLOG_CATEGORIES.noodle.emoji);
  });

  it('카테고리 불명확이면 폴백 이모지를 쓴다', () => {
    const markers = nearbyToMapMarkers({ items: [item({ categoryName: '관광 > 명소' })] });
    expect(markers[0].emoji).toBe(PIN_FALLBACK_EMOJI);
  });

  it('좌표가 비유한(NaN/Infinity)인 item은 결과에서 제외한다(지도 핀 보호)', () => {
    const markers = nearbyToMapMarkers({
      items: [
        item({ kakaoPlaceId: 'ok', lat: 37.5, lng: 127.0 }),
        item({ kakaoPlaceId: 'nan', lat: Number.NaN, lng: 127.0 }),
        item({ kakaoPlaceId: 'inf', lat: 37.5, lng: Number.POSITIVE_INFINITY }),
      ],
    });
    expect(markers.map((m) => m.id)).toEqual(['ok']);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(nearbyToMapMarkers({ items: [] })).toEqual([]);
  });
});
