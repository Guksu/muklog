// src/features/map/parseMapMessage.spec.ts
// WebView onMessage 원문 → MapInboundMessage 파싱 단위 테스트 (plan §3.5·§5-1 onMessage 핸들러).
//   READY / MARKER_TAP(id) / ERROR(reason) 파싱 / 비JSON·미지 타입·필드 누락은 조용히 null(throw 안 함).
import { parseMapMessage } from './parseMapMessage';
import { MapInboundType, MapPinKind } from '../types';

describe('parseMapMessage', () => {
  it('READY 메시지를 파싱한다', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'READY' }) })).toEqual({
      type: MapInboundType.Ready,
    });
  });

  it('MARKER_TAP(id, kind:saved) 메시지를 파싱한다', () => {
    expect(
      parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) }),
    ).toEqual({
      type: MapInboundType.MarkerTap,
      id: 'm9',
      kind: MapPinKind.Saved,
    });
  });

  it('MARKER_TAP(id, kind:nearby) 주변 핀 탭을 파싱한다', () => {
    expect(
      parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k1', kind: 'nearby' }) }),
    ).toEqual({
      type: MapInboundType.MarkerTap,
      id: 'k1',
      kind: MapPinKind.Nearby,
    });
  });

  it('MARKER_TAP(id, kind:wish) 위시 핀 탭을 파싱한다', () => {
    expect(
      parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'w1', kind: 'wish' }) }),
    ).toEqual({
      type: MapInboundType.MarkerTap,
      id: 'w1',
      kind: MapPinKind.Wish,
    });
  });

  it('ERROR(reason) 메시지를 파싱한다', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'sdk' }) })).toEqual({
      type: MapInboundType.Error,
      reason: 'sdk',
    });
  });

  it('비JSON 원문은 throw하지 않고 null을 반환한다', () => {
    expect(parseMapMessage({ raw: 'not-json{' })).toBeNull();
  });

  it('미지 type은 null을 반환한다', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'WAT' }) })).toBeNull();
  });

  it('MARKER_TAP에 id가 없으면 null을 반환한다(필드 누락 방어)', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', kind: 'saved' }) })).toBeNull();
  });

  it('MARKER_TAP에 kind가 없거나 미지 값이면 null을 반환한다(HTML이 항상 동봉, 카드 오분기 방어)', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9' }) })).toBeNull();
    expect(
      parseMapMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'bogus' }) }),
    ).toBeNull();
  });

  it('ERROR에 reason이 없으면 빈 reason으로 흡수한다', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'ERROR' }) })).toEqual({
      type: MapInboundType.Error,
      reason: '',
    });
  });

  it('BOUNDS_CHANGED(sw/ne 수치) 메시지를 파싱한다', () => {
    expect(
      parseMapMessage({
        raw: JSON.stringify({
          type: 'BOUNDS_CHANGED',
          sw: { lat: 37.5, lng: 126.9 },
          ne: { lat: 37.6, lng: 127.1 },
        }),
      }),
    ).toEqual({
      type: MapInboundType.BoundsChanged,
      sw: { lat: 37.5, lng: 126.9 },
      ne: { lat: 37.6, lng: 127.1 },
    });
  });

  it('BOUNDS_CHANGED의 sw/ne가 누락·비수치이면 null을 반환한다(잡음 방어)', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'BOUNDS_CHANGED' }) })).toBeNull();
    expect(
      parseMapMessage({
        raw: JSON.stringify({ type: 'BOUNDS_CHANGED', sw: { lat: 'x', lng: 1 }, ne: { lat: 2, lng: 3 } }),
      }),
    ).toBeNull();
    expect(
      parseMapMessage({
        raw: JSON.stringify({ type: 'BOUNDS_CHANGED', sw: { lat: 1, lng: 2 }, ne: null }),
      }),
    ).toBeNull();
  });

  // ── map-pin-select 증분: MAP_TAP(빈 곳 탭) ─────────────────────────
  it('MAP_TAP(빈 곳 탭) 메시지를 파싱한다(페이로드 없음)', () => {
    expect(parseMapMessage({ raw: JSON.stringify({ type: 'MAP_TAP' }) })).toEqual({
      type: MapInboundType.MapTap,
    });
  });

  it('MAP_TAP에 여분 필드가 있어도 무시하고 파싱한다(형 검증 불필요)', () => {
    expect(
      parseMapMessage({ raw: JSON.stringify({ type: 'MAP_TAP', foo: 1, id: 'x' }) }),
    ).toEqual({ type: MapInboundType.MapTap });
  });
});
