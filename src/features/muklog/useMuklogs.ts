// src/features/muklog/useMuklogs.ts
// 한 로그(roomId)의 먹로그 목록 조회 훅 (plan §5.2 / §5 T5, D3, AC1·AC6·AC11).
//
// 생산자: 클라 직접 select(RLS 하, RPC 아님) — from('muklogs').select(컬럼).eq('room_id', roomId)
//   .order('visited_at', desc).order('created_at', desc). RLS(`room_id IN 내 방`)가 방 격리(타방 0건).
// 소비자: MuklogList → MuklogCard 리스트 + 섹션 헤더 "우리 맛집 N"(N=리스트 길이, D7). LogScreen이 마운트.
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()(저장 후 호출)만. 폴링/Realtime 미도입(비용 가드레일 §10,
//   useRoom/useMyLogs "진입 1회 + refresh" 정책 계승). refresh는 의도적으로 loading으로 되돌리지 않는다.
//   select 컬럼은 카드에 필요한 것만(lat/lng/주소/video 제외) → 전송량 절감(§10).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { type Muklog, type MuklogsState } from './types';

// 카드가 소비하는 컬럼만 조회(비용 가드레일 §10). 정렬/매핑 단일 출처.
const MUKLOG_SELECT_COLUMNS =
  'id, room_id, place_name, category, area, memo, rating, visited_at, created_by, created_at';

// 조회 행 형태(snake_case). 매핑 경계의 단일 출처.
type MuklogRow = {
  id: string;
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  memo: string | null;
  rating: number | null;
  visited_at: string | null;
  created_by: string;
  created_at: string;
};

/**
 * 조회 행(snake_case)을 Muklog(camelCase)로 매핑한다(매핑 단일 출처).
 * @param row muklogs select가 반환한 단일 행
 * @returns 카드가 소비하는 Muklog
 */
const toMuklog = ({ row }: { row: MuklogRow }): Muklog => ({
  id: row.id,
  roomId: row.room_id,
  placeName: row.place_name,
  category: row.category,
  area: row.area,
  memo: row.memo,
  rating: row.rating,
  visitedAt: row.visited_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

/**
 * 한 로그(roomId)의 먹로그 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(목록 상태)와 refresh(재조회 함수)
 */
export const useMuklogs = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<MuklogsState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [roomId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchMuklogs = async () => {
    const { data, error } = await supabase
      .from('muklogs')
      .select(MUKLOG_SELECT_COLUMNS)
      .eq('room_id', roomId)
      .order('visited_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.' });
      return;
    }

    const rows = (data ?? []) as MuklogRow[];
    setState({ status: 'ready', muklogs: rows.map((row) => toMuklog({ row })) });
  };

  useEffect(
    function loadMuklogsOnRoom() {
      mountedRef.current = true;
      // 진입 1회(또는 roomId 변경 시) 조회. fetchMuklogs는 최신 렌더 클로저를 사용한다.
      void fetchMuklogs();
      return function cleanupMuklogs() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roomId 변경 시에만 재조회(폴링 방지). fetchMuklogs 의존 시 매 렌더 재조회됨.
    [roomId],
  );

  return { state, refresh: fetchMuklogs };
};
