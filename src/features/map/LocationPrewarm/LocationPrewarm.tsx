// src/features/map/LocationPrewarm/LocationPrewarm.tsx
// 위치 선취득 프리워머 — MapPrewarm의 형제(map-initial-location plan §3.3, T3·T4).
//   책임: 앱 구동(인증 세션) 유휴 시점에 OS 캐시 위치를 1회 워밍해, 지도 탭 첫 진입의 렌더 1이
//          이미 좌표를 손에 쥔 상태가 되게 한다(서울시청 폴백 → 수 초 후 점프 제거).
//   NON-책임: 권한 요청·GPS 픽스·지도 INIT 일체 없음 — 워밍은 비프롬프트 권한 게이트를 통과한
//          OS 캐시 읽기 1회뿐이다(권한 팝업 앞당김·배터리 소모의 구조적 차단, §6 E1·§8).
//   렌더 산출물은 항상 null — 레이아웃·접근성·비주얼 영향 0(ui-publisher 판정: 퍼블리싱 불필요).
import { useEffect, useRef } from 'react';

import { warmLastKnownLocation } from '@/features/map/lastKnownLocation';
import { useDeferredFlag } from '@/features/map/useDeferredFlag';

/** 워밍 시작 지연(ms) — 첫 페인트 후 유휴. MapPrewarm(1200ms)보다 앞서 끝내 같은 프레임 경합 0(E15).
 *  위치 워밍은 렌더·네트워크 비용이 사실상 0이라 무거운 WebView 워밍보다 먼저 처리하는 게 유리하다. */
export const LOCATION_PREWARM_DELAY_MS = 400;

export type LocationPrewarmProps = {
  /** false면 워밍하지 않음(킬 스위치·테스트 토글). 기본 true. */
  enabled?: boolean;
};

/**
 * 인증 사용자 세션에서 OS 캐시 위치를 유휴 시점에 1회 선취득하는 프리워머(렌더 산출물 없음).
 * @param enabled false면 워밍하지 않음(킬 스위치). 기본 true.
 * @returns 항상 null(UI 트리 영향 0)
 */
export const LocationPrewarm = ({ enabled = true }: LocationPrewarmProps): null => {
  const deferred = useDeferredFlag({ delayMs: LOCATION_PREWARM_DELAY_MS });
  // 세션 1회 가드(모듈의 멱등 가드와 이중 방어) — 리렌더·플래그 재평가에도 워밍은 1회.
  const warmedRef = useRef(false);

  useEffect(
    function warmLastKnownLocationOnce() {
      if (!enabled || !deferred) return;
      if (warmedRef.current) return;
      warmedRef.current = true;
      // 결과는 모듈 캐시로 흘러가므로 여기선 대기하지 않는다(실패도 조용히 null — 폴백 체인 불변).
      void warmLastKnownLocation();
    },
    [enabled, deferred],
  );

  return null;
};
