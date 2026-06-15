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

  // ── slice2 증분 ────────────────────────────────────────────────
  it('saved 분기 핀 색을 직박힌다(saved primary #3366FF / nearby 웜그레이 #B6ABA0)', () => {
    expect(html).toContain('#3366FF');
    expect(html).toContain('#B6ABA0');
    // m.saved로 분기하는 코드 존재.
    expect(html).toContain('m.saved');
  });

  it('MARKER_TAP에 saved 플래그를 동봉한다', () => {
    expect(html).toContain('saved: m.saved');
  });

  it('idle 이벤트로 BOUNDS_CHANGED(sw/ne)를 post한다', () => {
    expect(html).toContain("'idle'");
    expect(html).toContain('BOUNDS_CHANGED');
    expect(html).toContain('getSouthWest');
    expect(html).toContain('getNorthEast');
  });

  // ── map-locate-button 증분 ─────────────────────────────────────
  it('__muklogRecenter 핸들러를 정의하고 panTo로 재센터한다', () => {
    expect(html).toContain('window.__muklogRecenter');
    expect(html).toContain('panTo');
  });

  it('__muklogInit이 me 오버레이를 mkMeOverlay에 보관한다(재센터 시 갱신용)', () => {
    expect(html).toContain('mkMeOverlay');
    // INIT에서 보관(할당)하고 재센터에서 위치 갱신(setPosition).
    expect(html).toContain('mkMeOverlay =');
    expect(html).toContain('setPosition');
  });

  it('__muklogRecenter는 !mkMap / !payload.me 가드를 둔다(런타임 null 방어)', () => {
    expect(html).toContain('!mkMap');
    expect(html).toContain('!payload.me');
  });
});
