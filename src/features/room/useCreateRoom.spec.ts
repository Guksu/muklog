// src/features/room/useCreateRoom.spec.ts
// 방 생성 훅 — mode 인자/반환 계약, snake→camel 매핑, 실패 경로, loading 전이 (plan §5 T7, C1·C3).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useCreateRoom } from './useCreateRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useCreateRoom', () => {
  it('solo 생성: create_room을 { p_mode: "solo" }로 호출하고 mode 포함 매핑 (C1·C3)', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', mode: 'solo' },
      error: null,
    });
    const { result } = renderHook(() => useCreateRoom());

    let res: { roomId: string; inviteCode: string; mode: string } | undefined;
    await act(async () => {
      res = await result.current.createRoom({ mode: 'solo' });
    });

    // C3: 인자명 p_mode 정확 일치(불일치 시 default couple로 조용히 생성되는 함정 방지)
    expect(rpc).toHaveBeenCalledWith('create_room', { p_mode: 'solo' });
    expect(res).toEqual({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'solo' });
  });

  it('무인자 createRoom(): p_mode 없이 create_room을 호출한다 (멀티 로그 생성, RPC default couple)', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r3', invite_code: 'NPQRST', mode: 'couple' },
      error: null,
    });
    const { result } = renderHook(() => useCreateRoom());

    let res: { roomId: string; inviteCode: string; mode: string } | undefined;
    await act(async () => {
      res = await result.current.createRoom();
    });

    // 인자 미전달 → rpc 2번째 인자 없음(RPC default 'couple' 적용)
    expect(rpc).toHaveBeenCalledWith('create_room');
    expect(res).toEqual({ roomId: 'r3', inviteCode: 'NPQRST', mode: 'couple' });
  });

  it('couple 생성: { p_mode: "couple" } 호출 + mode:"couple" 매핑', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r2', invite_code: 'GHJKLM', mode: 'couple' },
      error: null,
    });
    const { result } = renderHook(() => useCreateRoom());

    let res: { roomId: string; inviteCode: string; mode: string } | undefined;
    await act(async () => {
      res = await result.current.createRoom({ mode: 'couple' });
    });

    expect(rpc).toHaveBeenCalledWith('create_room', { p_mode: 'couple' });
    expect(res).toEqual({ roomId: 'r2', inviteCode: 'GHJKLM', mode: 'couple' });
  });

  it('loading은 호출 전 false, 완료(finally) 후 false로 복귀한다', async () => {
    rpc.mockResolvedValueOnce({
      data: { room_id: 'r1', invite_code: 'ABCDEF', mode: 'couple' },
      error: null,
    });
    const { result } = renderHook(() => useCreateRoom());

    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.createRoom({ mode: 'couple' });
    });
    expect(result.current.loading).toBe(false);
  });

  it('rpcError(INVALID_MODE) 발생 시 reject하고 error에 한국어 메시지를 세팅한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_MODE') });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom({ mode: 'solo' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('방 모드 선택이 올바르지 않아요.');
  });

  it('rpcError(CODE_GENERATION_FAILED) 발생 시 한국어 메시지를 세팅한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('CODE_GENERATION_FAILED') });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom({ mode: 'couple' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('bad-response(invite_code 누락)는 reject하고 error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', mode: 'solo' }, error: null });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom({ mode: 'solo' })).rejects.toThrow('CREATE_ROOM_BAD_RESPONSE');
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('bad-response(mode 누락)는 reject한다 — mode는 필수 반환 필드', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', invite_code: 'ABCDEF' }, error: null });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom({ mode: 'solo' })).rejects.toThrow('CREATE_ROOM_BAD_RESPONSE');
    });
  });

  it('data가 null이면 bad-response로 reject한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom({ mode: 'couple' })).rejects.toThrow('CREATE_ROOM_BAD_RESPONSE');
    });
  });
});
