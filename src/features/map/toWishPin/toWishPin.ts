// src/features/map/toWishPin.ts
// wishlist_items snake row → WishPin(camel) 매핑 (map-wish-pins §3.3 / T2, 경계면 §7-2).
//   생산자: useWishPins 크로스-로그 select(snake). 소비자: wishToMapMarkers · MapTabScreen(위시 카드·에디터 프리필).
//   map-wish-card-visit: road_address·kakao_place_id → roadAddress·kakaoPlaceId. 키가 빠진 행도 undefined가 아니라
//     null로 맞춘다 — 에디터 프리필 계약(MuklogEditorPrefill)이 string | null이라 undefined가 라우트 파라미터로 새지 않게.
//   좌표 방어: 쿼리가 lat/lng not null을 보장하나, null/문자열/비유한이 새어도 null 반환(호출측이 필터)로 지도 핀 보호.
//   먹로그 핀 트리오(toMuklogPin) 미러 — id=wishlist_items.id(kind 판별자로 탭 컬렉션 구분).
import { type WishPin } from '../types';

/** wish 핀 조회 select 행(snake_case). 매핑 경계 단일 출처. */
export type WishPinRow = {
  id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  road_address: string | null;
  kakao_place_id: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * wishlist_items 행(snake)을 WishPin(camel)으로 매핑한다. 좌표가 null/비유한이면 null을 반환(호출측 제외).
 * @param row 크로스-로그 select 행(좌표 not null 필터 통과분)
 * @returns WishPin 또는 좌표 결측/비유한 시 null
 */
export const toWishPin = ({ row }: { row: WishPinRow }): WishPin | null => {
  if (row.lat == null || row.lng == null) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    placeName: row.place_name,
    category: row.category,
    area: row.area,
    roadAddress: row.road_address ?? null,
    kakaoPlaceId: row.kakao_place_id ?? null,
    lat,
    lng,
  };
};
