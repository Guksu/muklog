// src/features/map/useWishPins.ts
// 내 모든 로그의 좌표 있는 위시 핀 크로스-로그 조회 훅 (map-wish-pins §3.2·§7-1 / T4).
//
// 생산자: 클라 직접 select(RLS 하, RPC 아님) — from('wishlist_items').select(컬럼)
//   .not('lat','is',null).not('lng','is',null).order('created_at', desc).
//   ⚠️ room 필터를 넣지 않는다 → RLS(`room_id IN 내 방`)가 자동으로 내가 멤버인 전 로그로 스코프(크로스-로그, DEFINER 불필요).
// 소비자: MapTabScreen(상태 분기) + wishToMapMarkers(지도뷰 마커).
//
// 정책: 마운트 1회 조회 + 명시적 refresh()(포커스·스프린트1 add-후)만. 폴링/Realtime/캐시 미도입(비용 가드레일 §8).
//   refresh는 loading으로 되돌리지 않는다(지도가 떠 있는 채 갱신). 조회 실패는 error 상태(위시 핀만 생략, best-effort는 화면에서).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { toWishPin, type WishPinRow } from '../toWishPin';
import { type WishPin, type WishPinsState } from '../types';

// 위시 핀이 소비하는 컬럼(매핑 경계 단일 출처 — WishPinRow와 정합). 최소 카드용이라 note/added_by/kakao 미조회.
const WISH_PIN_SELECT_COLUMNS = 'id, room_id, place_name, category, area, lat, lng';

/**
 * 내가 속한 모든 로그의 좌표 있는 위시 핀을 마운트 1회 크로스-로그 조회하고 상태/재조회 함수를 제공하는 훅.
 * @returns state(핀 상태)와 refresh(재조회 함수)
 */
export const useWishPins = () => {
  const [state, setState] = useState<WishPinsState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 의존성이 없어 마운트 1회만 실행된다.
  //   loadWishPins는 refresh로도 재사용된다(동일 조회 경로).
  const loadWishPins = async () => {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select(WISH_PIN_SELECT_COLUMNS)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false });

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '위시 장소를 불러오지 못했어요.' });
      return;
    }

    const rows = (data ?? []) as WishPinRow[];
    const pins: WishPin[] = [];
    for (const row of rows) {
      const pin = toWishPin({ row });
      if (pin) pins.push(pin); // 좌표 비유한 행은 toWishPin이 null → 제외(지도 핀 보호).
    }
    setState({ status: 'ready', pins });
  };

  useEffect(function loadWishPinsOnMount() {
    mountedRef.current = true;
    void loadWishPins();
    return function cleanupWishPins() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 조회(폴링 방지). loadWishPins 의존 시 매 렌더 재조회됨.
  }, []);

  return { state, refresh: loadWishPins };
};
