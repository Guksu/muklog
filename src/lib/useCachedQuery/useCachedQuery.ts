// src/lib/useCachedQuery/useCachedQuery.ts
// 공유 캐시 조회 훅 (query-cache plan §3.4). useOneShotQuery의 캐시 버전 — 공개 계약은 동일하다.
//
// 왜 어댑터인가: 반환 계약을 { state: OneShotState<T>, refresh }로 유지하면 소비 화면 코드가 한 줄도
//   바뀌지 않는다(D4). 화면은 여전히 status 4분기만 알면 되고, "캐시에서 즉시 그린다"는 성질만 더해진다.
//
// useOneShotQuery와의 차이:
//   - 상태를 화면이 아니라 QueryClient가 소유한다 → 언마운트해도 남아 다음 진입이 loading부터 시작하지 않는다(U58 ①).
//   - deps 대신 queryKey로 격리한다 → 키가 바뀌면 이전 키의 데이터가 새 키의 ready로 새지 않는다(E2 개선).
//   - 재검증 실패는 ready를 덮지 않는다(toOneShotState 판정 순서).
// 폴링은 여전히 없다 — 재조회 트리거는 마운트와 명시적 refresh()(= useRefreshOnFocus)뿐이다(비용 §8).
import { useQuery } from '@tanstack/react-query';

import { type OneShotState } from '@/lib/useOneShotQuery';

import { toOneShotState } from './toOneShotState';

/**
 * 공유 캐시를 경유해 조회하고 기존 OneShotState 계약으로 상태를 제공하는 훅.
 * @param queryKey 캐시 키(queryKeys 모듈 단일 출처 — 리터럴 직접 사용 금지)
 * @param queryFn 조회+매핑. 성공 시 ready payload(객체) 반환, 실패 시 throw(undefined 반환 금지)
 * @param mapError throw된 에러를 사용자 메시지로 변환
 * @returns state(판별유니온)와 refresh(재조회 — 절대 reject하지 않는다)
 */
export const useCachedQuery = <T extends object>({
  queryKey,
  queryFn,
  mapError,
}: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  mapError: (error: unknown) => string;
}): { state: OneShotState<T>; refresh: () => Promise<void> } => {
  const query = useQuery<T>({ queryKey, queryFn });

  // 호출부의 `await refresh()`가 그대로 동작하도록 절대 reject하지 않는다(useOneShotQuery.refresh와 동일 계약).
  //   refetch()는 기본적으로 에러를 결과 객체로 돌려주지만, 방어적으로 catch까지 둔다.
  const refresh = async (): Promise<void> => {
    try {
      await query.refetch();
    } catch {
      // 실패는 state.error로 드러난다(데이터가 이미 있으면 ready 유지).
    }
  };

  return { state: toOneShotState<T>({ data: query.data, error: query.error, mapError }), refresh };
};
