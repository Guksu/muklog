// src/features/room/useCreateRoom.spec.ts
// 방 생성 훅 — snake→camel 매핑, 실패 경로, loading 전이 (plan §5-1 (3), C1).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useCreateRoom } from './useCreateRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useCreateRoom', () => {
  it('성공 시 create_room을 호출하고 snake → camel로 매핑한다', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', invite_code: 'ABCDEF' }, error: null });
    const { result } = renderHook(() => useCreateRoom());

    let res: { roomId: string; inviteCode: string } | undefined;
    await act(async () => {
      res = await result.current.createRoom();
    });

    expect(rpc).toHaveBeenCalledWith('create_room');
    expect(res).toEqual({ roomId: 'r1', inviteCode: 'ABCDEF' });
  });

  it('loading은 호출 전 false, 완료(finally) 후 false로 복귀한다', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', invite_code: 'ABCDEF' }, error: null });
    const { result } = renderHook(() => useCreateRoom());

    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.createRoom();
    });
    expect(result.current.loading).toBe(false);
  });

  it('rpcError 발생 시 reject하고 error에 한국어 메시지를 세팅한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('CODE_GENERATION_FAILED') });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom()).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('bad-response(필드 누락)는 reject하고 error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null }); // invite_code 없음
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom()).rejects.toThrow('CREATE_ROOM_BAD_RESPONSE');
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('data가 null이면 bad-response로 reject한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useCreateRoom());

    await act(async () => {
      await expect(result.current.createRoom()).rejects.toThrow('CREATE_ROOM_BAD_RESPONSE');
    });
  });
});
