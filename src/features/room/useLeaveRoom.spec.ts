// src/features/room/useLeaveRoom.spec.ts
// 방 나가기 훅 — roomId 인자 RPC 호출, snake→camel 매핑, 멱등 성공, BAD_RESPONSE 가드,
// 토큰 에러, loading 전이, error 리셋 (plan §3.7-leave·§5 T3c, C-LEAVE).
//   ⚠️ 多로그 전환: leave_room(p_room_id) 인자화 → leaveRoom({ roomId }) → rpc('leave_room', { p_room_id }).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useLeaveRoom } from './useLeaveRoom';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useLeaveRoom', () => {
  it('성공(방 삭제) 시 leave_room을 { p_room_id } 인자로 호출하고 {roomDeleted,roomId}로 매핑한다 (C-LEAVE)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_deleted: true, room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    let res: { roomDeleted: boolean; roomId: string | null } | undefined;
    await act(async () => {
      res = await result.current.leaveRoom({ roomId: 'r1' });
    });

    // C-LEAVE: 인자화(p_room_id 정확 일치). 多로그에서 어느 로그를 나갈지 명시.
    expect(rpc).toHaveBeenCalledWith('leave_room', { p_room_id: 'r1' });
    expect(res).toEqual({ roomDeleted: true, roomId: 'r1' });
  });

  it('성공(방 보존, 잔여 1명) 시 roomDeleted:false + roomId 매핑', async () => {
    rpc.mockResolvedValueOnce({ data: { room_deleted: false, room_id: 'r2' }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    let res: { roomDeleted: boolean; roomId: string | null } | undefined;
    await act(async () => {
      res = await result.current.leaveRoom({ roomId: 'r1' });
    });

    expect(res).toEqual({ roomDeleted: false, roomId: 'r2' });
  });

  it('멱등 성공(멤버 아님): {room_deleted:false, room_id:null} → 정상 반환 (C-IDEM)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_deleted: false, room_id: null }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    let res: { roomDeleted: boolean; roomId: string | null } | undefined;
    await act(async () => {
      res = await result.current.leaveRoom({ roomId: 'r1' });
    });

    expect(res).toEqual({ roomDeleted: false, roomId: null });
    expect(result.current.error).toBeNull();
  });

  it('loading은 호출 전 false, 완료(finally) 후 false로 복귀한다', async () => {
    rpc.mockResolvedValueOnce({ data: { room_deleted: true, room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.leaveRoom({ roomId: 'r1' });
    });
    expect(result.current.loading).toBe(false);
  });

  it('rpcError(NOT_AUTHENTICATED) → reject + error에 한국어 메시지 세팅', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_AUTHENTICATED') });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('세션이 만료됐어요. 앱을 다시 시작해 주세요.');
  });

  it('rpcError(미지정 DB 예외) → reject + error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('SOME_DB_ERROR') });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('bad-response(room_deleted 누락)는 reject하고 error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toThrow('LEAVE_ROOM_BAD_RESPONSE');
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('bad-response(room_deleted 비-boolean)는 reject한다 — 타입 가드', async () => {
    rpc.mockResolvedValueOnce({ data: { room_deleted: 'yes', room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toThrow('LEAVE_ROOM_BAD_RESPONSE');
    });
  });

  it('data가 null이면 bad-response로 reject한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toThrow('LEAVE_ROOM_BAD_RESPONSE');
    });
  });

  it('이전 실패로 세팅된 error를 다음 성공 호출 시작 시 null로 리셋한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_AUTHENTICATED') });
    const { result } = renderHook(() => useLeaveRoom());

    await act(async () => {
      await expect(result.current.leaveRoom({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('세션이 만료됐어요. 앱을 다시 시작해 주세요.');

    rpc.mockResolvedValueOnce({ data: { room_deleted: true, room_id: 'r1' }, error: null });
    await act(async () => {
      await result.current.leaveRoom({ roomId: 'r1' });
    });
    expect(result.current.error).toBeNull();
  });
});
