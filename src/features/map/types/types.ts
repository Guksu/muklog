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

/** 지도뷰(WebView/JS SDK)가 먹는 마커 페이로드.
 *  slice2: saved를 boolean으로 폭 확장(true=내 맛집 primary / false=주변 음식점 mapNearbyPin).
 *  pinsToMapMarkers는 리터럴 true를 그대로 생산(회귀 0), nearbyToMapMarkers가 false를 생산. */
export type MapMarker = {
  id: string; // saved=muklogId / nearby=kakaoPlaceId
  lat: number;
  lng: number;
  emoji: string;
  saved: boolean;
};

/** nearby-search Edge Function 응답 1건(camelCase, plan §3.2).
 *  place-search PlaceSearchItem과 별도(주변은 address/road/phone 불필요, distance 추가). */
export type NearbyPlaceItem = {
  kakaoPlaceId: string; // Kakao documents[].id
  placeName: string; // place_name
  categoryName: string; // category_name(브레드크럼)
  categoryGroupCode: string; // 항상 'FD6'(요청 제약)
  lat: number; // y → number
  lng: number; // x → number
  distance: number | null; // documents[].distance(문자열 m) → number. center 없으면 null
};

/** 주변 음식점 조회 UI 상태(plan §3.5) — useNearbyPlaces.status 단일 출처. */
export type NearbyPlacesStatus = 'idle' | 'loading' | 'ready' | 'error';

/** 위치 권한 상태(enum-style 단일 출처). */
export const LocationPermissionStatus = {
  Undetermined: 'undetermined',
  Requesting: 'requesting',
  Granted: 'granted',
  Denied: 'denied',
} as const;
export type LocationPermissionStatus =
  (typeof LocationPermissionStatus)[keyof typeof LocationPermissionStatus];

/** WebView → RN 메시지 타입(enum-style 단일 출처, plan §3.5·§3.6). */
export const MapInboundType = {
  Ready: 'READY',
  MarkerTap: 'MARKER_TAP',
  Error: 'ERROR',
  BoundsChanged: 'BOUNDS_CHANGED', // slice2: idle 이벤트 viewport bbox 통지
  MapTap: 'MAP_TAP', // map-pin-select: 지도 빈 곳 탭(선택 해제 신호, 페이로드 없음)
} as const;
export type MapInboundType = (typeof MapInboundType)[keyof typeof MapInboundType];

/** RN → WebView 메시지 타입(enum-style 단일 출처, plan §3.5). */
export const MapOutboundType = {
  Init: 'INIT',
  SetMarkers: 'SET_MARKERS',
  Recenter: 'RECENTER', // 현재위치로 panTo + me 마커 갱신(map-locate-button)
  SetSelected: 'SET_SELECTED', // map-pin-select: 활성 핀 id 전달(null=해제, 클래스 토글만)
} as const;
export type MapOutboundType = (typeof MapOutboundType)[keyof typeof MapOutboundType];

/** WebView → RN 파싱 결과(판별 유니온). 비JSON/미지 타입은 parseMapMessage가 null로 흡수.
 *  slice2: MARKER_TAP에 saved 동봉(saved=muklogId vs nearby=kakaoPlaceId 분기), BOUNDS_CHANGED 신설. */
export type MapInboundMessage =
  | { type: typeof MapInboundType.Ready }
  | { type: typeof MapInboundType.MarkerTap; id: string; saved: boolean }
  | { type: typeof MapInboundType.Error; reason: string }
  | { type: typeof MapInboundType.BoundsChanged; sw: Coords; ne: Coords }
  | { type: typeof MapInboundType.MapTap }; // map-pin-select: 빈 곳 탭(페이로드 없음)
