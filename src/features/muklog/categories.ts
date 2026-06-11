// src/features/muklog/categories.ts
// 먹로그 카테고리 enum 단일 출처 (plan §5 T1, §6.4).
//   UI 출처: ui-design 킷 mk-data.js CAT(8종 key·label·emoji). grad(웜 그라데이션)는 RN 토큰 표시로 축약 →
//   여기선 label·emoji만 단일 출처화(카드/시트 칩 표시). 카테고리는 DB에 자유 text로 저장하고 앱이 8종 enum을 강제한다.
//   미지 key가 들어와도 카드 칩이 깨지지 않도록 categoryLabel/categoryEmoji가 빈 문자열로 안전 흡수(엣지: enum 드리프트).

/** 카테고리 식별 키 — DB category 컬럼에 저장되는 값(자유 text, 앱이 8종 강제). */
export const MUKLOG_CATEGORIES = {
  pasta: { label: '파스타·양식', emoji: '🍝' },
  cafe: { label: '카페·디저트', emoji: '☕' },
  noodle: { label: '면·한식', emoji: '🍜' },
  sushi: { label: '스시·오마카세', emoji: '🍣' },
  bakery: { label: '베이커리', emoji: '🥐' },
  chinese: { label: '중식', emoji: '🥟' },
  burger: { label: '버거·펍', emoji: '🍔' },
  izakaya: { label: '이자카야', emoji: '🍶' },
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
