// src/features/muklog/filterByCategory.spec.ts
// 카테고리 필터 순수 로직 명세 (plan §5 B2 / §5-1 LogScreen).
//   LogScreen 필터 칩 행: "전체" + 리스트에 존재하는 unique 카테고리. 선택 시 해당 cat만.
import { type Muklog } from './types';
import { filterMuklogsByCategory, muklogCategoriesInUse } from './filterByCategory';

// 테스트용 Muklog 빌더(필요 필드만, 나머지 기본값).
const makeMuklog = ({ id, category }: { id: string; category: string | null }): Muklog => ({
  id,
  roomId: 'room-1',
  placeName: `place-${id}`,
  category,
  area: null,
  memo: null,
  rating: null,
  visitedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  photoCount: 0,
  coverUri: null,
});

describe('muklogCategoriesInUse', () => {
  it('리스트에 존재하는 카테고리만 CAT 정의 순서로 중복 없이 반환', () => {
    const muklogs = [
      makeMuklog({ id: 'a', category: 'cafe' }),
      makeMuklog({ id: 'b', category: 'pasta' }),
      makeMuklog({ id: 'c', category: 'cafe' }), // 중복
    ];
    // MUKLOG_CATEGORY_KEYS 순서: pasta가 cafe보다 앞 → [pasta, cafe]
    expect(muklogCategoriesInUse({ muklogs })).toEqual(['pasta', 'cafe']);
  });

  it('null/미지 카테고리는 제외한다', () => {
    const muklogs = [
      makeMuklog({ id: 'a', category: null }),
      makeMuklog({ id: 'b', category: 'unknown-xyz' }),
      makeMuklog({ id: 'c', category: 'sushi' }),
    ];
    expect(muklogCategoriesInUse({ muklogs })).toEqual(['sushi']);
  });

  it('빈 리스트 → 빈 배열', () => {
    expect(muklogCategoriesInUse({ muklogs: [] })).toEqual([]);
  });
});

describe('filterMuklogsByCategory', () => {
  const muklogs = [
    makeMuklog({ id: 'a', category: 'cafe' }),
    makeMuklog({ id: 'b', category: 'pasta' }),
    makeMuklog({ id: 'c', category: 'cafe' }),
  ];

  it('category=null("전체") → 원본 그대로', () => {
    expect(filterMuklogsByCategory({ muklogs, category: null })).toBe(muklogs);
  });

  it('특정 카테고리 → 해당 cat만', () => {
    const result = filterMuklogsByCategory({ muklogs, category: 'cafe' });
    expect(result.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('일치 없는 카테고리 → 빈 배열', () => {
    expect(filterMuklogsByCategory({ muklogs, category: 'sushi' })).toEqual([]);
  });
});
