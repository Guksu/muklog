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

/** 지도 핀 종류 판별자(enum-style 단일 출처, map-wish-pins §3.4).
 *  saved(내 맛집)·nearby(주변 음식점)·wish(위시 장소) 3종. slice2의 `saved: boolean`을 교체 —
 *  이중 판별자(saved+kind 병존) 금지. 생산자/소비자/HTML/파서가 이 값 하나로 분기한다. */
export const MapPinKind = {
  Saved: 'saved', // 내 맛집(muklogId) — primary border
  Nearby: 'nearby', // 주변 음식점(kakaoPlaceId) — 웜그레이 border
  Wish: 'wish', // 위시 장소(wishlist_items.id) — 3번째 스타일(ui-publisher 확정)
} as const;
export type MapPinKind = (typeof MapPinKind)[keyof typeof MapPinKind];

/** 지도뷰(WebView/JS SDK)가 먹는 마커 페이로드.
 *  map-wish-pins: `saved: boolean` → `kind`(saved|nearby|wish) 3종 판별자로 교체(회귀 net = 컴파일러가 전 소비지점 강제 노출).
 *  pinsToMapMarkers→'saved' / nearbyToMapMarkers→'nearby' / wishToMapMarkers→'wish'. */
export type MapMarker = {
  id: string; // saved=muklogId / nearby=kakaoPlaceId / wish=wishlist_items.id
  lat: number;
  lng: number;
  emoji: string;
  kind: MapPinKind;
};

/** 위시 핀 1건(camelCase, map-wish-pins §3.3). wishlist_items 크로스-로그 select → toWishPin 매핑 결과.
 *  lat/lng는 쿼리 필터로 non-null 보장(toWishPin이 finite 방어). id = wishlist_items.id(kind 판별자로 탭 컬렉션 구분). */
export type WishPin = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key | null(폴백 이모지)
  area: string | null;
  lat: number;
  lng: number;
};

/** useWishPins 상태(판별 유니온). pins:[] = 빈 상태(정상, 에러 아님). */
export type WishPinsState =
  | { status: 'loading' }
  | { status: 'ready'; pins: WishPin[] }
  | { status: 'error'; message: string };

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

/** 현재위치 좌표의 출처(enum-style 단일 출처, map-initial-location §3.4).
 *  warm = OS 캐시(마지막 위치, 근사) / fresh = 이번 세션의 실제 픽스(정밀).
 *  소비자(MapTabScreen)는 Fresh일 때만 자동 RECENTER 1회 가드를 소진한다 — warm 좌표로 소진하면
 *  정밀 픽스가 도착해도 재센터가 막혀 지도 센터와 me 마커가 최대 1km 어긋난 채 고정된다(§3.6). */
export const LocationCoordsSource = {
  Warm: 'warm',
  Fresh: 'fresh',
} as const;
export type LocationCoordsSource =
  (typeof LocationCoordsSource)[keyof typeof LocationCoordsSource];

/** 현재위치 재취득 결과 — 좌표와 **그 좌표의 실제 출처**를 함께 싣는다.
 *  실패 시 직전 좌표로 폴백하는 경로(R6)가 있어, 좌표만 돌려주면 소비자가 정밀도를 추정(=오마킹)하게 된다.
 *  출처를 값에 동봉해 "warm을 fresh로 착각한 채 지도 센터를 확정하는" 실패 양식을 원천 차단한다. */
export type LocationFix = { coords: Coords; source: LocationCoordsSource };

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
 *  map-wish-pins: MARKER_TAP에 kind 동봉(saved|nearby|wish 판별자로 카드 분기), BOUNDS_CHANGED 신설. */
export type MapInboundMessage =
  | { type: typeof MapInboundType.Ready }
  | { type: typeof MapInboundType.MarkerTap; id: string; kind: MapPinKind }
  | { type: typeof MapInboundType.Error; reason: string }
  | { type: typeof MapInboundType.BoundsChanged; sw: Coords; ne: Coords }
  | { type: typeof MapInboundType.MapTap }; // map-pin-select: 빈 곳 탭(페이로드 없음)
