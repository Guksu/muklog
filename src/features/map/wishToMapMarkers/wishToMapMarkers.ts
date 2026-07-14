// src/features/map/wishToMapMarkers.ts
// WishPin[] → 지도뷰 MapMarker[](kind:'wish') 변환 (map-wish-pins §3.3·§7 경계면).
//   생산자: useWishPins(pins). 소비자: mergeMapMarkers → 지도뷰 SET_MARKERS.
//   이모지: categoryEmoji(categories.ts) — 먹로그 핀과 동일 CAT 매핑 재사용(드리프트 방지 §7-6), 미지/null은 폴백 🍽️.
//   좌표 비유한(NaN/Infinity) 항목은 제외(지도 핀 보호 — pinsToMapMarkers/nearbyToMapMarkers 선례).
import { categoryEmoji } from '@/features/muklog/categories';

import { PIN_FALLBACK_EMOJI } from '../pinsToMapMarkers';
import { MapPinKind, type MapMarker, type WishPin } from '../types';

/**
 * 위시 category → 핀/카드 공용 이모지(categoryEmoji, 빈/미지는 폴백 🍽️).
 * ⚠️ 카드(WishSpotCard.coverEmoji)와 핀(wishToMapMarkers.emoji)이 이 함수를 공유해 글리프 드리프트를 막는다(plan §7-6).
 * @param category CAT key | null
 * @returns 이모지 글리프(빈/미지는 🍽️)
 */
export const wishPinEmoji = ({ category }: { category: string | null }): string => {
  const emoji = categoryEmoji({ key: category });
  return emoji === '' ? PIN_FALLBACK_EMOJI : emoji;
};

/**
 * WishPin[]을 위시 마커(kind:'wish')로 변환한다.
 * category는 wishPinEmoji로 매핑(빈/미지는 폴백 🍽️), 좌표 비유한 항목은 제외한다.
 * @param pins 위시 핀 목록(빈 배열이면 빈 배열 반환)
 * @returns kind:'wish' 마커 배열
 */
export const wishToMapMarkers = ({ pins }: { pins: WishPin[] }): MapMarker[] => {
  const markers: MapMarker[] = [];
  for (const p of pins) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue; // 핀 좌표 보호.
    markers.push({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      emoji: wishPinEmoji({ category: p.category }),
      kind: MapPinKind.Wish,
    });
  }
  return markers;
};
