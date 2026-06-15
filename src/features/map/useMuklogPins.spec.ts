// src/features/map/useMuklogPins.spec.ts
// 내 모든 로그의 좌표 있는 먹로그 핀 1회 조회 훅 단위 테스트 (plan §3.3·§5-1 useMuklogPins).
//   list_my_muklog_pins RPC 호출 계약, rows(snake)→MuklogPin[](camel) 매핑, 빈→ready(에러 아님),
//   error 전이(한국어), 초기 loading, refresh 재조회(폴링 없음), 언마운트 후 setState 안 함.
//   SQL/RPC는 단위 대상 아님 → supabase.rpc 모킹으로 클라 계약만 검증(useMyLogs 패턴 계승).
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useMuklogPins } from './useMuklogPins';
import { type MuklogPinRow } from './types';

const rpc = supabase.rpc as jest.Mock;

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

beforeEach(() => {
  rpc.mockReset();
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
});
