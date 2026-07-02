// src/features/muklog/categories.ts
// 먹로그 카테고리 enum 단일 출처 (plan §5 T1, §6.4 / A1).
//   UI 출처: ui-design 킷 mk-data.js CAT(8종 key·label·emoji·grad). label·emoji·colors를 단일 출처화한다.
//   colors=[from,to] = 킷 CAT.grad(linear-gradient 140deg)의 두 색. FoodCover가 카테고리별 커버 그라데이션에 사용.
//   이 hex는 음식커버 도메인 데이터(킷 mk-data.js 미러)이므로 categories.ts가 SSOT다(테마 토큰 아님).
//   카테고리는 DB에 자유 text로 저장하고 앱이 8종 enum을 강제한다.
//   미지 key가 들어와도 카드 칩이 깨지지 않도록 categoryLabel/categoryEmoji가 빈 문자열로 안전 흡수(엣지: enum 드리프트).

/** 카테고리 식별 키 — DB category 컬럼에 저장되는 값(자유 text, 앱이 8종 강제). colors=킷 CAT.grad [from,to]. */
export const MUKLOG_CATEGORIES = {
  pasta: { label: '파스타·양식', emoji: '🍝', colors: ['#FFD9A8', '#FF9E7D'] },
  cafe: { label: '카페·디저트', emoji: '☕', colors: ['#F6D2B8', '#C99877'] },
  noodle: { label: '면·한식', emoji: '🍜', colors: ['#FFE1A8', '#FF8A6B'] },
  // #6 고기 — 따뜻한 구이 그라데이션(주황→짙은 구이 갈색). 칩 순서는 한식(noodle) 바로 뒤(고기=한식 인접 종목).
  meat: { label: '고기', emoji: '🍖', colors: ['#FFC58A', '#E2622F'] },
  sushi: { label: '스시·오마카세', emoji: '🍣', colors: ['#FFC7C2', '#FF7E8A'] },
  bakery: { label: '베이커리', emoji: '🥐', colors: ['#FFE7B0', '#F0B45E'] },
  chinese: { label: '중식', emoji: '🥟', colors: ['#FFD2A6', '#E78B5A'] },
  burger: { label: '버거·펍', emoji: '🍔', colors: ['#FFDFA0', '#E69356'] },
  izakaya: { label: '이자카야', emoji: '🍶', colors: ['#FFCBB8', '#E8806B'] },
} as const;

export type MuklogCategoryKey = keyof typeof MUKLOG_CATEGORIES;

/** 칩 렌더 순서(mk-data.js CAT 정의 순서) — 단일 출처. */
export const MUKLOG_CATEGORY_KEYS = Object.keys(MUKLOG_CATEGORIES) as MuklogCategoryKey[];

/**
 * 카테고리 key의 한국어 라벨을 안전하게 반환한다(미존재/null → 빈 문자열).
 * @param key 카테고리 key(또는 null) — DB에서 온 자유 text일 수 있음
 * @returns 라벨 문자열(미지 key는 '')
 */
export const categoryLabel = ({ key }: { key: MuklogCategoryKey | string | null }): string => {
  if (key !== null && key in MUKLOG_CATEGORIES) {
    return MUKLOG_CATEGORIES[key as MuklogCategoryKey].label;
  }
  return '';
};

/**
 * 카테고리 key의 대표 이모지를 안전하게 반환한다(미존재/null → 빈 문자열).
 * @param key 카테고리 key(또는 null)
 * @returns 이모지 문자열(미지 key는 '')
 */
export const categoryEmoji = ({ key }: { key: MuklogCategoryKey | string | null }): string => {
  if (key !== null && key in MUKLOG_CATEGORIES) {
    return MUKLOG_CATEGORIES[key as MuklogCategoryKey].emoji;
  }
  return '';
};

/**
 * 카테고리 key의 커버 그라데이션 [from,to]를 안전하게 반환한다.
 * 킷 FoodCover의 `CAT[cat] || CAT.cafe` 폴백을 정합 — 미지/null key는 cafe 그라데이션.
 * @param key 카테고리 key(또는 null) — DB에서 온 자유 text일 수 있음
 * @returns [from, to] 두 색 튜플(미지 key는 cafe)
 */
export const categoryColors = ({
  key,
}: {
  key: MuklogCategoryKey | string | null;
}): readonly [string, string] => {
  const resolved =
    key !== null && key in MUKLOG_CATEGORIES
      ? MUKLOG_CATEGORIES[key as MuklogCategoryKey]
      : MUKLOG_CATEGORIES.cafe;
  return resolved.colors;
};
