// src/features/muklog/categories.spec.ts
// 카테고리 enum 단일 출처 — 8종 key·label·emoji, 안전한 label/emoji 조회 (plan §5 T1, AC: mk-data.js CAT 정합).
import {
  MUKLOG_CATEGORIES,
  MUKLOG_CATEGORY_KEYS,
  categoryLabel,
  categoryEmoji,
  categoryColors,
  type MuklogCategoryKey,
} from './categories';

describe('MUKLOG_CATEGORIES', () => {
  it('mk-data.js CAT와 동일한 8종 key를 가진다', () => {
    expect(MUKLOG_CATEGORY_KEYS).toEqual([
      'pasta',
      'cafe',
      'noodle',
      'sushi',
      'bakery',
      'chinese',
      'burger',
      'izakaya',
    ]);
  });

  it('각 카테고리는 label과 emoji를 가진다', () => {
    MUKLOG_CATEGORY_KEYS.forEach((key) => {
      expect(MUKLOG_CATEGORIES[key].label.length).toBeGreaterThan(0);
      expect(MUKLOG_CATEGORIES[key].emoji.length).toBeGreaterThan(0);
    });
  });

  it('mk-data.js와 label·emoji가 일치한다(드리프트 방지)', () => {
    expect(MUKLOG_CATEGORIES.pasta).toMatchObject({ label: '파스타·양식', emoji: '🍝' });
    expect(MUKLOG_CATEGORIES.cafe).toMatchObject({ label: '카페·디저트', emoji: '☕' });
    expect(MUKLOG_CATEGORIES.izakaya).toMatchObject({ label: '이자카야', emoji: '🍶' });
  });

  it('각 카테고리는 [from,to] 그라데이션 colors를 가진다 (A1, FoodCover)', () => {
    MUKLOG_CATEGORY_KEYS.forEach((key) => {
      expect(MUKLOG_CATEGORIES[key].colors).toHaveLength(2);
    });
  });

  it('mk-data.js CAT.grad와 그라데이션 색이 일치한다(드리프트 방지)', () => {
    expect(MUKLOG_CATEGORIES.pasta.colors).toEqual(['#FFD9A8', '#FF9E7D']);
    expect(MUKLOG_CATEGORIES.sushi.colors).toEqual(['#FFC7C2', '#FF7E8A']);
    expect(MUKLOG_CATEGORIES.izakaya.colors).toEqual(['#FFCBB8', '#E8806B']);
  });
});

describe('categoryLabel / categoryEmoji', () => {
  it('알려진 key는 해당 label/emoji를 반환한다', () => {
    expect(categoryLabel({ key: 'sushi' })).toBe('스시·오마카세');
    expect(categoryEmoji({ key: 'sushi' })).toBe('🍣');
  });

  it('null/미존재 key는 빈 문자열로 안전하게 반환한다(엣지: enum 드리프트)', () => {
    expect(categoryLabel({ key: null })).toBe('');
    expect(categoryEmoji({ key: null })).toBe('');
    expect(categoryLabel({ key: 'unknown' as MuklogCategoryKey })).toBe('');
    expect(categoryEmoji({ key: 'unknown' as MuklogCategoryKey })).toBe('');
  });
});

describe('categoryColors (FoodCover 그라데이션, A1)', () => {
  it('알려진 key는 [from,to] 그라데이션을 반환한다', () => {
    expect(categoryColors({ key: 'pasta' })).toEqual(['#FFD9A8', '#FF9E7D']);
  });

  it('null/미존재 key는 cafe 그라데이션으로 폴백한다(킷 CAT[cat]||CAT.cafe)', () => {
    expect(categoryColors({ key: null })).toEqual(MUKLOG_CATEGORIES.cafe.colors);
    expect(categoryColors({ key: 'unknown' as MuklogCategoryKey })).toEqual(
      MUKLOG_CATEGORIES.cafe.colors,
    );
  });
});
