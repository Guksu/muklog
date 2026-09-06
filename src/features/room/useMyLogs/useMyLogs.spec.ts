// src/features/room/useMyLogs.spec.ts
// 내 로그 목록 훅 — list_my_rooms RPC 호출 계약, rows(snake)→MyLog[](camel) 매핑,
// 빈 배열→ready(에러 아님), error 전이, 초기 loading, refresh 재조회(폴링 없음).
// (plan §3.5 / §5 T2, C1·C9) SQL/RPC는 단위 대상 아님 → supabase.rpc 모킹으로 클라 계약만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { createQueryWrapper } from '@/lib/queryClient/testQueryWrapper';

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
  spot_count: number | null;
  last_muklog_at: string | null;
}>) => ({
  room_id: 'r1',
  mode: 'couple',
  member_count: 2,
  created_at: '2026-06-10T00:00:00.000Z',
  joined_at: '2026-06-10T01:00:00.000Z',
  name: null,
  ...over,
});

// 케이스마다 새 캐시(QueryClientProvider) — 같은 키라도 케이스 간 데이터가 새지 않게 격리한다.
let wrapper: ReturnType<typeof createQueryWrapper>['wrapper'];

beforeEach(() => {
  wrapper = createQueryWrapper().wrapper;
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
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

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
          spotCount: 0,
          lastMuklogAt: null,
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
          spotCount: 0,
          lastMuklogAt: null,
        },
      ],
    });
  });

  it('spot_count·last_muklog_at 투영: 값 있으면 spotCount(숫자)·lastMuklogAt(ISO)로 매핑 (home-fidelity 경계)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({ room_id: 'r1', spot_count: 7, last_muklog_at: '2026-06-19T05:30:00.000Z' }),
        row({ room_id: 'r2', spot_count: 0, last_muklog_at: null }), // 맛집 0 → 0·null
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => [l.spotCount, l.lastMuklogAt])).toEqual([
      [7, '2026-06-19T05:30:00.000Z'],
      [0, null],
    ]);
  });

  it('spot_count·last_muklog_at 누락(레거시 RPC): spotCount=0·lastMuklogAt=null로 안전 폴백 (거짓 카운트 0)', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        // 두 키 자체가 없는 레거시 행(집계 컬럼 추가 전 RPC) → 0·null
        { room_id: 'r1', mode: 'couple', member_count: 2, created_at: 'x', joined_at: 'x' },
      ],
      error: null,
    });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => [l.spotCount, l.lastMuklogAt])).toEqual([[0, null]]);
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
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

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
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

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
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    const logs = result.current.state.status === 'ready' ? result.current.state.logs : [];
    expect(logs.map((l) => l.previewPaths)).toEqual([['r1/m1/a.jpg', 'r1/m1/b.jpg'], [], []]);
  });

  it('빈 배열이면 ready + logs:[] 로 전이한다 (빈 상태=정상, 에러 아님) (C9)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', logs: [] });
    });
  });

  it('data가 null이어도(행 없음) ready + logs:[] 로 흡수한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', logs: [] });
    });
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.',
      });
    });
  });

  it('초기 상태는 loading이다 (resolve 전)', () => {
    rpc.mockReturnValueOnce(new Promise(() => {})); // 영원히 pending
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음) — 빈 목록 → 로그 1개', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper });

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

  // ── 공유 캐시 (query-cache T4 / H13) ──────────────────────────────────────────
  it('H13(AC4-2): 같은 사용자 키의 두 관찰자가 동시에 마운트돼도 list_my_rooms RPC는 1회만 나간다', async () => {
    // 실제 경로: MyLogsProvider(앱 진입 시 마운트)와 ProfileScreen(통계용)이 같은 목록을 본다.
    const { wrapper: shared } = createQueryWrapper();
    rpc.mockResolvedValue({ data: [row({ room_id: 'r1' })], error: null });

    const provider = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper: shared });
    const screen = renderHook(() => useMyLogs({ userId: 'u1' }), { wrapper: shared });

    await waitFor(() => expect(provider.result.current.state.status).toBe('ready'));
    await waitFor(() => expect(screen.result.current.state.status).toBe('ready'));
    expect(rpc).toHaveBeenCalledTimes(1);
    // 두 관찰자가 같은 데이터를 본다(통계 자리가 로딩 없이 즉시 뜬다 — DS4).
    expect(screen.result.current.state).toEqual(provider.result.current.state);
  });

  it('AC4-4: userId가 바뀌면 이전 계정의 로그가 새 계정의 ready로 새지 않는다 (E1)', async () => {
    const { wrapper: shared } = createQueryWrapper();
    rpc.mockResolvedValueOnce({ data: [row({ room_id: 'old' })], error: null });
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => useMyLogs({ userId }),
      { wrapper: shared, initialProps: { userId: 'u1' } },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    rpc.mockResolvedValueOnce({ data: [row({ room_id: 'new' })], error: null });
    rerender({ userId: 'u2' });

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as { status: 'ready'; logs: { roomId: string }[] };
    expect(state.logs.map((l) => l.roomId)).toEqual(['new']);
  });
});
