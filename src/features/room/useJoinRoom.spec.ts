// src/features/room/useJoinRoom.spec.ts
// 방 입장 훅 — p_code 인자 계약, roomId 매핑, 토큰별 에러, error 리셋 (plan §5-1 (4), C1·C2).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useJoinRoom } from './useJoinRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useJoinRoom', () => {
  it('성공 시 join_room을 p_code 인자로 호출하고 roomId를 매핑한다 (C1 경계)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    let res: { roomId: string } | undefined;
    await act(async () => {
      res = await result.current.joinRoom({ code: 'ABCDEF' });
    });

    expect(rpc).toHaveBeenCalledWith('join_room', { p_code: 'ABCDEF' });
    expect(res).toEqual({ roomId: 'r1' });
  });

  it('INVALID_CODE 토큰 → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_CODE') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('ROOM_FULL 토큰(정원 초과) → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('ROOM_FULL') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('이미 2명이 모두 입장한 방이에요.');
  });

  it('bad-response(room_id 누락)는 reject하고 error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toThrow('JOIN_ROOM_BAD_RESPONSE');
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('이전 실패로 세팅된 error를 다음 성공 호출 시작 시 null로 리셋한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_CODE') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');

    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    await act(async () => {
      await result.current.joinRoom({ code: 'ABCDEF' });
    });
    expect(result.current.error).toBeNull();
  });
});
