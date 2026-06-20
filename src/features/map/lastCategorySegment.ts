// src/features/map/lastCategorySegment.ts
// 카카오 카테고리 브레드크럼 → 메타 표시용 마지막 세그먼트 순수 유틸 (plan §4).
//   "음식점 > 한식 > 칼국수" → "칼국수". 구분자 '>' 기준 split, 각 토큰 trim, 빈 토큰 제거 후 마지막 토큰 반환.
//   단일 세그먼트면 원문, 빈/공백이면 빈 문자열(카드 buildMeta가 거리만 표시).

/**
 * 카카오 브레드크럼에서 마지막 카테고리 세그먼트를 추출한다(plan §4).
 * '>' 기준 split → 각 토큰 trim → 빈 토큰 제거 → 마지막 토큰. 비어있으면 빈 문자열.
 * @param categoryName 카카오 브레드크럼(예 "음식점 > 한식 > 칼국수")
 * @returns 마지막 세그먼트(빈/공백이면 '')
 */
export const lastCategorySegment = ({ categoryName }: { categoryName: string }): string => {
  const segments = (categoryName ?? '')
    .split('>')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return '';
  return segments[segments.length - 1];
};
