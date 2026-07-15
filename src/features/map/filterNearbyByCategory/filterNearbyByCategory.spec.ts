// src/features/map/filterNearbyByCategory.spec.ts
// 주변 항목(NearbyPlaceItem[]) 카테고리 필터 단위 테스트 — mapKakaoCategory 파생으로 비교 (map-category-filter §4.2 / T2, 경계면 §8-2).
//   재매핑 금지(mapKakaoCategory 단일 출처 재사용). null → 전체 / 파생 카테고리 일치만 / 매핑 불가는 특정 필터 전부 탈락.
import { filterNearbyByCategory } from './filterNearbyByCategory';
import { type NearbyPlaceItem } from '../types';

const item = (over?: Partial<NearbyPlaceItem>): NearbyPlaceItem => ({
  kakaoPlaceId: 'k1',
  placeName: '연남 카페',
  categoryName: '음식점 > 카페 > 스페셜티커피',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 100,
  ...over,
});

describe('filterNearbyByCategory', () => {
  it('category=null이면 원본을 그대로(동일 참조) 반환한다("전체")', () => {
    const items = [item(), item({ kakaoPlaceId: 'k2' })];
    expect(filterNearbyByCategory({ items, category: null })).toBe(items);
  });

  it('mapKakaoCategory 파생이 일치하는 항목만 남긴다("카페 > 스페셜티커피" → cafe 통과)', () => {
    const items = [item({ kakaoPlaceId: 'cafe1', categoryName: '음식점 > 카페 > 스페셜티커피' })];
    expect(filterNearbyByCategory({ items, category: 'cafe' }).map((i) => i.kakaoPlaceId)).toEqual([
      'cafe1',
    ]);
  });

  it('같은 항목을 다른 카테고리(noodle)로 필터하면 탈락한다', () => {
    const items = [item({ categoryName: '음식점 > 카페 > 스페셜티커피' })];
    expect(filterNearbyByCategory({ items, category: 'noodle' })).toEqual([]);
  });

  it('categoryGroupCode CE7는 카테고리명과 무관하게 cafe로 파생돼 cafe 필터 통과', () => {
    const items = [item({ kakaoPlaceId: 'ce7', categoryName: '음식점', categoryGroupCode: 'CE7' })];
    expect(filterNearbyByCategory({ items, category: 'cafe' }).map((i) => i.kakaoPlaceId)).toEqual([
      'ce7',
    ]);
  });

  it('매핑 불가(빈 categoryName) 항목은 특정 카테고리 필터에서 모두 탈락한다', () => {
    const items = [item({ categoryName: '', categoryGroupCode: 'FD6' })];
    expect(filterNearbyByCategory({ items, category: 'cafe' })).toEqual([]);
    expect(filterNearbyByCategory({ items, category: 'noodle' })).toEqual([]);
  });

  it('한식>칼국수는 noodle로 파생돼 noodle 통과·cafe 탈락', () => {
    const items = [item({ kakaoPlaceId: 'n1', categoryName: '음식점 > 한식 > 칼국수' })];
    expect(filterNearbyByCategory({ items, category: 'noodle' }).map((i) => i.kakaoPlaceId)).toEqual([
      'n1',
    ]);
    expect(filterNearbyByCategory({ items, category: 'cafe' })).toEqual([]);
  });
});
