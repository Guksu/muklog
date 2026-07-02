// src/features/map/accumulateNearbyItems/accumulateNearbyItems.ts
// 주변 음식점 핀 세션 누적 병합 (nearby-accumulate plan §3.1).
//   생산자/소비자: useNearbyPlaces(수신 결과 적용 시 교체 대신 누적).
//   semantics: kakaoPlaceId dedup + LRU(재수신 시 최신 데이터로 갱신·최근으로 이동) + cap 초과 시 오래된 것부터 퇴출.
//   id dedup(nearby↔nearby)은 mergeMapMarkers의 좌표 epsilon dedup(saved↔nearby)과 별개 레이어(§7).
import { type NearbyPlaceItem } from '../types';

/**
 * 기존 누적(prev)에 신규 수신(next)을 kakaoPlaceId 기준으로 병합한다(dedup·LRU·cap).
 *   - next의 id가 prev에 이미 있으면: 데이터를 next 값으로 갱신 + 최근 위치로 이동(재확인=recency).
 *   - prev에 없던 id: 뒤에 추가.
 *   - 결과 길이가 cap 초과면 앞(가장 오래된)부터 잘라낸다.
 * @param prev 현재 누적 배열(삽입/최근 순)
 * @param next 이번에 수신한 항목(신규 응답 또는 캐시 히트 결과)
 * @param cap 누적 상한(초과분은 오래된 것부터 퇴출)
 * @returns dedup·LRU·cap 적용된 새 배열(순수 — prev/next 미변형)
 */
export const accumulateNearbyItems = ({
  prev,
  next,
  cap,
}: {
  prev: NearbyPlaceItem[];
  next: NearbyPlaceItem[];
  cap: number;
}): NearbyPlaceItem[] => {
  // 삽입 순서를 유지하는 Map으로 dedup·LRU를 구현(prev 순서로 채운 뒤 next로 갱신/이동).
  const merged = new Map<string, NearbyPlaceItem>();
  for (const prevItem of prev) {
    merged.set(prevItem.kakaoPlaceId, prevItem);
  }
  for (const nextItem of next) {
    // 존재하면 삭제 후 재삽입 → 최근 위치로 이동 + 데이터 최신화. 신규면 뒤에 추가.
    merged.delete(nextItem.kakaoPlaceId);
    merged.set(nextItem.kakaoPlaceId, nextItem);
  }
  // cap 초과 → 가장 오래된(맨 앞) 항목부터 퇴출(LRU).
  while (merged.size > cap) {
    const oldest = merged.keys().next().value;
    if (oldest === undefined) break;
    merged.delete(oldest);
  }
  return [...merged.values()];
};
