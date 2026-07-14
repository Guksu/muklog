// src/features/wishlist/nearbyToWishlistInput.ts
// 주변 음식점(NearbyPlaceItem) → 위시 입력(AddWishlistInput) 매핑 순수 유틸 (plan §3.2 / T1, 경계면 §7-1·2·5).
//   생산자: nearby-search(useNearbyPlaces) 정규화 결과 NearbyPlaceItem. 소비자: useAddNearbyWish → useAddWishlist insert.
//   ⚠️ placeFieldsFromItem은 PlaceSearchItem(주소 필드 보유)을 받으므로 직접 재사용 불가 — NearbyPlaceItem엔
//     address_name/road_address_name이 없다. 그래서 별도 매퍼를 두되 category 매핑만 mapKakaoCategory 공유
//     (함정 방지 단일 출처, 메모리 [[nearby-category-mapping]]).
//   area/roadAddress/note는 항상 null(주변 항목엔 주소·메모 없음). 좌표는 lat·lng 둘 다 유한일 때만 채우고
//     하나라도 비유한이면 둘 다 null(쌍 무결성 — 지도 핀 보호, placeFieldsFromItem 선례).
import { type NearbyPlaceItem } from '@/features/map/types';
import { mapKakaoCategory } from '@/features/muklog/kakaoCategory';

import { type AddWishlistInput } from '../types';

/**
 * NearbyPlaceItem을 위시 추가 입력(AddWishlistInput)으로 변환한다.
 * category는 mapKakaoCategory(단일 출처)로 8종 key|null, area·roadAddress·note는 null(주소·메모 없음),
 * 좌표는 lat·lng 둘 다 유한일 때만 채운다(쌍 무결성).
 * @param item nearby-search 정규화 결과 1건
 * @param roomId 담을 대상 로그 id
 * @returns useAddWishlist가 소비하는 추가 입력
 */
export const nearbyToWishlistInput = ({
  item,
  roomId,
}: {
  item: NearbyPlaceItem;
  roomId: string;
}): AddWishlistInput => {
  const hasCoordPair = Number.isFinite(item.lat) && Number.isFinite(item.lng);
  return {
    roomId,
    placeName: item.placeName,
    category: mapKakaoCategory({
      categoryName: item.categoryName,
      categoryGroupCode: item.categoryGroupCode,
    }),
    area: null,
    roadAddress: null,
    lat: hasCoordPair ? item.lat : null,
    lng: hasCoordPair ? item.lng : null,
    kakaoPlaceId: item.kakaoPlaceId,
    note: null,
  };
};
