// src/features/map/useMuklogPins.ts
// 내 모든 로그의 좌표 있는 먹로그 핀 1회 조회 훅 (plan §3.2·§3.3·§7 경계면).
//
// 생산자: list_my_muklog_pins() DEFINER RPC → rows(snake) [{ muklog_id, room_id, place_name, category, area, rating, lat, lng }].
//   RPC가 `lat is not null and lng is not null`만 반환(좌표 없는 수동입력 먹로그 제외 — 설계 §3).
// 소비자: MapTabScreen(상태 분기) + pinsToMapMarkers(지도뷰 마커) + initialRegion(센터).
//
// 정책: 진입(마운트) 1회 조회 + 명시적 refresh()만. 폴링/Realtime 미도입(비용 가드레일 §8, useMyLogs 정책 계승).
//   refresh는 의도적으로 loading으로 되돌리지 않는다(지도가 떠 있는 채 갱신).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { toMuklogPin } from '../toMuklogPin';
import { type MuklogPinRow, type MuklogPinsState } from '../types';

/**
 * 현재 사용자가 속한 모든 로그의 좌표 있는 먹로그 핀을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @returns state(핀 상태)와 refresh(재조회 함수)
 */
export const useMuklogPins = () => {
  const [state, setState] = useState<MuklogPinsState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 의존성이 없어 마운트 1회만 실행된다.
  const fetchPins = async () => {
    // 무인자 RPC. 행 집합 반환(0행=빈 핀=정상). 슬라이스 2에서 bbox 인자 추가 예정.
    const { data, error } = await supabase.rpc('list_my_muklog_pins');

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '지도를 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    const rows = (data ?? []) as MuklogPinRow[];
    setState({ status: 'ready', pins: rows.map((row) => toMuklogPin({ row })) });
  };

  useEffect(function loadPinsOnMount() {
    mountedRef.current = true;
    void fetchPins();
    return function cleanupPins() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 조회(폴링 방지). fetchPins 의존 시 매 렌더 재조회됨.
  }, []);

  return { state, refresh: fetchPins };
};
