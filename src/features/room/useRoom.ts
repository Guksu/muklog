// src/features/room/useRoom.ts
// 단일 로그 상세 조회 훅 (plan §5.2, C1·C2·C3).
//
// 생산자: get_room(p_room_id) DEFINER RPC → jsonb { room_id, invite_code, member_count, mode } (snake).
//   member_count는 DEFINER로 전 멤버 집계(RLS 우회) → 솔로/커플 파생 가능. 본문 멤버십 검사 내장(C4-RLS).
// 소비자: LogScreen(초대코드 표시·복사 + 솔로/커플 분기).
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()만. 폴링/주기 조회·Realtime 미도입(비용 가드레일 §10).
//   useMyLogs의 "진입 1회 + refresh" 정책 계승. refresh는 의도적으로 loading으로 되돌리지 않는다.
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';
import { type RoomMode } from './modes';

/** 단일 로그 상세. 모두 get_room이 반환하는 단일 출처(클라 집계 아님). */
export type RoomDetail = {
  roomId: string;
  inviteCode: string;
  memberCount: number; // 1=혼자 / 2=둘이 (DEFINER 집계)
  mode: RoomMode;
};

export type RoomDetailState =
  | { status: 'loading' }
  | { status: 'ready'; room: RoomDetail }
  | { status: 'error'; message: string };

// RPC가 반환하는 형태(snake_case). 매핑 경계의 단일 출처.
type RoomRow = {
  room_id?: string;
  invite_code?: string;
  member_count?: number;
  mode?: RoomMode;
};

/**
 * 단일 로그(roomId)의 상세를 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(상세 상태)와 refresh(재조회 함수)
 */
export const useRoom = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<RoomDetailState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). effect는 [roomId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchRoom = async () => {
    // 인자명은 RPC 시그니처(p_room_id)와 일치해야 한다(C3).
    const { data, error } = await supabase.rpc('get_room', { p_room_id: roomId });

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: mapRoomError({ error }) });
      return;
    }

    const row = (data ?? {}) as RoomRow;
    if (!row.room_id || !row.invite_code || row.member_count == null || !row.mode) {
      // 응답 형 누락 → BAD_RESPONSE 패턴(기본 메시지). 토큰 미일치라 mapRoomError가 기본 메시지로 흡수.
      setState({ status: 'error', message: mapRoomError({ error: new Error('GET_ROOM_BAD_RESPONSE') }) });
      return;
    }

    setState({
      status: 'ready',
      room: {
        roomId: row.room_id,
        inviteCode: row.invite_code,
        memberCount: row.member_count,
        mode: row.mode,
      },
    });
  };

  useEffect(
    function loadRoomOnId() {
      mountedRef.current = true;
      // 진입 1회(또는 roomId 변경 시) 조회. fetchRoom은 최신 렌더 클로저를 사용한다.
      void fetchRoom();
      return function cleanupRoom() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roomId 변경 시에만 재조회(폴링 방지). fetchRoom 의존 시 매 렌더 재조회됨.
    [roomId],
  );

  return { state, refresh: fetchRoom };
};
