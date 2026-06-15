// src/features/map/parseMapMessage.ts
// WebView onMessage 원문(nativeEvent.data) → MapInboundMessage 파싱 (plan §3.5·§7 경계면).
//   생산자: 지도뷰 WebView postMessage(READY/MARKER_TAP/ERROR). 소비자: 지도뷰/ MapTabScreen 디스패치.
//   비JSON·미지 타입·필드 누락은 조용히 null로 흡수한다(throw 금지 — WebView 잡음 메시지 방어).
import { MapInboundType, type Coords, type MapInboundMessage } from './types';

/** 임의 값이 { lat:number, lng:number } 형태인지 검사한다(잡음 메시지 방어). */
const asCoords = ({ value }: { value: unknown }): Coords | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.lat !== 'number' || !Number.isFinite(candidate.lat)) return null;
  if (typeof candidate.lng !== 'number' || !Number.isFinite(candidate.lng)) return null;
  return { lat: candidate.lat, lng: candidate.lng };
};

/**
 * WebView가 보낸 원문 문자열을 MapInboundMessage로 파싱한다.
 * 비JSON / 미지 type / 필수 필드 누락은 null을 반환한다(예외 전파 안 함).
 * @param raw onMessage의 event.nativeEvent.data 원문
 * @returns 파싱된 인바운드 메시지, 해석 불가 시 null
 */
export const parseMapMessage = ({ raw }: { raw: string }): MapInboundMessage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const message = parsed as Record<string, unknown>;

  if (message.type === MapInboundType.Ready) {
    return { type: MapInboundType.Ready };
  }

  if (message.type === MapInboundType.MarkerTap) {
    // slice2: saved 필수 boolean(HTML이 항상 동봉). 누락/비boolean은 null로 흡수.
    if (typeof message.id !== 'string') return null;
    if (typeof message.saved !== 'boolean') return null;
    return { type: MapInboundType.MarkerTap, id: message.id, saved: message.saved };
  }

  if (message.type === MapInboundType.Error) {
    return {
      type: MapInboundType.Error,
      reason: typeof message.reason === 'string' ? message.reason : '',
    };
  }

  if (message.type === MapInboundType.BoundsChanged) {
    // slice2: sw/ne가 둘 다 {lat,lng} 수치일 때만 통과(setCenter/relayout 잡음 idle 방어).
    const sw = asCoords({ value: message.sw });
    const ne = asCoords({ value: message.ne });
    if (!sw || !ne) return null;
    return { type: MapInboundType.BoundsChanged, sw, ne };
  }

  return null;
};
