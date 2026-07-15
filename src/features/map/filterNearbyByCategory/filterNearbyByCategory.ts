// src/features/map/filterNearbyByCategory.ts
// 주변 항목(NearbyPlaceItem[]) 카테고리 필터 (map-category-filter §4.2 / T2, 경계면 §8-2).
//   생산자: MapTabScreen category state. 소비자: nearbyToMapMarkers 변환 전 소스 필터.
//   ⚠️ nearby는 category 필드가 없으므로 mapKakaoCategory로 앱 카테고리를 파생해 비교한다 —
//     자체 키워드 매핑 신설 금지, mapKakaoCategory 단일 출처 재사용(메모리 [[nearby-category-mapping]] 함정 방지).
//   category=null("전체") → 원본 동일 참조. 매핑 null(불명확) 항목은 특정 카테고리 필터에서 항상 제외(§7 의도).
import { mapKakaoCategory } from '@/features/muklog/kakaoCategory';

import { type NearbyPlaceItem } from '../types';

/**
 * 주변 항목을 mapKakaoCategory 파생 카테고리로 필터한다(null="전체" → 원본 반환).
 * @param items 주변 음식점 항목 배열(useNearbyPlaces.items)
 * @param category 선택 카테고리 key 또는 null("전체")
 * @returns 필터된 배열(null이면 동일 참조)
 */
export const filterNearbyByCategory = ({
  items,
  category,
}: {
  items: NearbyPlaceItem[];
  category: string | null;
}): NearbyPlaceItem[] => {
  if (category === null) return items;
  return items.filter(
    (item) =>
      mapKakaoCategory({
        categoryName: item.categoryName,
        categoryGroupCode: item.categoryGroupCode,
      }) === category,
  );
};
