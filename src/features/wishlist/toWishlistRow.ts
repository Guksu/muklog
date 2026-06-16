// src/features/wishlist/toWishlistRow.ts
// AddWishlistInput(camel) → insert용 snake_case row 매핑 유틸 (plan §4.3, 경계면 B2·B8).
//   added_by는 인증 userId로 채운다 → RLS with check(added_by=auth.uid())와 정합(타인 명의 차단).
//   note는 미지정/undefined를 null로 정규화(이번 스프린트 입력 UI OUT, 항상 null).
import { type AddWishlistInput, type WishlistInsertRow } from './types';

/**
 * 추가 입력(camel)을 insert용 snake row로 만든다(added_by 포함).
 * @param input 추가 플로우(PlaceSearchView pick)가 만든 원본 입력
 * @param userId 인증된 사용자 id(added_by → RLS with check가 auth.uid()와 일치 강제)
 * @returns insert용 snake_case row
 */
export const toWishlistRow = ({
  input,
  userId,
}: {
  input: AddWishlistInput;
  userId: string;
}): WishlistInsertRow => ({
  room_id: input.roomId,
  place_name: input.placeName,
  category: input.category,
  area: input.area,
  road_address: input.roadAddress,
  lat: input.lat,
  lng: input.lng,
  kakao_place_id: input.kakaoPlaceId,
  note: input.note ?? null,
  added_by: userId,
});
