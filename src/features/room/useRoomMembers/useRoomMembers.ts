// src/features/room/useRoomMembers.ts
// 로그 멤버 목록 조회 훅 (plan §3.2, C3). members-display S5b.
//
// 생산자: list_room_members(p_room_id) DEFINER RPC → setof (user_id, nickname, avatar_url) (snake, 최대 5행 joined_at asc).
//   본문 멤버십 검사 내장(C4-RLS) — 비멤버는 NOT_A_MEMBER. co-member 프로필은 이 스코프된 RPC로만 read(profiles RLS self-only 우회).
// 소비자: LogScreen 참여자 블록(ParticipantBlock)·logTitleFromMembers·MuklogDetail resolveAuthor.
//
// 정책: 진입(roomId 변경) 1회 조회 + 명시적 refresh()만. 폴링/Realtime 미도입(비용 가드레일 §8).
//   로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유(진입 1회 + 명시적 refresh).
//   join-push V3: 재조회(LogScreen 재포커스·같은 화면 알림 탭)가 실패해도 이미 ready 였던 목록을 그대로 둔다(keepLastReady).
//     목록 하나로 참여자 블록·로그 제목·나가기 시트 커플 판정이 함께 정해지므로, 재조회 1회 실패로 그 셋이 솔로 꼴로 바뀌지 않게 한다.
//     roomId 가 바뀐 뒤의 실패는 이전 로그의 멤버를 남기지 않고 error(다른 로그 화면에 섞이지 않게).
//
// ⚠️ RoomMember 타입은 logName.ts 정의를 re-export(중복 정의 금지 — ui-spec §7-1 계약 단일 출처).
import { supabase } from '@/lib/supabase';
import { useOneShotQuery } from '@/lib/useOneShotQuery';

import { mapRoomError } from '../errors';
import { type RoomMember } from '../logName';

export { type RoomMember } from '../logName';

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
export const useRoomMembers = ({ roomId }: { roomId: string }): {
  state: RoomMembersState;
  refresh: () => Promise<void>;
} => {
  // 쿼리+매핑만 정의 — 로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유.
  const fetchMembers = async (): Promise<{ members: RoomMember[] }> => {
    // 인자명은 RPC 시그니처(p_room_id)와 일치해야 한다(C3).
    const { data, error } = await supabase.rpc('list_room_members', { p_room_id: roomId });
    if (error) throw error;

    // list_room_members는 setof → data는 행 배열. 비배열은 BAD_RESPONSE로 흡수(기본 메시지).
    if (!Array.isArray(data)) throw new Error('LIST_MEMBERS_BAD_RESPONSE');

    const members: RoomMember[] = (data as RoomMemberRow[]).map((row) => ({
      userId: row.user_id,
      nickname: row.nickname ?? null,
      avatarUrl: row.avatar_url ?? null,
    }));

    return { members };
  };

  return useOneShotQuery<{ members: RoomMember[] }>({
    deps: [roomId],
    fetch: fetchMembers,
    mapError: (error) => mapRoomError({ error }),
    keepLastReady: true,
  });
};
