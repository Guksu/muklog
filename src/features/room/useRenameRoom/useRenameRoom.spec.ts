// src/features/room/useRenameRoom.spec.ts
// 로그 이름 수정 훅 — rename_room RPC 호출 계약(인자명 p_room_id/p_name, 정규화 전달),
// 반환 { roomId, name } 매핑, 에러 throw + error 세팅, loading 토글 (plan §3.4·§5 T3, C-ARG·C-LEN).
// SQL/RPC는 단위 대상 아님 → supabase.rpc 모킹으로 클라 계약만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useRenameRoom } from './useRenameRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useRenameRoom', () => {
  it('성공 시 rename_room을 정규화된 인자(p_room_id/p_name)로 호출하고 { roomId, name }을 반환한다 (C-ARG)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', name: 'X' }, error: null });
    const { result } = renderHook(() => useRenameRoom());

    let returned: { roomId: string; name: string | null } | undefined;
    await act(async () => {
      returned = await result.current.renameRoom({ roomId: 'r1', name: '  X ' });
    });

    // 인자명 p_room_id/p_name 정확 일치 + name은 normalizeLogName('  X ')='X' 로 전달
    expect(rpc).toHaveBeenCalledWith('rename_room', { p_room_id: 'r1', p_name: 'X' });
    expect(returned).toEqual({ roomId: 'r1', name: 'X' });
  });

  it('공백만 입력 → 정규화 null → p_name=null 전달, 반환 name=null', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', name: null }, error: null });
    const { result } = renderHook(() => useRenameRoom());

    let returned: { roomId: string; name: string | null } | undefined;
    await act(async () => {
      returned = await result.current.renameRoom({ roomId: 'r1', name: '   ' });
    });

    expect(rpc).toHaveBeenCalledWith('rename_room', { p_room_id: 'r1', p_name: null });
    expect(returned).toEqual({ roomId: 'r1', name: null });
  });

  it('RPC 에러 시 error 한국어 메시지를 세팅하고 throw한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NAME_TOO_LONG') });
    const { result } = renderHook(() => useRenameRoom());

    await expect(
      act(async () => {
        await result.current.renameRoom({ roomId: 'r1', name: 'a'.repeat(21) });
      }),
    ).rejects.toBeTruthy();

    await waitFor(() => {
      expect(result.current.error).toBe('이름은 20자까지 쓸 수 있어요.');
    });
  });

  it('비멤버(NOT_A_MEMBER) 에러도 매핑해 세팅한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_A_MEMBER') });
    const { result } = renderHook(() => useRenameRoom());

    await expect(
      act(async () => {
        await result.current.renameRoom({ roomId: 'r1', name: 'X' });
      }),
    ).rejects.toBeTruthy();

    await waitFor(() => {
      expect(result.current.error).toBe('이 로그에 접근할 권한이 없어요.');
    });
  });

  it('호출 전 loading=false, 진행 중 true, 완료 후 false로 토글한다', async () => {
    let resolveRpc: (v: unknown) => void = () => {};
    rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRpc = resolve;
      }),
    );
    const { result } = renderHook(() => useRenameRoom());
    expect(result.current.loading).toBe(false);

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.renameRoom({ roomId: 'r1', name: 'X' });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveRpc({ data: { room_id: 'r1', name: 'X' }, error: null });
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });

  it('성공 호출 시작 시 이전 error를 초기화한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NAME_TOO_LONG') });
    const { result } = renderHook(() => useRenameRoom());
    await act(async () => {
      await result.current.renameRoom({ roomId: 'r1', name: 'a'.repeat(21) }).catch(() => {});
    });
    expect(result.current.error).toBe('이름은 20자까지 쓸 수 있어요.');

    rpc.mockResolvedValueOnce({ data: { room_id: 'r1', name: 'OK' }, error: null });
    await act(async () => {
      await result.current.renameRoom({ roomId: 'r1', name: 'OK' });
    });
    expect(result.current.error).toBeNull();
  });
});
