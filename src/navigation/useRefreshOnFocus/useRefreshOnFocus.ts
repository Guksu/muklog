// src/navigation/useRefreshOnFocus.ts
// 화면 재포커스 시 refresh 재조회 공용 훅.
//   LogScreen·LogListScreen·MapTabScreen·MuklogDetailRoute 에 횩어져 있던 동일 보일러플레이트
//   (refreshRef 최신 참조 + hasFocusedRef 첫 포커스 스킵 + useCallback + useFocusEffect)을 흡수한다.
//   useFocusEffect 는 콜백 참조 안정성이 필수 → 여기서만 예외적으로 useCallback 을 쓴다(컨벤션 허용 예외를 한 곳에 격리).
//   폴링 아님 — 포커스 단위(비용 가드레일). 여러 개를 갱신하려면 호출부가 refresh 콜백에서 조합한다.
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * 화면이 다시 포커스될 때 refresh 를 호출한다.
 * @param refresh 포커스 시 실행할 재조회 콜백(여러 소스는 호출부가 조합). 매 렌더 새 참조여도 최신본을 발화.
 * @param skipFirst 첫 포커스(=마운트 초기 로드와 중복)를 건너뛸지. 기본 true. 지도 탭처럼 첫 포커스도 갱신하려면 false.
 */
export const useRefreshOnFocus = ({
  refresh,
  skipFirst = true,
}: {
  refresh: () => void | Promise<void>;
  skipFirst?: boolean;
}): void => {
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  const hasFocusedRef = React.useRef(false);

  const handleFocus = React.useCallback(
    function refreshOnRefocus() {
      if (skipFirst && !hasFocusedRef.current) {
        hasFocusedRef.current = true; // 첫 포커스 = 마운트 로드 → 중복 조회 가드.
        return;
      }
      void refreshRef.current();
    },
    [skipFirst],
  );
  useFocusEffect(handleFocus);
};
