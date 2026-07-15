// src/features/map/filterByAppCategory.spec.ts
// 앱 카테고리(8종 key) 순수 필터 단위 테스트 — MuklogPin[]/WishPin[] 공용 (map-category-filter §4.2 / T1, 경계면 §8-1).
//   category=null → 원본(동일 참조) / key 지정 → category 일치 항목만 / 미존재 key → 빈 배열.
import { filterByAppCategory } from './filterByAppCategory';

const item = (id: string, category: string | null) => ({ id, category });

describe('filterByAppCategory', () => {
  it('category=null이면 원본을 그대로(동일 참조) 반환한다("전체")', () => {
    const items = [item('a', 'cafe'), item('b', 'noodle')];
    expect(filterByAppCategory({ items, category: null })).toBe(items);
  });

  it('지정 카테고리 일치 항목만 남긴다', () => {
    const items = [item('a', 'cafe'), item('b', 'noodle'), item('c', 'cafe')];
    expect(filterByAppCategory({ items, category: 'cafe' }).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('null category 항목은 특정 카테고리 필터에서 제외된다', () => {
    const items = [item('a', 'cafe'), item('b', null)];
    expect(filterByAppCategory({ items, category: 'cafe' }).map((i) => i.id)).toEqual(['a']);
  });

  it('존재하지 않는 카테고리로 필터하면 빈 배열을 반환한다', () => {
    const items = [item('a', 'cafe'), item('b', 'noodle')];
    expect(filterByAppCategory({ items, category: 'sushi' })).toEqual([]);
  });

  it('빈 입력이면 빈 배열을 반환한다', () => {
    expect(filterByAppCategory({ items: [], category: 'cafe' })).toEqual([]);
  });

  it('WishPin류(추가 필드 보유)도 category 필드로 필터한다(제네릭)', () => {
    const items = [
      { id: 'w1', roomId: 'r1', placeName: 'A', category: 'pasta', area: null, lat: 1, lng: 2 },
      { id: 'w2', roomId: 'r1', placeName: 'B', category: 'cafe', area: null, lat: 1, lng: 2 },
    ];
    const filtered = filterByAppCategory({ items, category: 'pasta' });
    expect(filtered.map((i) => i.id)).toEqual(['w1']);
    // 제네릭이 추가 필드를 보존한다(마커 변환 전 소스 필터).
    expect(filtered[0].placeName).toBe('A');
  });
});
