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

  // ── nearby-first-load 보완: 첫 bounds 명시 emit ────────────────
  // 버그: 첫 nearby 로딩 트리거가 idle 리스너 하나뿐이라 INIT 직후 같은 센터 relayout/setCenter는
  //   idle을 발화하지 않아 첫 BOUNDS_CHANGED가 안 나감 → 사용자가 지도를 움직여야만 조회됨.
  //   수정: init 경로(idle 콜백 밖)에서 relayout 직후 emitBounds()를 명시 1회 호출(사용자 idle 불필요).
  // setTimeout(...) 콜백 본문을 함수명으로 추출(함수 선언 ~ 그 콜백을 마는 `}, <delay>)` 까지).
  //   문자열 매칭이 primary/retry를 구분하도록 콜백 단위로 좁힌다(qa-logic 강화 요청).
  const callbackBody = ({ fnName }: { fnName: string }): string => {
    const start = html.indexOf('function ' + fnName);
    if (start === -1) return '';
    const close = html.slice(start).search(/\}\s*,\s*\d+\s*\)/);
    return close === -1 ? html.slice(start) : html.slice(start, start + close);
  };

  it('primary 0틱 경로(initEmitFirstBounds) 본문에서 첫 bounds를 명시 emit한다 — 사용자 idle 없이 nearby 트리거', () => {
    // 강한 단언: retry(60ms)가 아니라 0틱 즉시 경로 자체에 emit이 있어야 한다(primary만 제거해도 red).
    const primary = callbackBody({ fnName: 'initEmitFirstBounds' });
    expect(primary).not.toBe('');
    expect(primary).toContain('emitBounds()');
    // idle 콜백 등록(addListener(..., emitBounds))이 아닌 직접 호출임도 보장(이 본문엔 addListener 없음).
    expect(primary).not.toContain('addListener');
  });

  it('belt-and-suspenders retry(initEmitFirstBoundsRetry) 본문도 emit을 유지한다(분리 단언)', () => {
    const retry = callbackBody({ fnName: 'initEmitFirstBoundsRetry' });
    expect(retry).not.toBe('');
    expect(retry).toContain('emitBounds()');
  });

  it('emitBounds 명시 호출은 relayout/setCenter(컨테이너 사이즈 확정) 이후에 위치한다', () => {
    const relayoutIdx = html.indexOf('mkMap.relayout()');
    const explicitEmitIdx = html.indexOf('emitBounds();');
    expect(relayoutIdx).toBeGreaterThan(-1);
    expect(explicitEmitIdx).toBeGreaterThan(-1);
    // relayout로 bbox가 유효해진 뒤 emit해야 유효 bbox가 나간다.
    expect(explicitEmitIdx).toBeGreaterThan(relayoutIdx);
  });

  it('idle 리스너는 유지된다(이후 사용자 이동용) — 회귀 0', () => {
    expect(html).toContain("addListener(mkMap, 'idle', emitBounds)");
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
