// src/features/map/nearbyToMapMarkers.ts
// NearbyPlaceItem[] → 지도뷰 MapMarker[](saved:false) 변환 (plan §3.4·§7 경계면).
//   생산자: searchNearby/useNearbyPlaces(Edge 정규화 결과). 소비자: mergeMapMarkers → 지도뷰 SET_MARKERS.
//   이모지: mapKakaoCategory(categoryName, groupCode)→categoryEmoji 재사용(중복 정의 금지 §7). 미매핑/null → PIN_FALLBACK_EMOJI.
//   id = kakaoPlaceId. 좌표 비유한(NaN/Infinity) 항목은 제외(지도 핀 보호 — placeFieldsFromItem 선례).
import { categoryEmoji } from '@/features/muklog/categories';
import { mapKakaoCategory } from '@/features/muklog/kakaoCategory';

import { PIN_FALLBACK_EMOJI } from './pinsToMapMarkers';
import { type MapMarker, type NearbyPlaceItem } from './types';

/**
 * NearbyPlaceItem[]을 주변 음식점 마커(saved:false)로 변환한다.
 * 카테고리는 mapKakaoCategory→categoryEmoji로 매핑(미매핑은 폴백 이모지), 좌표 비유한 항목은 제외한다.
 * @param items nearby-search 정규화 결과(빈 배열이면 빈 배열 반환)
 * @returns saved:false 마커 배열
 */
export const nearbyToMapMarkers = ({ items }: { items: NearbyPlaceItem[] }): MapMarker[] => {
  const markers: MapMarker[] = [];
  for (const it of items) {
    if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) continue; // 핀 좌표 보호.
    const key = mapKakaoCategory({
      categoryName: it.categoryName,
      categoryGroupCode: it.categoryGroupCode,
    });
    const emoji = categoryEmoji({ key });
    markers.push({
      id: it.kakaoPlaceId,
      lat: it.lat,
      lng: it.lng,
      emoji: emoji === '' ? PIN_FALLBACK_EMOJI : emoji,
      saved: false,
    });
  }
  return markers;
};
