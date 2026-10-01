// src/navigation/useRefreshOnPushTap/useRefreshOnPushTap.ts
// 알림 탭으로 같은 화면의 params.pushTapAt 만 바뀌었을 때 refresh 를 1회 부르는 훅 (join-push plan §5.5 · AC20).
//   왜 필요한가: 초대한 사람은 로그 화면의 "초대"로 공유 시트를 열고 카카오톡으로 넘어간다 → 앱은 그 로그 화면을 맨 위에 둔 채
//   백그라운드로 간다. 상대가 들어와 합류 알림을 누르면 React Navigation 7 은 같은 이름 화면을 그대로 두고 params 만 바꾼다
//   (포커스 이벤트도 roomId 변화도 없음) → 아무것도 다시 불러오지 않아 새 멤버가 안 보인다. deepLinkRouter 가 싣는
//   pushTapAt(탭 시각)의 변화를 신호로 삼아 이 틈을 메운다.
//   비용 가드레일: 탭 1번에 refresh 1번. 폴링·타이머·AppState 리스너 0.
import { useEffect, useRef } from 'react';

/**
 * 알림 탭으로 같은 화면의 params.pushTapAt 만 바뀌었을 때 refresh 를 1회 부른다.
 *   마운트 때 값(콜드스타트 등)과 roomId 가 함께 바뀐 렌더는 건너뛴다 — 각각 마운트 조회·roomId 재조회가 이미 있다.
 * @param roomId 화면이 보여 주는 로그 id
 * @param pushTapAt 알림 탭 시각(route params — 알림으로 오지 않았으면 undefined)
 * @param refresh 다시 불러올 함수(매 렌더 새 참조여도 가장 최근 것을 부른다)
 */
export const useRefreshOnPushTap = ({
  roomId,
  pushTapAt,
  refresh,
}: {
  roomId: string;
  pushTapAt: number | undefined;
  refresh: () => void | Promise<void>;
}): void => {
  // 최신 refresh — effect deps 에 함수를 넣지 않으려고 ref 로 든다(useRefreshOnFocus 와 같은 방식, useCallback 0).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  // 직전에 본 (roomId, pushTapAt). 첫 값은 마운트 값 → 마운트 렌더는 "변화 없음"으로 건너뛴다.
  const lastSeenRef = useRef({ roomId, pushTapAt });

  useEffect(
    function refreshOnPushTap() {
      const lastSeen = lastSeenRef.current;
      lastSeenRef.current = { roomId, pushTapAt };
      if (pushTapAt === undefined) return; // 알림 탭이 아닌 진입.
      if (lastSeen.roomId !== roomId) return; // 다른 로그로 바뀜 — roomId 에 묶인 훅들이 다시 불러온다.
      if (lastSeen.pushTapAt === pushTapAt) return; // 같은 탭(마운트 값 포함).
      void refreshRef.current();
    },
    [roomId, pushTapAt],
  );
};
