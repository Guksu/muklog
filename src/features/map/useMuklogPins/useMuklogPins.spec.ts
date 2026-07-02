// src/features/map/useMuklogPins.spec.ts
// 내 모든 로그의 좌표 있는 먹로그 핀 조회 훅 단위 테스트 (plan §3.3·§5-1 useMuklogPins).
//   [기존 계약·회귀] list_my_muklog_pins RPC 호출 계약, rows(snake)→MuklogPin[](camel) 매핑, 빈→ready(에러 아님),
//     error 전이(한국어), 초기 loading, refresh 재조회(폴링 없음), 언마운트 후 setState 안 함.
//   [SWR 신규] 캐시-우선 즉시표시(T3)·RPC 재검증 교체+캐시 갱신(T4)·에러 정책(T5)·userId fail-safe(T6)·
//     refresh 정책+갱신(T7)·RPC 호출 횟수 불변(T8)·언마운트 race(T9).
//   SQL/RPC·pinsCache는 단위 대상 아님 → supabase(rpc·auth.getSession)·pinsCache 모킹으로 클라 계약만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../pinsCache', () => ({ loadCachedPins: jest.fn(), saveCachedPins: jest.fn() }));
import { supabase } from '@/lib/supabase';
import { loadCachedPins, saveCachedPins } from '../pinsCache';
import { useMuklogPins } from './useMuklogPins';
import { type MuklogPin, type MuklogPinRow } from '../types';

const rpc = supabase.rpc as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;
const loadCached = loadCachedPins as jest.Mock;
const saveCached = saveCachedPins as jest.Mock;

const row = (over?: Partial<MuklogPinRow>): MuklogPinRow => ({
  muklog_id: 'm1',
  room_id: 'r1',
  place_name: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

const pin = (over?: Partial<MuklogPin>): MuklogPin => ({
  muklogId: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

beforeEach(() => {
  rpc.mockReset();
  getSession.mockReset();
  loadCached.mockReset();
  saveCached.mockReset();
  // 기본값: 세션 있음(userId 'me') + 캐시 miss(null) → 기존 테스트는 loading→RPC 경로(회귀 0).
  getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
  loadCached.mockResolvedValue(null);
  saveCached.mockResolvedValue(undefined);
});

describe('useMuklogPins', () => {
  it('rows를 받으면 ready로 전이하고 snake→camel로 매핑한다 (무인자 RPC)', async () => {
    rpc.mockResolvedValueOnce({
      data: [row(), row({ muklog_id: 'm2', category: null, area: null, rating: null })],
      error: null,
    });
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(rpc).toHaveBeenCalledWith('list_my_muklog_pins');
    expect(result.current.state).toEqual({
      status: 'ready',
      pins: [
        {
          muklogId: 'm1',
          roomId: 'r1',
          placeName: '트라토리아 보나',
          category: 'pasta',
          area: '연남동',
          rating: 5,
          lat: 37.5,
          lng: 127.0,
        },
        {
          muklogId: 'm2',
          roomId: 'r1',
          placeName: '트라토리아 보나',
          category: null,
          area: null,
          rating: null,
          lat: 37.5,
          lng: 127.0,
        },
      ],
    });
  });

  it('빈 배열이면 ready + pins:[] 로 전이한다 (빈 상태=정상)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', pins: [] }));
  });

  it('data가 null이어도 ready + pins:[] 로 흡수한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', pins: [] }));
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        message: '지도를 불러오지 못했어요. 다시 시도해 주세요.',
      }),
    );
  });

  it('초기 상태는 loading이다 (resolve 전)', () => {
    rpc.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useMuklogPins());
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', pins: [] }));

    rpc.mockResolvedValueOnce({ data: [row({ muklog_id: 'm9' })], error: null });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state.status).toBe('ready');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('응답 전 언마운트되면 setState를 호출하지 않는다(경고 없음)', async () => {
    let resolveRpc: (v: unknown) => void = () => {};
    rpc.mockReturnValueOnce(new Promise((res) => { resolveRpc = res; }));
    const { result, unmount } = renderHook(() => useMuklogPins());
    expect(result.current.state.status).toBe('loading');
    unmount();
    await act(async () => {
      resolveRpc({ data: [row()], error: null });
    });
    // 언마운트 후이므로 state는 loading에 머문다(setState 미호출).
    expect(result.current.state.status).toBe('loading');
  });

  // ── SWR 캐시-우선 (map-pins-cache) ──────────────────────────────────────

  it('T3: 캐시 히트면 RPC resolve 전에 ready(cached)로 즉시 전이한다', async () => {
    const cached = [pin({ muklogId: 'c1' })];
    loadCached.mockResolvedValueOnce(cached);
    rpc.mockReturnValueOnce(new Promise(() => {})); // RPC는 계속 pending
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', pins: cached }));
    expect(loadCached).toHaveBeenCalledWith({ userId: 'me' });
  });

  it('T3: 캐시 miss면 RPC resolve까지 loading을 유지한다', async () => {
    loadCached.mockResolvedValueOnce(null);
    rpc.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useMuklogPins());

    // 캐시 miss 확정(loadCached resolve) 이후에도 loading(오늘과 동일).
    await waitFor(() => expect(loadCached).toHaveBeenCalled());
    expect(result.current.state.status).toBe('loading');
  });

  it('T4: RPC 재검증이 도착하면 fresh로 교체하고 캐시를 갱신한다', async () => {
    const cached = [pin({ muklogId: 'c1' })];
    loadCached.mockResolvedValueOnce(cached);
    rpc.mockResolvedValueOnce({ data: [row({ muklog_id: 'f1' })], error: null });
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'ready', pins: [pin({ muklogId: 'f1' })] }),
    );
    expect(saveCached).toHaveBeenCalledWith({ userId: 'me', pins: [pin({ muklogId: 'f1' })] });
  });

  it('T5a: 캐시 히트 후 RPC error면 캐시를 유지한다(에러 배너 없음)', async () => {
    const cached = [pin({ muklogId: 'c1' })];
    loadCached.mockResolvedValueOnce(cached);
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() => expect(rpc).toHaveBeenCalled());
    // 에러가 도착해도 ready(cached) 유지 — error로 전이하지 않는다.
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', pins: cached }));
  });

  it('T5b: 캐시 miss + RPC error면 error 상태로 전이한다(오늘과 동일)', async () => {
    loadCached.mockResolvedValueOnce(null);
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        message: '지도를 불러오지 못했어요. 다시 시도해 주세요.',
      }),
    );
  });

  it('T6: 세션 없음(userId null)이면 캐시를 접촉하지 않고 RPC 경로만 동작한다', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    rpc.mockResolvedValueOnce({ data: [row()], error: null });
    const { result } = renderHook(() => useMuklogPins());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(loadCached).not.toHaveBeenCalled();
    expect(saveCached).not.toHaveBeenCalled();
  });

  it('T7: refresh는 loading으로 되돌리지 않고 재검증하며 캐시를 갱신한다', async () => {
    loadCached.mockResolvedValueOnce([pin({ muklogId: 'c1' })]);
    rpc.mockResolvedValueOnce({ data: [row({ muklog_id: 'f1' })], error: null });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'ready', pins: [pin({ muklogId: 'f1' })] }),
    );

    rpc.mockResolvedValueOnce({ data: [row({ muklog_id: 'f2' })], error: null });
    await act(async () => {
      await result.current.refresh();
    });
    // refresh 중에도 loading으로 되돌리지 않고, 성공 시 fresh 교체 + 캐시 2회째 갱신.
    expect(result.current.state).toEqual({ status: 'ready', pins: [pin({ muklogId: 'f2' })] });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(saveCached).toHaveBeenLastCalledWith({ userId: 'me', pins: [pin({ muklogId: 'f2' })] });
  });

  it('T8: 마운트 시 RPC는 정확히 1회(캐시 히트여도), 시간 경과 후 추가 호출 0(폴링 없음)', async () => {
    jest.useFakeTimers();
    try {
      loadCached.mockResolvedValueOnce([pin({ muklogId: 'c1' })]);
      rpc.mockResolvedValueOnce({ data: [row()], error: null });
      renderHook(() => useMuklogPins());

      await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(rpc).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('T9: 캐시 pending 중 언마운트되면 setState를 호출하지 않는다', async () => {
    let resolveCache: (v: MuklogPin[] | null) => void = () => {};
    loadCached.mockReturnValueOnce(new Promise((res) => { resolveCache = res; }));
    rpc.mockResolvedValue({ data: [row()], error: null });
    const { result, unmount } = renderHook(() => useMuklogPins());
    expect(result.current.state.status).toBe('loading');
    unmount();
    await act(async () => {
      resolveCache([pin({ muklogId: 'c1' })]);
    });
    // 언마운트 후이므로 캐시·RPC 모두 setState 미호출 → loading에 머문다.
    expect(result.current.state.status).toBe('loading');
  });

  it('T5c: ready 상태에서 refresh 중 RPC error면 기존 핀을 유지한다(error 미전이)', async () => {
    loadCached.mockResolvedValueOnce([pin({ muklogId: 'c1' })]);
    rpc.mockResolvedValueOnce({ data: [row({ muklog_id: 'f1' })], error: null });
    const { result } = renderHook(() => useMuklogPins());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'ready', pins: [pin({ muklogId: 'f1' })] }),
    );

    // 이미 fresh 핀을 보여주는 상태(ready)에서 refresh → RPC 실패.
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await act(async () => {
      await result.current.refresh();
    });
    // error로 전이하지 않고 직전 fresh 핀을 그대로 유지한다(stateRef==='ready' → error 스킵).
    expect(result.current.state).toEqual({ status: 'ready', pins: [pin({ muklogId: 'f1' })] });
  });
});
