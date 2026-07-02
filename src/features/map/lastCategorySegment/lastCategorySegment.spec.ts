// src/features/map/lastCategorySegment.spec.ts
// 카카오 브레드크럼 → 마지막 세그먼트 순수 유틸 단위 테스트 (plan §4·§5-1 C).
import { lastCategorySegment } from './lastCategorySegment';

describe('lastCategorySegment', () => {
  it('다단계 브레드크럼 → 마지막 세그먼트', () => {
    expect(lastCategorySegment({ categoryName: '음식점 > 한식 > 칼국수' })).toBe('칼국수');
  });

  it('단일 세그먼트 → 원문', () => {
    expect(lastCategorySegment({ categoryName: '음식점' })).toBe('음식점');
  });

  it('빈 문자열 → 빈 문자열', () => {
    expect(lastCategorySegment({ categoryName: '' })).toBe('');
  });

  it('앞뒤·세그먼트 공백을 trim한다', () => {
    expect(lastCategorySegment({ categoryName: '  음식점 > 한식  ' })).toBe('한식');
  });

  it('빈 토큰(연속 구분자)을 제거하고 마지막 비어있지 않은 세그먼트를 반환한다', () => {
    expect(lastCategorySegment({ categoryName: '음식점 > 한식 > ' })).toBe('한식');
  });

  it('공백만 있으면 빈 문자열', () => {
    expect(lastCategorySegment({ categoryName: '   ' })).toBe('');
  });
});
