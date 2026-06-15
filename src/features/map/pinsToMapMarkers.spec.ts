// src/features/map/pinsToMapMarkers.spec.ts
// MuklogPin[] → MapMarker[] 변환 단위 테스트 (plan §3.4·§5-1 pinsToMapMarkers).
//   category→CAT 이모지(categories.ts 재사용) / 미매핑·null → 폴백 이모지 / saved:true / 빈→빈.
import { MUKLOG_CATEGORIES } from '@/features/muklog/categories';

import { pinsToMapMarkers, PIN_FALLBACK_EMOJI } from './pinsToMapMarkers';
import { type MuklogPin } from './types';

const pin = (over?: Partial<MuklogPin>): MuklogPin => ({
  muklogId: 'm1',
  roomId: 'r1',
  placeName: '가게',
  category: 'pasta',
  area: '연남동',
  rating: 4,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

describe('pinsToMapMarkers', () => {
  it('각 핀을 {id,lat,lng,emoji,saved:true} 마커로 변환한다 (id=muklogId)', () => {
    const markers = pinsToMapMarkers({ pins: [pin({ muklogId: 'mX', lat: 1, lng: 2 })] });
    expect(markers).toEqual([
      { id: 'mX', lat: 1, lng: 2, emoji: MUKLOG_CATEGORIES.pasta.emoji, saved: true },
    ]);
  });

  it('category를 CAT 이모지로 매핑한다(categories.ts 재사용)', () => {
    const markers = pinsToMapMarkers({ pins: [pin({ category: 'sushi' })] });
    expect(markers[0].emoji).toBe(MUKLOG_CATEGORIES.sushi.emoji);
  });

  it('category가 null이면 폴백 이모지를 쓴다', () => {
    const markers = pinsToMapMarkers({ pins: [pin({ category: null })] });
    expect(markers[0].emoji).toBe(PIN_FALLBACK_EMOJI);
  });

  it('미지의 category면 폴백 이모지를 쓴다(enum 드리프트 안전)', () => {
    const markers = pinsToMapMarkers({ pins: [pin({ category: 'unknown_xyz' })] });
    expect(markers[0].emoji).toBe(PIN_FALLBACK_EMOJI);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(pinsToMapMarkers({ pins: [] })).toEqual([]);
  });
});
