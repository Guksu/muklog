// src/features/map/MapPrewarm.tsx
// 루트 레벨 숨김 1×1 WebView 프리워머 — 전략 A′ (map-prewarm §3.2·§4.0·§4.1, T2·T3·T4·T6).
//   책임: mapHtml을 유휴 시점에 1회 숨김 마운트해 WKWebView 프로세스·네트워크·Kakao SDK HTTP 캐시를 워밍(READY까지만).
//          지도탭은 평소처럼 자기 WebView를 새로 마운트하되, 워밍된 환경 덕에 부팅이 빨라진다(인스턴스 비공유).
//   NON-책임: 권한 요청·핀 RPC·INIT 송신은 전부 MapTabScreen의 몫 — 프리워머는 절대 호출하지 않는다.
//     → useLocationPermission·useMuklogPins을 import조차 하지 않음(권한 팝업·RPC 앞당김의 구조적 차단).
//     → injectJavaScript(INIT/SET_MARKERS/RECENTER) 미호출 = blank 부팅(지도/마커 안 그림, SDK 로드까지만).
//   콜드스타트 비경합: useDeferredFlag로 첫 프레임 후/유휴 시점에만 WebView를 마운트(홈 첫 페인트와 경합 최소화).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MapWebView, type MapWebViewMessageEvent } from '@/features/map/components';
import { mapHtml } from '@/features/map/mapHtml';
import { env } from '@/lib/env';

// 프리워밍 시작 지연(ms) — 첫 프레임(runAfterInteractions) 후 추가 idle. 콜드스타트 보호 우선이라 넉넉히.
const PREWARM_DELAY_MS = 1200;

import { useDeferredFlag } from '@/features/map/useDeferredFlag';

export type MapPrewarmProps = {
  /** false면 렌더 안 함(프리워밍 비활성·테스트 토글·저사양 킬 스위치). 기본 true. */
  enabled?: boolean;
};

// 프리워머 WebView → RN 메시지 핸들러. READY/ERROR만 도착하며(INIT 미송신 = blank 부팅),
//   인스턴스 비공유라 지도탭이 이 상태를 읽지 않으므로 별도 RN state 없이 모두 조용히 무시한다.
//   프리워밍 실패도 사용자 영향 0 — 지도탭이 자기 WebView에서 재부팅·에러를 처리한다.
const handlePrewarmMessage = (_event: MapWebViewMessageEvent) => {};

/**
 * 인증 사용자 세션에서 지도 WebView를 유휴 시점에 1회 숨김 마운트해 부팅 비용을 미리 워밍하는 프리워머.
 * @param enabled false면 렌더하지 않음(킬 스위치). 기본 true.
 * @returns 숨김 WebView(deferred true일 때) 또는 null.
 */
export const MapPrewarm = ({ enabled = true }: MapPrewarmProps): JSX.Element | null => {
  const deferred = useDeferredFlag({ delayMs: PREWARM_DELAY_MS });

  // 킬 스위치 OFF 또는 콜드스타트 보호(첫 프레임 전) → 미렌더. INIT을 안 보내므로 blank 부팅.
  if (!enabled || !deferred) return null;

  const html = mapHtml({ jsKey: env.KAKAO_JS_KEY });

  // 숨김 1×1: 레이아웃·입력·접근성 트리 영향 0. 0×0이면 일부 엔진이 스크립트 실행을 미루므로 1×1(plan §4.1).
  return (
    <View
      testID="map-prewarm-webview"
      style={styles.hidden}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MapWebView html={html} onMessage={handlePrewarmMessage} />
    </View>
  );
};

const styles = StyleSheet.create({
  // 화면 밖·최소 크기·투명 — 가시/레이아웃/입력 영향 0(SDK 부팅만 진행).
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0 },
});
