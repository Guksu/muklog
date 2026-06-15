// src/features/room/useRoom.spec.ts
// 단일 로그 상세 조회 훅 — get_room p_room_id 인자 계약, snake→camel 매핑, 토큰별 에러, refresh (plan §5.2, C1·C2·C3).
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useRoom } from './useRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useRoom', () => {
  it('진입 시 get_room을 p_room_id 인자로 1회 호출한다 (C3)', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', member_count: 1, mode: 'couple' },
      error: null,
    });
    renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('get_room', { p_room_id: 'r1' });
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('성공 시 snake→camel 매핑된 ready 상태가 된다 (C1 경계)', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', member_count: 2, mode: 'couple', name: '우리 맛집' },
      error: null,
    });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(result.current.state).toEqual({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple', name: '우리 맛집' },
    });
  });

  it('name 키가 없으면(투영 이전 환경) ready 유지 + name=null (누락=정상, 에러 아님) (C4)', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', member_count: 1, mode: 'solo' },
      error: null,
    });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    expect(result.current.state).toEqual({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'solo', name: null },
    });
  });

  it('name이 null이면 그대로 null로 매핑한다', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', member_count: 1, mode: 'solo', name: null },
      error: null,
    });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const room = result.current.state.status === 'ready' ? result.current.state.room : null;
    expect(room?.name).toBeNull();
  });

  it('rpcError(NOT_A_MEMBER) → error 상태 + 매핑된 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_A_MEMBER') });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    expect(result.current.state).toEqual({
      status: 'error',
      message: '이 로그에 접근할 권한이 없어요.',
    });
  });

  it('rpcError(ROOM_NOT_FOUND) → error 상태 + 매핑 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('ROOM_NOT_FOUND') });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'error', message: '로그를 찾을 수 없어요.' });
    });
  });

  it('응답 형 누락(invite_code 없음)은 error 상태(BAD_RESPONSE → 기본 메시지)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', member_count: 1, mode: 'couple' }, error: null });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '연결에 실패했어요. 다시 시도해 주세요.',
      });
    });
  });

  it('refresh() 호출 시 get_room을 다시 호출해 상태를 갱신한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_A_MEMBER') });
    const { result } = renderHook(() => useRoom({ roomId: 'r1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'WXYZ23', member_count: 1, mode: 'solo', name: '새이름' },
      error: null,
    });
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'ready',
        room: { roomId: 'r1', inviteCode: 'WXYZ23', memberCount: 1, mode: 'solo', name: '새이름' },
      });
    });
  });
});
