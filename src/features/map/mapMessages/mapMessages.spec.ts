// src/features/map/mapMessages.spec.ts
// RN→WebView 직렬화 헬퍼 단위 테스트 (plan §3.5).
//   buildInitScript / buildSetMarkersScript 가 injectJavaScript에 넣을 JS 문자열을 만든다.
//   페이로드(center/markers/me)가 JSON으로 안전 직렬화되고, window 핸들러 호출 형태인지 검증.
import {
  buildInitScript,
  buildRecenterScript,
  buildSetMarkersScript,
  buildSetSelectedScript,
} from './mapMessages';
import { MapPinKind, type MapMarker, type Region } from '../types';

const center: Region = { lat: 37.5, lng: 127.0, zoom: 5 };
const marker: MapMarker = { id: 'm1', lat: 37.5, lng: 127.0, emoji: '🍝', kind: MapPinKind.Saved };

describe('buildInitScript', () => {
  it('INIT 페이로드(center/markers/me)를 JSON으로 담은 핸들러 호출 스크립트를 만든다', () => {
    const script = buildInitScript({ center, markers: [marker], me: { lat: 1, lng: 2 } });
    expect(script).toContain('__muklogInit');
    expect(script).toContain('"type":"INIT"');
    expect(script).toContain('"lat":37.5');
    expect(script).toContain('🍝');
    // injectJavaScript 관례: true; 로 끝나 평가 경고를 피한다.
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('me가 null이어도 안전 직렬화한다', () => {
    const script = buildInitScript({ center, markers: [], me: null });
    expect(script).toContain('"me":null');
  });
});

describe('buildSetMarkersScript', () => {
  it('SET_MARKERS 페이로드를 담은 핸들러 호출 스크립트를 만든다', () => {
    const script = buildSetMarkersScript({ markers: [marker] });
    expect(script).toContain('__muklogSetMarkers');
    expect(script).toContain('"type":"SET_MARKERS"');
    expect(script).toContain('"id":"m1"');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});

describe('buildRecenterScript', () => {
  it('RECENTER 페이로드(me lat/lng)를 담은 __muklogRecenter 호출 스크립트를 만든다', () => {
    const script = buildRecenterScript({ me: { lat: 37.5665, lng: 126.978 } });
    expect(script).toContain('__muklogRecenter');
    expect(script).toContain('"type":"RECENTER"');
    expect(script).toContain('"lat":37.5665');
    expect(script).toContain('"lng":126.978');
    // injectJavaScript 관례: true; 로 끝나 평가 경고를 피한다.
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('음수/소수 좌표도 정확히 직렬화한다', () => {
    const script = buildRecenterScript({ me: { lat: -33.8, lng: 151.2 } });
    expect(script).toContain('"lat":-33.8');
    expect(script).toContain('"lng":151.2');
  });
});

describe('buildSetSelectedScript', () => {
  it('SET_SELECTED(selectedId) 페이로드를 담은 __muklogSetSelected 호출 스크립트를 만든다', () => {
    const script = buildSetSelectedScript({ selectedId: 'm1' });
    expect(script).toContain('__muklogSetSelected');
    expect(script).toContain('"type":"SET_SELECTED"');
    expect(script).toContain('"selectedId":"m1"');
    // injectJavaScript 관례: true; 로 끝나 평가 경고를 피한다.
    expect(script.trim().endsWith('true;')).toBe(true);
  });

  it('selectedId가 null이면 해제 신호(null)로 직렬화한다', () => {
    const script = buildSetSelectedScript({ selectedId: null });
    expect(script).toContain('"selectedId":null');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});
