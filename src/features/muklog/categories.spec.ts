// src/features/muklog/categories.spec.ts
// 카테고리 enum 단일 출처 — 8종 key·label·emoji, 안전한 label/emoji 조회 (plan §5 T1, AC: mk-data.js CAT 정합).
import {
  MUKLOG_CATEGORIES,
  MUKLOG_CATEGORY_KEYS,
  categoryLabel,
  categoryEmoji,
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
