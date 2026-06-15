// src/features/map/types.ts
// map-tab 슬라이스 1 데이터·메시지 계약 단일 출처 (plan §3.3·§3.4·§3.5).
//   생산자(RPC snake row) ↔ 소비자(MuklogPin camel) ↔ 지도뷰(MapMarker/메시지) 경계 타입을 한 곳에 고정한다.

/** list_my_muklog_pins RPC가 반환하는 단일 행(snake_case) — 매핑 경계의 단일 출처. */
export type MuklogPinRow = {
  muklog_id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  lat: number; // RPC가 null 필터(NOT NULL 보장) — 단, 문자열로 와도 toMuklogPin이 number로 캐스팅
  lng: number;
};

/** 핀 1건(camelCase). RPC snake row를 toMuklogPin으로 매핑한 결과. */
export type MuklogPin = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key | null
  area: string | null;
  rating: number | null; // 1~5
  lat: number; // 항상 유효(RPC가 null 필터)
  lng: number;
};

/** useMuklogPins 상태(판별 유니온). pins:[] = 빈 상태(정상, 에러 아님). */
export type MuklogPinsState =
  | { status: 'loading' }
  | { status: 'ready'; pins: MuklogPin[] }
  | { status: 'error'; message: string };

/** 좌표 1쌍(현재위치 등). */
export type Coords = { lat: number; lng: number };

/** 지도 라이브러리 무관 영역 표현(zoom은 정수 스케일). */
export type Region = { lat: number; lng: number; zoom: number };

/** 지도뷰(WebView/JS SDK)가 먹는 마커 페이로드. slice1은 전부 saved:true. */
export type MapMarker = {
  id: string; // = muklogId
  lat: number;
  lng: number;
  emoji: string;
  saved: true;
};

/** 위치 권한 상태(enum-style 단일 출처). */
export const LocationPermissionStatus = {
  Undetermined: 'undetermined',
  Requesting: 'requesting',
  Granted: 'granted',
  Denied: 'denied',
} as const;
export type LocationPermissionStatus =
  (typeof LocationPermissionStatus)[keyof typeof LocationPermissionStatus];

/** WebView → RN 메시지 타입(enum-style 단일 출처, plan §3.5). */
export const MapInboundType = {
  Ready: 'READY',
  MarkerTap: 'MARKER_TAP',
  Error: 'ERROR',
} as const;
export type MapInboundType = (typeof MapInboundType)[keyof typeof MapInboundType];

/** RN → WebView 메시지 타입(enum-style 단일 출처, plan §3.5). */
export const MapOutboundType = {
  Init: 'INIT',
  SetMarkers: 'SET_MARKERS',
} as const;
export type MapOutboundType = (typeof MapOutboundType)[keyof typeof MapOutboundType];

/** WebView → RN 파싱 결과(판별 유니온). 비JSON/미지 타입은 parseMapMessage가 null로 흡수. */
export type MapInboundMessage =
  | { type: typeof MapInboundType.Ready }
  | { type: typeof MapInboundType.MarkerTap; id: string }
  | { type: typeof MapInboundType.Error; reason: string };
