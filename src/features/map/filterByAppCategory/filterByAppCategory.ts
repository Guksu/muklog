// src/features/map/filterByAppCategory.ts
// 앱 카테고리(8종 key) 순수 필터 — MuklogPin[]/WishPin[] 공용 (map-category-filter §4.2 / T1, 경계면 §8-1).
//   생산자: MapTabScreen category state. 소비자: pinsToMapMarkers/wishToMapMarkers 변환 전 소스 필터.
//   category=null("전체") → 원본 동일 참조(파생 재계산 절감). else category 일치 항목만. 마커 브리지 무변경.
//   ⚠️ 제네릭 T extends { category }로 MuklogPin·WishPin 둘 다 커버(추가 필드 보존 — 변환은 필터 후).

/**
 * 앱 카테고리 key로 항목을 필터한다(null="전체" → 원본 반환).
 * @param items category 필드를 가진 항목 배열(MuklogPin[] 또는 WishPin[])
 * @param category 선택 카테고리 key 또는 null("전체")
 * @returns 필터된 배열(null이면 동일 참조)
 */
export const filterByAppCategory = <T extends { category: string | null }>({
  items,
  category,
}: {
  items: T[];
  category: string | null;
}): T[] => {
  if (category === null) return items;
  return items.filter((item) => item.category === category);
};
