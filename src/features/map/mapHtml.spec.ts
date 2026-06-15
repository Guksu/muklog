// src/features/map/mapHtml.spec.ts
// Kakao JS SDK 로드 HTML 생성 함수 단위 테스트 (plan §3.5·§5-1 HTML 템플릿).
//   JS 키 주입(placeholder 치환) / Kakao SDK 스크립트 src / READY·MARKER_TAP·ERROR postMessage 송신부
//   / 마커 직렬화(이모지 렌더)·INIT/SET_MARKERS 핸들러 정의 존재를 문자열로 검증. 실 SDK는 스모크.
import { mapHtml } from './mapHtml';

describe('mapHtml', () => {
  const html = mapHtml({ jsKey: 'TEST_JS_KEY_123' });

  it('주입된 JS 키를 Kakao SDK appkey 쿼리에 담는다(키 placeholder 치환)', () => {
    expect(html).toContain('appkey=TEST_JS_KEY_123');
    expect(html).not.toContain('__KAKAO_JS_KEY__');
  });

  it('Kakao Maps JS SDK를 로드한다', () => {
    expect(html).toContain('dapi.kakao.com/v2/maps/sdk.js');
    expect(html).toContain('kakao.maps.load');
  });

  it('READY/MARKER_TAP/ERROR를 RN으로 postMessage 한다', () => {
    expect(html).toContain('READY');
    expect(html).toContain('MARKER_TAP');
    expect(html).toContain('ERROR');
    expect(html).toContain('ReactNativeWebView.postMessage');
  });

  it('RN→WebView 핸들러(__muklogInit/__muklogSetMarkers)를 정의한다', () => {
    expect(html).toContain('__muklogInit');
    expect(html).toContain('__muklogSetMarkers');
  });

  it('마커 이모지를 렌더하는 마커 생성부를 포함한다(emoji 직렬화)', () => {
    expect(html).toContain('emoji');
    expect(html).toContain('CustomOverlay');
  });

  it('SDK 로드 실패를 ERROR로 송신한다(onerror)', () => {
    expect(html).toContain('onerror');
  });
});
