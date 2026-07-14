// src/features/map/pinsToMapMarkers.ts
// MuklogPin[] → 지도뷰가 먹는 MapMarker[] 변환 (plan §3.4·§7 경계면).
//   생산자: useMuklogPins(pins). 소비자: 지도뷰 INIT/SET_MARKERS.
//   이모지는 categories.ts CAT 매핑을 재사용한다(중복 정의 금지 §7). 미지/null은 폴백.
//   slice1은 saved=true 고정(모두 "우리 맛집") — 주변 음식점 핀은 슬라이스 2.
import { categoryEmoji } from '@/features/muklog/categories';

import { MapPinKind, type MapMarker, type MuklogPin } from '../types';

/** category 미매핑/null 시 폴백 마커 이모지(킷 Pin 기본 음식 톤). */
export const PIN_FALLBACK_EMOJI = '🍽️';

/**
 * MuklogPin[]을 지도 마커 페이로드로 변환한다.
 * category는 categoryEmoji(categories.ts)로 매핑하고, 빈/미지 key는 폴백 이모지를 쓴다.
 * @param pins 변환할 핀 목록(빈 배열이면 빈 배열 반환)
 * @returns 지도뷰 INIT/SET_MARKERS에 실을 마커 배열
 */
export const pinsToMapMarkers = ({ pins }: { pins: MuklogPin[] }): MapMarker[] =>
  pins.map((p) => {
    const emoji = categoryEmoji({ key: p.category });
    return {
      id: p.muklogId,
      lat: p.lat,
      lng: p.lng,
      emoji: emoji === '' ? PIN_FALLBACK_EMOJI : emoji,
      kind: MapPinKind.Saved,
    };
  });
