// src/features/room/useRoomMembers.spec.ts
// 로그 멤버 목록 조회 훅 — list_room_members p_room_id 인자 계약, snake→camel 매핑,
//   토큰별 에러, 비배열 응답 방어, refresh (plan §3.2·§5 T2, C3).
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useRoomMembers } from './useRoomMembers';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useRoomMembers', () => {
  it('진입 시 list_room_members를 p_room_id 인자로 1회 호출한다 (C3)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('list_room_members', { p_room_id: 'r1' });
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('성공 시 snake→camel 매핑된 ready{members} 상태가 된다 (C1 경계)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { user_id: 'u1', nickname: '민수', avatar_url: 'https://cdn/u1.jpg' },
        { user_id: 'u2', nickname: '지현', avatar_url: null },
      ],
      error: null,
    });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(result.current.state).toEqual({
      status: 'ready',
      members: [
        { userId: 'u1', nickname: '민수', avatarUrl: 'https://cdn/u1.jpg' },
        { userId: 'u2', nickname: '지현', avatarUrl: null },
      ],
    });
  });

  it('빈 배열 응답은 ready{members: []} (에러 아님)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', members: [] });
    });
  });

  it('개별 행의 nickname/avatar_url null 은 정상(누락 검사 제외)', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ user_id: 'u1', nickname: null, avatar_url: null }],
      error: null,
    });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'ready',
        members: [{ userId: 'u1', nickname: null, avatarUrl: null }],
      });
    });
  });

  it('rpcError(NOT_A_MEMBER) → error 상태 + 매핑된 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_A_MEMBER') });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '이 로그에 접근할 권한이 없어요.',
      });
    });
  });

  it('rpcError(NOT_AUTHENTICATED) → error 상태 + 매핑 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_AUTHENTICATED') });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '세션이 만료됐어요. 앱을 다시 시작해 주세요.',
      });
    });
  });

  it('비배열 응답(BAD_RESPONSE)은 error 상태(기본 메시지)', async () => {
    rpc.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '연결에 실패했어요. 다시 시도해 주세요.',
      });
    });
  });

  it('refresh() 호출 시 list_room_members를 다시 호출해 상태를 갱신한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_A_MEMBER') });
    const { result } = renderHook(() => useRoomMembers({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    rpc.mockResolvedValueOnce({
      data: [{ user_id: 'u1', nickname: '민수', avatar_url: null }],
      error: null,
    });
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'ready',
        members: [{ userId: 'u1', nickname: '민수', avatarUrl: null }],
      });
    });
  });
});
