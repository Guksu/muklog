// src/features/map/useMuklogPins.ts
// 내 모든 로그의 좌표 있는 먹로그 핀 조회 훅 — 캐시-우선 SWR (map-pins-cache plan §3.3·§7 경계면).
//
// 생산자: list_my_muklog_pins() DEFINER RPC → rows(snake) [{ muklog_id, room_id, place_name, category, area, rating, lat, lng }].
//   RPC가 `lat is not null and lng is not null`만 반환(좌표 없는 수동입력 먹로그 제외 — 설계 §3).
//   보조 생산자: pinsCache(로컬 AsyncStorage) — 진입 즉시 표시할 직전 캐시(userId 키잉).
// 소비자: MapTabScreen(상태 분기) + pinsToMapMarkers(지도뷰 마커) + initialRegion(센터). 반환 shape 불변(무수정 소비).
//
// SWR: 마운트 시 getSession→userId→loadCachedPins 즉시 ready(cached) → 백그라운드 RPC 재검증 → ready(fresh)+캐시 갱신.
//   순차 실행(캐시 읽기 완료 후 RPC 발사)으로 "RPC가 캐시보다 먼저 도착" race를 구조적으로 제거.
// 정책: 진입(마운트) 1회 조회 + 명시적 refresh()만. 폴링/Realtime 미도입(비용 가드레일 §8 — RPC 호출 횟수 불변).
//   refresh는 의도적으로 loading으로 되돌리지 않는다(지도가 떠 있는 채 갱신).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { loadCachedPins, saveCachedPins } from '../pinsCache';
import { toMuklogPin } from '../toMuklogPin';
import { type MuklogPinRow, type MuklogPinsState } from '../types';

/**
 * 현재 사용자가 속한 모든 로그의 좌표 있는 먹로그 핀을 캐시-우선(SWR)으로 조회하고 상태/재조회 함수를 제공하는 훅.
 * @returns state(핀 상태)와 refresh(재조회 함수)
 */
export const useMuklogPins = () => {
  const [state, setState] = useState<MuklogPinsState>({ status: 'loading' });
  const mountedRef = useRef(true);
  // 최신 커밋된 상태를 async 흐름에서 읽기 위한 ref — "캐시-우선 적용(loading일 때만)"·"에러 시 캐시 유지" 판단에 사용.
  const stateRef = useRef<MuklogPinsState>(state);
  stateRef.current = state;

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 의존성이 없어 마운트 1회만 실행된다.
  //   loadPins는 refresh로도 재사용된다(캐시 읽기 + RPC 재검증 + 캐시 갱신 동일 경로).
  const loadPins = async () => {
    // 1) userId — 로컬 세션에서 확보(getSession=로컬 스토리지, 네트워크 0). 실패/세션없음이면 null → 캐시 미접촉.
    let userId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData?.session?.user?.id ?? null;
    } catch {
      userId = null;
    }
    if (!mountedRef.current) return;

    // 2) 캐시-우선 즉시표시 — userId 있고 캐시 히트면 RPC 대기 없이 즉시 ready(cached).
    //   아직 loading(첫 진입)일 때만 적용 — refresh(ready)에선 스킵해 fresh 위에 stale 깜빡임 방지(이중 방어).
    let appliedCache = false;
    if (userId) {
      try {
        const cached = await loadCachedPins({ userId });
        if (!mountedRef.current) return;
        if (cached && stateRef.current.status === 'loading') {
          appliedCache = true;
          setState({ status: 'ready', pins: cached });
        }
      } catch {
        // loadCachedPins는 계약상 throw하지 않지만, 방어적으로 흡수하고 RPC로 진행한다.
      }
    }

    // 3) 백그라운드 RPC 재검증(무인자, 1회). 성공 시 깜빡임 없이 교체 + 캐시 갱신.
    const { data, error } = await supabase.rpc('list_my_muklog_pins');
    if (!mountedRef.current) return;

    if (error) {
      // 캐시로 이미 핀을 보여줬거나(ready) 이번에 캐시를 적용했으면 유지(에러 배너 없음). 아니면 error 전이(오늘과 동일).
      if (!appliedCache && stateRef.current.status !== 'ready') {
        setState({ status: 'error', message: '지도를 불러오지 못했어요. 다시 시도해 주세요.' });
      }
      return;
    }

    const rows = (data ?? []) as MuklogPinRow[];
    const fresh = rows.map((row) => toMuklogPin({ row }));
    setState({ status: 'ready', pins: fresh });
    // 캐시 갱신은 로컬 best-effort(RPC 아님 — 비용 가드레일 무영향). userId 없으면 no-op.
    if (userId) void saveCachedPins({ userId, pins: fresh });
  };

  useEffect(function loadPinsOnMount() {
    mountedRef.current = true;
    void loadPins();
    return function cleanupPins() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 조회(폴링 방지). loadPins 의존 시 매 렌더 재조회됨.
  }, []);

  return { state, refresh: loadPins };
};
