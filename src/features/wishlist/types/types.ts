// src/features/wishlist/types.ts
// 위시리스트 도메인 타입 단일 출처 (plan §4.3·§4.4).
//   WishlistItem  = 조회/카드가 소비하는 camelCase 형(addedByMe 파생 포함).
//   AddWishlistInput = 추가 플로우(PlaceSearchView pick)가 만드는 원본 입력.
//   WishlistInsertRow = insert 대상 snake_case row(toWishlistRow 산출).

/** 조회된 위시 항목 1건(camelCase). useWishlist가 snake row를 toWishlistItem으로 매핑해 노출. */
export type WishlistItem = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key(8종) | null. 미지 key는 표시단 폴백(cafe)
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
  note: string | null; // 입력 UI OUT, 값 있으면 표시(2줄 clamp)
  addedBy: string; // uuid
  addedByMe: boolean; // 파생: added_by === meId. true=내 프로필 / false=짝꿍 익명
  createdAt: string; // ISO
};

export type WishlistState =
  | { status: 'loading' }
  | { status: 'ready'; items: WishlistItem[] } // [] = 빈 상태(정상)
  | { status: 'error'; message: string };

/** 추가 플로우가 만드는 원본 입력(PlaceSearchView pick → placeFieldsFromItem). note는 이번 스프린트 항상 null. */
export type AddWishlistInput = {
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
  note?: string | null;
};

/** insert 대상 snake_case row(매핑 경계 단일 출처). added_by는 RLS with check와 정합(toWishlistRow가 userId로 채움). */
export type WishlistInsertRow = {
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
};
