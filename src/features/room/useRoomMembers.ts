// src/features/room/useRoomMembers.ts
// 로그 멤버 목록 조회 훅 (plan §3.2, C3). members-display S5b.
//
// 생산자: list_room_members(p_room_id) DEFINER RPC → setof (user_id, nickname, avatar_url) (snake, 최대 5행 joined_at asc).
//   본문 멤버십 검사 내장(C4-RLS) — 비멤버는 NOT_A_MEMBER. co-member 프로필은 이 스코프된 RPC로만 read(profiles RLS self-only 우회).
// 소비자: LogScreen 참여자 블록(ParticipantBlock)·logTitleFromMembers·MuklogDetail resolveAuthor.
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()만. 폴링/Realtime 미도입(비용 가드레일 §8).
//   useRoom의 "진입 1회 + refresh" 정책 계승. refresh는 의도적으로 loading으로 되돌리지 않는다.
//
// ⚠️ RoomMember 타입은 logName.ts 정의를 re-export(중복 정의 금지 — ui-spec §7-1 계약 단일 출처).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapRoomError } from './errors';
import { type RoomMember } from './logName';

export { type RoomMember } from './logName';

export type RoomMembersState =
  | { status: 'loading' }
  | { status: 'ready'; members: RoomMember[] }
  | { status: 'error'; message: string };

// RPC가 반환하는 행 형태(snake_case). 매핑 경계의 단일 출처.
type RoomMemberRow = {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
};

/**
 * 로그(roomId)의 멤버 목록을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param roomId 조회할 로그 id — 변경 시에만 재조회(폴링 방지)
 * @returns state(멤버 목록 상태)와 refresh(재조회 함수)
 */
export const useRoomMembers = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<RoomMembersState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수(컨벤션상 useCallback 지양). effect는 [roomId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchMembers = async () => {
    // 인자명은 RPC 시그니처(p_room_id)와 일치해야 한다(C3).
    const { data, error } = await supabase.rpc('list_room_members', { p_room_id: roomId });

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: mapRoomError({ error }) });
      return;
    }

    // list_room_members는 setof → data는 행 배열. 비배열은 BAD_RESPONSE로 흡수(기본 메시지).
    if (!Array.isArray(data)) {
      setState({ status: 'error', message: mapRoomError({ error: new Error('LIST_MEMBERS_BAD_RESPONSE') }) });
      return;
    }

    const members: RoomMember[] = (data as RoomMemberRow[]).map((row) => ({
      userId: row.user_id,
      nickname: row.nickname ?? null,
      avatarUrl: row.avatar_url ?? null,
    }));

    setState({ status: 'ready', members });
  };

  useEffect(
    function loadMembersOnId() {
      mountedRef.current = true;
      // 진입 1회(또는 roomId 변경 시) 조회. fetchMembers는 최신 렌더 클로저를 사용한다.
      void fetchMembers();
      return function cleanupMembers() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roomId 변경 시에만 재조회(폴링 방지). fetchMembers 의존 시 매 렌더 재조회됨.
    [roomId],
  );

  return { state, refresh: fetchMembers };
};
