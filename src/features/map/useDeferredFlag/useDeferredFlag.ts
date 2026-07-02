// src/features/map/useDeferredFlag.ts
// 콜드스타트 보호용 지연 플래그 — 초기 false → 첫 프레임 후(InteractionManager.runAfterInteractions)
//   + (옵션)추가 idle 지연(delayMs) 경과 시 true (map-prewarm §3.2·§4.1·T1·T6).
//   목적: 무거운 부작용(지도 WebView 프리워밍)을 앱 첫 페인트와 경합시키지 않고 유휴 시점으로 미룬다.
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * 첫 프레임 완료(runAfterInteractions) 후, 옵션 delayMs 추가 지연을 거쳐 true가 되는 지연 플래그.
 * @param delayMs 인터랙션 완료 후 추가로 기다릴 idle 지연(ms). 미지정/0이면 인터랙션 직후 true.
 * @returns 지연 경과 여부(초기 false → 경과 후 true). 언마운트 후에는 setState하지 않는다.
 */
export const useDeferredFlag = ({ delayMs }: { delayMs?: number }): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(
    function scheduleDeferredFlag() {
      let cancelled = false;
      let delayTimer: ReturnType<typeof setTimeout> | null = null;

      const markReady = () => {
        if (!cancelled) setReady(true);
      };

      const afterInteractions = () => {
        if (cancelled) return;
        if (delayMs && delayMs > 0) {
          delayTimer = setTimeout(markReady, delayMs);
        } else {
          // delayMs 미지정/0 — 추가 idle 없이 인터랙션 완료 직후 전환.
          markReady();
        }
      };

      const interactionHandle = InteractionManager.runAfterInteractions(afterInteractions);

      return function cancelDeferredFlag() {
        cancelled = true;
        if (delayTimer) clearTimeout(delayTimer);
        // runAfterInteractions 핸들은 cancel을 제공할 수 있다(타입상 옵셔널 — 있을 때만 정리).
        if (interactionHandle && typeof interactionHandle.cancel === 'function') {
          interactionHandle.cancel();
        }
      };
    },
    [delayMs],
  );

  return ready;
};
