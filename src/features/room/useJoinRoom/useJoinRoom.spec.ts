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
    expect(result.current.error).toBe('로그 정원(5명)이 가득 찼어요.');
  });

  it('INVALID_CODE — jsonb { error } 반환 계약(실패 카운터 커밋용)도 토큰 throw + 한국어 메시지', async () => {
    // invite-code-hardening: raise는 트랜잭션 롤백으로 실패 카운터를 지우므로
    // join_room이 INVALID_CODE를 jsonb { error }로 반환한다 — 훅이 토큰 throw로 변환.
    rpc.mockResolvedValueOnce({ data: { error: 'INVALID_CODE' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toThrow('INVALID_CODE');
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('TOO_MANY_ATTEMPTS 토큰(시도 제한 초과) → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('TOO_MANY_ATTEMPTS') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('입장 시도가 너무 많았어요. 1시간 뒤에 다시 시도해 주세요.');
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
