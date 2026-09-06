// src/lib/useCachedQuery/toOneShotState.ts
// 캐시 조회 결과(data/error) → 기존 OneShotState 판별유니온 변환 (query-cache plan §3.4).
//
// 왜 순수 함수인가: 판정 순서가 이번 스프린트의 핵심 계약이라 훅 밖에서 경계값을 못박아야 한다.
// 판정 순서(계약): data → error → loading.
//   - data가 있으면 백그라운드 재조회가 실패해도 ready를 유지한다 → 이미 본 화면이 에러로 덮이지 않는다
//     (오프라인 포커스 복귀 E3, UX 백로그 U14가 이 3개 훅에서 부작용으로 해소된다).
//   - 첫 진입부터 실패(캐시 없음)는 data가 없으므로 기존과 동일하게 전체화면 에러가 된다(E4).
import { type OneShotState } from '@/lib/useOneShotQuery';

/**
 * 캐시 조회 결과를 화면이 소비하는 OneShotState로 변환한다.
 * @param data 조회 성공 payload(없으면 undefined) — ready에서 named 필드로 펼쳐진다
 * @param error 마지막 조회 실패(없으면 null/undefined)
 * @param mapError 실패를 사용자 메시지로 변환(각 도메인 mapXxxError)
 * @returns loading / ready(+payload) / error 판별유니온
 */
export const toOneShotState = <T extends object>({
  data,
  error,
  mapError,
}: {
  data: T | undefined;
  error: unknown;
  mapError: (error: unknown) => string;
}): OneShotState<T> => {
  // 1) data 우선 — 재검증 실패보다 이미 가진 데이터가 강하다.
  if (data !== undefined) return { status: 'ready', ...data } as OneShotState<T>;
  // 2) 데이터가 한 번도 없었던 상태에서의 실패만 에러 화면이 된다.
  if (error !== null && error !== undefined) return { status: 'error', message: mapError(error) };
  // 3) 그 외는 첫 조회 진행 중.
  return { status: 'loading' };
};
