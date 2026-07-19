// src/lib/useOneShotQuery.ts
// "진입 1회 조회 + 명시적 refresh" 공용 데이터 훅.
//   useRoom·useProfile·useWishlist·useRoomMembers·useMyLogs·useMuklogs·useMuklog·useMuklogPins·useWishPins·
//   useNotifPrefs 등 13개 훅에 문자 그대로 반복되던 보일러플레이트를 흡수한다:
//     useState(loading) + mountedRef 마운트 가드 + 명명 effect(deps) + refresh(loading 리셋 안 함) + 판별유니온.
//   각 훅은 "쿼리 + row 매핑"(fetch)과 에러 매핑(mapError)만 남긴다. 폴링/Realtime 없음(비용 가드레일).
//
// 계약(기존 훅과 동일):
//   - ready state 는 { status:'ready' } + fetch 가 반환한 payload(named 필드 그대로 — 소비처 계약 불변).
//   - fetch 는 성공 시 ready payload 를 반환하고, 실패(에러/BAD_RESPONSE)는 throw 한다(mapError 로 메시지화).
//   - refresh() 는 재조회하되 의도적으로 loading 으로 되돌리지 않는다(기존 정책 계승).
//   - deps 변경 시에만 재조회(마운트 포함). 매 렌더 새 fetch 참조여도 재조회 루프 없음(ref 로 최신 클로저 유지).
import React, { useEffect, useRef, useState } from 'react';

/** 조회 상태 판별유니온 — ready 는 payload(T)의 named 필드를 그대로 펼친다. */
export type OneShotState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & T);

/**
 * 진입 1회 조회 + refresh 를 제공하는 공용 훅.
 * @param deps 재조회 트리거(마운트 + 변경 시). roomId 등 — 폴링 방지용으로 좁게 유지.
 * @param fetch 조회+매핑. 성공 시 ready payload(객체) 반환, 실패 시 throw.
 * @param mapError throw 된 에러를 사용자 메시지로 변환(각 도메인 mapXxxError).
 * @returns state(판별유니온)와 refresh(재조회).
 */
export const useOneShotQuery = <T extends object>({
  deps,
  fetch,
  mapError,
}: {
  deps: React.DependencyList;
  fetch: () => Promise<T>;
  mapError: (error: unknown) => string;
}): { state: OneShotState<T>; refresh: () => Promise<void> } => {
  const [state, setState] = useState<OneShotState<T>>({ status: 'loading' });
  const mountedRef = useRef(true);
  // 매 렌더 새 클로저(deps 반영)를 ref 로 최신화 — effect deps 에서 fetch 를 제외해도 최신본을 호출.
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const mapErrorRef = useRef(mapError);
  mapErrorRef.current = mapError;

  const refresh = async (): Promise<void> => {
    try {
      const data = await fetchRef.current();
      if (!mountedRef.current) return;
      setState({ status: 'ready', ...data });
    } catch (error) {
      if (!mountedRef.current) return;
      setState({ status: 'error', message: mapErrorRef.current(error) });
    }
  };

  useEffect(
    function loadOnDeps() {
      mountedRef.current = true;
      void refresh();
      return function cleanup() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps 변경 시에만 재조회(폴링 방지). refresh 의존 시 매 렌더 재조회됨.
    deps,
  );

  return { state, refresh };
};
