// src/features/wishlist/toWishlistItem.ts
// 위시 조회 행(snake_case) → WishlistItem(camelCase) 매핑 유틸 (plan §4.4, 경계면 B1·B4).
//   addedByMe = added_by === meId 파생(본인=내 프로필 / 짝꿍=익명 표시의 단일 출처).
//   meId null(세션 미확보)이면 addedByMe=false — 익명 측으로 안전 폴백(본인 단정 금지).
import { type WishlistItem } from './types';

/** 조회 행 형태(snake_case). 매핑 경계의 단일 출처(useWishlist select 컬럼과 정합). */
export type WishlistRow = {
  id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  road_address: string | null;
  lat: number | null;
  lng: number | null;
  kakao_place_id: string | null;
  note: string | null;
  added_by: string;
  created_at: string;
};

/**
 * 위시 조회 행(snake)을 WishlistItem(camel)으로 매핑하고 addedByMe를 파생한다.
 * @param row wishlist_items select가 반환한 단일 행
 * @param meId 현재 로그인 사용자 id(없으면 null) — added_by와 비교해 본인 여부 판정
 * @returns 카드가 소비하는 WishlistItem(addedByMe 포함)
 */
export const toWishlistItem = ({
  row,
  meId,
}: {
  row: WishlistRow;
  meId: string | null;
}): WishlistItem => ({
  id: row.id,
  roomId: row.room_id,
  placeName: row.place_name,
  category: row.category,
  area: row.area,
  roadAddress: row.road_address,
  lat: row.lat,
  lng: row.lng,
  kakaoPlaceId: row.kakao_place_id,
  note: row.note,
  addedBy: row.added_by,
  addedByMe: meId !== null && row.added_by === meId,
  createdAt: row.created_at,
});
