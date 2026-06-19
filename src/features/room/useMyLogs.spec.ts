// src/features/room/useMyLogs.spec.ts
// 내 로그 목록 훅 — list_my_rooms RPC 호출 계약, rows(snake)→MyLog[](camel) 매핑,
// 빈 배열→ready(에러 아님), error 전이, 초기 loading, refresh 재조회(폴링 없음).
// (plan §3.5 / §5 T2, C1·C9) SQL/RPC는 단위 대상 아님 → supabase.rpc 모킹으로 클라 계약만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useMyLogs } from './useMyLogs';

const rpc = supabase.rpc as jest.Mock;

const row = (over?: Partial<{
  room_id: string;
  mode: string;
  member_count: number;
  created_at: string;
  joined_at: string;
  name: string | null;
  delete_scheduled_at: string | null;
  delete_requested_by: string | null;
  preview_paths: string[] | null;
}>) => ({
  room_id: 'r1',
  mode: 'couple',
  member_count: 2,
  created_at: '2026-06-10T00:00:00.000Z',
  joined_at: '2026-06-10T01:00:00.000Z',
  name: null,
  ...over,
});

beforeEach(() => {
  rpc.mockReset();
});

describe('useMyLogs', () => {
  it('rows를 받으면 ready로 전이하고 snake→camel로 매핑한다 (C1)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({ room_id: 'r1', mode: 'couple', member_count: 2, name: '우리 맛집' }),
        row({ room_id: 'r2', mode: 'solo', member_count: 1, joined_at: '2026-06-09T00:00:00.000Z' }),
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    // 인자 없이 호출(C: list_my_rooms는 무인자 RPC)
    expect(rpc).toHaveBeenCalledWith('list_my_rooms');
    expect(result.current.state).toEqual({
      status: 'ready',
      logs: [
        {
          roomId: 'r1',
          mode: 'couple',
          memberCount: 2,
          createdAt: '2026-06-10T00:00:00.000Z',
          joinedAt: '2026-06-10T01:00:00.000Z',
          name: '우리 맛집',
          deleteScheduledAt: null,
          deleteRequestedBy: null,
          previewPaths: [],
        },
        {
          roomId: 'r2',
          mode: 'solo',
          memberCount: 1,
          createdAt: '2026-06-10T00:00:00.000Z',
          joinedAt: '2026-06-09T00:00:00.000Z',
          name: null,
          deleteScheduledAt: null,
          deleteRequestedBy: null,
          previewPaths: [],
        },
      ],
    });
  });

  it('name 컬럼 매핑: 값 있으면 MyLog.name, null/누락이면 null (C3)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({ room_id: 'r1', name: '맛집로그' }),
        row({ room_id: 'r2', name: null }),
        // name 키 자체가 누락된 행(투영 이전 환경 방어) → null
        { room_id: 'r3', mode: 'solo', member_count: 1, created_at: '2026-06-10T00:00:00.000Z', joined_at: '2026-06-10T00:00:00.000Z' },
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => l.name)).toEqual(['맛집로그', null, null]);
  });

  it('delete_scheduled_at·delete_requested_by 투영: 값 있으면 camel 매핑, 누락/null이면 null (room-lifecycle 경계)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({
          room_id: 'r1',
          delete_scheduled_at: '2026-06-17T00:00:00.000Z',
          delete_requested_by: 'u9',
        }),
        row({ room_id: 'r2' }), // 두 키 누락 → null
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => [l.deleteScheduledAt, l.deleteRequestedBy])).toEqual([
      ['2026-06-17T00:00:00.000Z', 'u9'],
      [null, null],
    ]);
  });

  it('preview_paths 투영: 값 있으면 string[] 매핑, 누락/null이면 [] (log-preview-photos 경계)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({ room_id: 'r1', preview_paths: ['r1/m1/a.jpg', 'r1/m1/b.jpg'] }),
        row({ room_id: 'r2', preview_paths: null }), // null → []
        { room_id: 'r3', mode: 'solo', member_count: 1, created_at: 'x', joined_at: 'x' }, // 키 누락 → []
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => l.previewPaths)).toEqual([['r1/m1/a.jpg', 'r1/m1/b.jpg'], [], []]);
  });

  it('빈 배열이면 ready + logs:[] 로 전이한다 (빈 상태=정상, 에러 아님) (C9)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', logs: [] });
    });
  });

  it('data가 null이어도(행 없음) ready + logs:[] 로 흡수한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', logs: [] });
    });
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.',
      });
    });
  });

  it('초기 상태는 loading이다 (resolve 전)', () => {
    rpc.mockReturnValueOnce(new Promise(() => {})); // 영원히 pending
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음) — 빈 목록 → 로그 1개', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', logs: [] });
    });

    rpc.mockResolvedValueOnce({ data: [row({ room_id: 'r9', member_count: 1 })], error: null });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state.status).toBe('ready');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
