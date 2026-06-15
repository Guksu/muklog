// src/features/map/mapMessages.ts
// RN → WebView 메시지 직렬화 헬퍼 (plan §3.5).
//   생산자: 지도뷰(MapWebView)가 READY 수신/refresh 시 injectJavaScript로 주입. 소비자: mapHtml의 window 핸들러.
//   페이로드를 JSON.stringify로 안전 직렬화해 HTML 측 window.__muklogInit / __muklogSetMarkers를 호출한다.
//   injectJavaScript 관례상 마지막을 `true;`로 끝내 iOS WKWebView 평가 경고를 피한다.
import { MapOutboundType, type Coords, type MapMarker, type Region } from './types';

/**
 * 지도 초기화(INIT) 스크립트를 만든다(center/markers/me 주입).
 * @param center 초기 센터 Region
 * @param markers 표시할 먹로그 마커 배열
 * @param me 현재위치(granted 아니면 null)
 * @returns injectJavaScript에 넣을 JS 문자열
 */
export const buildInitScript = ({
  center,
  markers,
  me,
}: {
  center: Region;
  markers: MapMarker[];
  me: Coords | null;
}): string => {
  const payload = JSON.stringify({ type: MapOutboundType.Init, center, markers, me });
  return `window.__muklogInit && window.__muklogInit(${payload}); true;`;
};

/**
 * 마커 갱신(SET_MARKERS) 스크립트를 만든다(refresh 후).
 * @param markers 갱신할 먹로그 마커 배열
 * @returns injectJavaScript에 넣을 JS 문자열
 */
export const buildSetMarkersScript = ({ markers }: { markers: MapMarker[] }): string => {
  const payload = JSON.stringify({ type: MapOutboundType.SetMarkers, markers });
  return `window.__muklogSetMarkers && window.__muklogSetMarkers(${payload}); true;`;
};
