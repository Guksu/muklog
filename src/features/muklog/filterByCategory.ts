// src/features/muklog/filterByCategory.ts
// 카테고리 필터 순수 로직 (plan §5 B2, AC LogScreen). 백엔드 무관 — 보유 useMuklogs 데이터로 산출.
//   LogScreen 카테고리 필터 칩 행: "전체"(null) + 리스트에 실제 존재하는 8종 enum 카테고리(unique).
//   선택 상태(useState)는 화면이 보유, 이 파일은 "존재 카테고리 도출"·"필터" 순수 함수만 담당(테스트 용이).
import { MUKLOG_CATEGORY_KEYS, type MuklogCategoryKey } from './categories';
import { type Muklog } from './types';

/**
 * 먹로그 리스트에 실제 존재하는 카테고리를 CAT 정의 순서로 중복 없이 반환한다(null/미지 enum 제외).
 * @param muklogs 조회된 먹로그 목록(useMuklogs)
 * @returns 필터 칩으로 노출할 카테고리 key 배열(존재하는 것만, 정의 순서)
 */
export const muklogCategoriesInUse = ({
  muklogs,
}: {
  muklogs: Muklog[];
}): MuklogCategoryKey[] => {
  const present = new Set(muklogs.map((muklog) => muklog.category));
  // MUKLOG_CATEGORY_KEYS(킷 정의 순서)를 기준으로 필터 → 칩 순서 안정 + 미지/null 자동 배제.
  return MUKLOG_CATEGORY_KEYS.filter((key) => present.has(key));
};

/**
 * 선택된 카테고리로 먹로그 리스트를 필터한다(null="전체" → 원본 반환).
 * @param muklogs 조회된 먹로그 목록
 * @param category 선택 카테고리 key 또는 null("전체")
 * @returns 필터된 목록(null이면 동일 참조)
 */
export const filterMuklogsByCategory = ({
  muklogs,
  category,
}: {
  muklogs: Muklog[];
  category: string | null;
}): Muklog[] => {
  if (category === null) return muklogs;
  return muklogs.filter((muklog) => muklog.category === category);
};
