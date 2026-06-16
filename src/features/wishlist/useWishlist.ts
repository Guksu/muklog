// src/features/wishlist/useWishlist.ts
// 한 로그(roomId)의 위시 목록 조회 훅 (plan §4.3·§4.4 / TC-1·TC-3, 경계면 B1·B3·B4).
//
// 생산자: 클라 직접 select(RLS 하, RPC 아님) — from('wishlist_items').select(컬럼)
//   .eq('room_id', roomId).order('created_at', desc). RLS(`room_id IN 내 방`)가 방 격리(B3).
//   meId는 getSession(로컬, 네트워크 0)으로 확보해 addedByMe 파생만 사용(표시 전용, B4).
// 소비자: LogScreen 위시 세그 → WishlistView(items) + 세그 카운트(items.length).
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()(추가/삭제/재진입 후)만. 폴링/Realtime 미도입(비용 가드레일 §10).
//   meId는 표시(본인/짝꿍)에만 쓰이므로 서버 검증(getUser) 불필요 → 로컬 세션(getSession)으로 비용 절감.
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { toWishlistItem, type WishlistRow } from './toWishlistItem';
import { type WishlistItem, type WishlistState } from './types';

// 카드가 소비하는 컬럼(매핑 경계 단일 출처 — WishlistRow와 정합).
const WISHLIST_SELECT_COLUMNS =
  'id, room_id, place_name, category, area, road_address, lat, lng, kakao_place_id, note, added_by, created_at';

/**
 * 한 로그(roomId)의 위시 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useWishlist = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<WishlistState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [roomId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchWishlist = async () => {
    // meId(표시 전용) — 로컬 세션에서 확보. 실패/세션없음이면 null → addedByMe 전부 false 폴백.
    const { data: sessionData } = await supabase.auth.getSession();
    const meId = sessionData.session?.user?.id ?? null;

    const { data, error } = await supabase
      .from('wishlist_items')
      .select(WISHLIST_SELECT_COLUMNS)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '위시리스트를 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    const rows = (data ?? []) as WishlistRow[];
    const items: WishlistItem[] = rows.map((row) => toWishlistItem({ row, meId }));
    setState({ status: 'ready', items });
  };

  useEffect(
    function loadWishlistOnRoom() {
      mountedRef.current = true;
      // 진입 1회(또는 roomId 변경 시) 조회. fetchWishlist는 최신 렌더 클로저를 사용한다.
      void fetchWishlist();
      return function cleanupWishlist() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roomId 변경 시에만 재조회(폴링 방지). fetchWishlist 의존 시 매 렌더 재조회됨.
    [roomId],
  );

  return { state, refresh: fetchWishlist };
};
