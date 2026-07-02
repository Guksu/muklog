// src/features/map/accumulateNearbyItems/accumulateNearbyItems.spec.ts
// 주변 핀 누적 병합 단위 테스트 (nearby-accumulate plan §5 T1·§5-1).
//   합집합·kakaoPlaceId dedup(중복 미증가)·recency(재수신 최근 이동)·cap LRU 퇴출·빈 prev/next 경계·순수성.
import { accumulateNearbyItems } from './accumulateNearbyItems';
import { type NearbyPlaceItem } from '../types';

const item = (id: string, over?: Partial<NearbyPlaceItem>): NearbyPlaceItem => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: null,
  ...over,
});

const ids = (arr: NearbyPlaceItem[]) => arr.map((it) => it.kakaoPlaceId);

describe('accumulateNearbyItems (T1)', () => {
  it('겹치지 않는 prev+next를 합집합으로 누적한다', () => {
    const result = accumulateNearbyItems({
      prev: [item('1'), item('2')],
      next: [item('3'), item('4')],
      cap: 100,
    });
    expect(ids(result)).toEqual(['1', '2', '3', '4']);
  });

  it('kakaoPlaceId 중복은 증가시키지 않는다(dedup)', () => {
    const result = accumulateNearbyItems({
      prev: [item('1'), item('2')],
      next: [item('2'), item('3')],
      cap: 100,
    });
    expect(ids(result)).toEqual(['1', '2', '3']); // 2는 재수신(제자리·최신화), 3은 신규 뒤 추가 — 중복 미증가
  });

  it('재수신 시 최신 데이터로 갱신하고 최근 위치로 이동한다(recency)', () => {
    const result = accumulateNearbyItems({
      prev: [item('1', { placeName: '옛이름' }), item('2')],
      next: [item('1', { placeName: '새이름' })],
      cap: 100,
    });
    expect(ids(result)).toEqual(['2', '1']); // 1이 최근으로 이동
    expect(result.find((it) => it.kakaoPlaceId === '1')?.placeName).toBe('새이름'); // 최신 데이터
  });

  it('cap 초과 시 가장 오래된 것부터 퇴출한다(LRU, 길이=cap)', () => {
    const result = accumulateNearbyItems({
      prev: [item('1'), item('2'), item('3')],
      next: [item('4')],
      cap: 3,
    });
    expect(result).toHaveLength(3);
    expect(ids(result)).toEqual(['2', '3', '4']); // 최고참 1 퇴출
  });

  it('재수신으로 최근이 된 항목은 cap 퇴출을 면한다(LRU 정확성)', () => {
    // 1을 재수신 → 최근으로 이동. cap=3 초과 시 1이 아니라 2가 퇴출되어야 한다.
    const result = accumulateNearbyItems({
      prev: [item('1'), item('2'), item('3')],
      next: [item('1'), item('4')],
      cap: 3,
    });
    expect(ids(result)).toEqual(['3', '1', '4']); // 2 퇴출(가장 오래 안 봄)
  });

  it('빈 next면 prev를 그대로 반환한다(cap만 적용)', () => {
    const result = accumulateNearbyItems({ prev: [item('1'), item('2')], next: [], cap: 100 });
    expect(ids(result)).toEqual(['1', '2']);
  });

  it('빈 prev면 next를 cap 적용해 반환한다', () => {
    const result = accumulateNearbyItems({
      prev: [],
      next: [item('1'), item('2'), item('3')],
      cap: 2,
    });
    expect(ids(result)).toEqual(['2', '3']); // 앞(오래된)부터 잘림
  });

  it('순수 함수 — prev/next 입력 배열을 변형하지 않는다', () => {
    const prev = [item('1')];
    const next = [item('2')];
    accumulateNearbyItems({ prev, next, cap: 100 });
    expect(ids(prev)).toEqual(['1']);
    expect(ids(next)).toEqual(['2']);
  });
});
