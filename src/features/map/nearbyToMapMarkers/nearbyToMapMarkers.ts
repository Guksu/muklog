// src/features/map/nearbyToMapMarkers.ts
// NearbyPlaceItem[] → 지도뷰 MapMarker[](kind:'nearby') 변환 (plan §3.6·§7 경계면).
//   생산자: searchNearby/useNearbyPlaces(Edge 정규화 결과). 소비자: mergeMapMarkers → 지도뷰 SET_MARKERS.
//   이모지: nearbyCategoryEmoji(categoryName, groupCode) — 종목별 표시 이모지(주변 전용 매핑, 폴백 🍽️ 보장).
//     유틸이 빈 문자열을 반환하지 않으므로 폴백 분기는 유틸 내부가 단일 출처(여기서 === '' 분기 불필요).
//   id = kakaoPlaceId. 좌표 비유한(NaN/Infinity) 항목은 제외(지도 핀 보호 — placeFieldsFromItem 선례).
import { nearbyCategoryEmoji } from '../nearbyCategoryEmoji';
import { MapPinKind, type MapMarker, type NearbyPlaceItem } from '../types';

/**
 * NearbyPlaceItem[]을 주변 음식점 마커(kind:'nearby')로 변환한다.
 * 카테고리는 nearbyCategoryEmoji로 종목별 이모지를 산출(미지/빈은 유틸 내부 폴백 🍽️), 좌표 비유한 항목은 제외한다.
 * @param items nearby-search 정규화 결과(빈 배열이면 빈 배열 반환)
 * @returns kind:'nearby' 마커 배열
 */
export const nearbyToMapMarkers = ({ items }: { items: NearbyPlaceItem[] }): MapMarker[] => {
  const markers: MapMarker[] = [];
  for (const it of items) {
    if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) continue; // 핀 좌표 보호.
    const emoji = nearbyCategoryEmoji({
      categoryName: it.categoryName,
      categoryGroupCode: it.categoryGroupCode,
    });
    markers.push({
      id: it.kakaoPlaceId,
      lat: it.lat,
      lng: it.lng,
      emoji,
      kind: MapPinKind.Nearby,
    });
  }
  return markers;
};
