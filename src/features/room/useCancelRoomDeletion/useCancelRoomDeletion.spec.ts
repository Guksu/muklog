// src/features/room/useCancelRoomDeletion.spec.ts
// 삭제 예약 취소 훅 — roomId 인자 RPC 호출, snake→camel 매핑, 토큰 에러(요청자만/예약없음),
// 네트워크 기본 메시지, loading 전이 (plan §3.3·§3.6·§5 T6, C2).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { type CancelRoomDeletionResult } from './useCancelRoomDeletion';
import { useCancelRoomDeletion } from './useCancelRoomDeletion';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

describe('useCancelRoomDeletion', () => {
  it('성공 시 cancel_room_deletion을 { p_room_id } 인자로 호출하고 { canceled, roomId } 로 매핑한다', async () => {
    rpc.mockResolvedValueOnce({ data: { canceled: true, room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useCancelRoomDeletion());

    let res: CancelRoomDeletionResult | undefined;
    await act(async () => {
      res = await result.current.cancelRoomDeletion({ roomId: 'r1' });
    });

    expect(rpc).toHaveBeenCalledWith('cancel_room_deletion', { p_room_id: 'r1' });
    expect(res).toEqual({ canceled: true, roomId: 'r1' });
  });

  it('NOT_DELETION_REQUESTER → reject + error에 "요청한 사람만" 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_DELETION_REQUESTER') });
    const { result } = renderHook(() => useCancelRoomDeletion());

    await act(async () => {
      await expect(result.current.cancelRoomDeletion({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('나가기를 요청한 사람만 취소할 수 있어요.');
  });

  it('NOT_SCHEDULED → reject + error에 "예약이 해제됐거나 없는" 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('NOT_SCHEDULED') });
    const { result } = renderHook(() => useCancelRoomDeletion());

    await act(async () => {
      await expect(result.current.cancelRoomDeletion({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('이미 삭제 예약이 해제됐거나 없는 로그예요.');
  });

  it('네트워크/미지정 예외 → reject + error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('network down') });
    const { result } = renderHook(() => useCancelRoomDeletion());

    await act(async () => {
      await expect(result.current.cancelRoomDeletion({ roomId: 'r1' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('bad-response(canceled 비-boolean)는 reject한다 — 타입 가드', async () => {
    rpc.mockResolvedValueOnce({ data: { canceled: 'yes', room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useCancelRoomDeletion());

    await act(async () => {
      await expect(result.current.cancelRoomDeletion({ roomId: 'r1' })).rejects.toThrow(
        'CANCEL_ROOM_DELETION_BAD_RESPONSE',
      );
    });
  });

  it('loading은 호출 전 false, 완료(finally) 후 false로 복귀한다', async () => {
    rpc.mockResolvedValueOnce({ data: { canceled: true, room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useCancelRoomDeletion());

    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.cancelRoomDeletion({ roomId: 'r1' });
    });
    expect(result.current.loading).toBe(false);
  });
});
