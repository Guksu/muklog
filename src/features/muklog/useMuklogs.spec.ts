// src/features/muklog/useMuklogs.spec.ts
// 먹로그 목록 조회 훅 — from('muklogs').select().eq().order().order() 계약, snake→camel 매핑,
//   빈 배열→ready(에러 아님), error 전이, 정렬 인자 검증, refresh 재조회(폴링 없음).
//   (plan §5.2 / §5 T5, AC1·AC6·AC11) SQL/RLS는 단위 대상 아님 → supabase 체이닝 모킹으로 클라 계약만 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { supabase } from '@/lib/supabase';
import { useMuklogs } from './useMuklogs';

// 체이닝 빌더: select/eq/order는 this(빌더)를 반환, 마지막 order가 thenable로 결과를 resolve한다.
const fromMock = supabase.from as jest.Mock;
const orderMock = jest.fn();
const eqMock = jest.fn();
const selectMock = jest.fn();

const row = (over?: Record<string, unknown>) => ({
  id: 'm1',
  room_id: 'r1',
  place_name: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '맛있었다',
  rating: 5,
  visited_at: '2026-02-14',
  created_by: 'u1',
  created_at: '2026-02-14T00:00:00.000Z',
  ...over,
});

// 결과를 1회 resolve하는 체이닝 빌더를 세팅한다.
const mockQueryResult = ({ data, error }: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  const result = Promise.resolve({ data, error });
  builder.select = (...a: unknown[]) => {
    selectMock(...a);
    return builder;
  };
  builder.eq = (...a: unknown[]) => {
    eqMock(...a);
    return builder;
  };
  // order는 호출 인자를 기록하고, 마지막 order 결과가 await되도록 builder를 thenable로 만든다.
  builder.order = (...a: unknown[]) => {
    orderMock(...a);
    return builder;
  };
  builder.then = (onFulfilled: (v: unknown) => unknown) => result.then(onFulfilled);
  fromMock.mockReturnValueOnce(builder);
};

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  eqMock.mockReset();
  orderMock.mockReset();
});

describe('useMuklogs', () => {
  it('rows를 받으면 ready로 전이하고 snake→camel로 매핑한다 (AC1)', async () => {
    mockQueryResult({ data: [row()], error: null });
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({
      status: 'ready',
      muklogs: [
        {
          id: 'm1',
          roomId: 'r1',
          placeName: '트라토리아 보나',
          category: 'pasta',
          area: '연남동',
          memo: '맛있었다',
          rating: 5,
          visitedAt: '2026-02-14',
          createdBy: 'u1',
          createdAt: '2026-02-14T00:00:00.000Z',
        },
      ],
    });
  });

  it('from/eq/order 계약(room_id 필터 + visited_at desc, created_at desc)을 지킨다 (AC6·AC7)', async () => {
    mockQueryResult({ data: [], error: null });
    renderHook(() => useMuklogs({ roomId: 'r1' }));

    await waitFor(() => expect(orderMock).toHaveBeenCalledTimes(2));
    expect(fromMock).toHaveBeenCalledWith('muklogs');
    expect(eqMock).toHaveBeenCalledWith('room_id', 'r1');
    expect(orderMock).toHaveBeenNthCalledWith(1, 'visited_at', { ascending: false, nullsFirst: false });
    expect(orderMock).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false });
  });

  it('빈 배열이면 ready + muklogs:[] 로 전이한다 (빈 상태=정상) (AC1)', async () => {
    mockQueryResult({ data: [], error: null });
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', muklogs: [] }));
  });

  it('data가 null이어도 ready + muklogs:[] 로 흡수한다', async () => {
    mockQueryResult({ data: null, error: null });
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', muklogs: [] }));
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다 (AC11)', async () => {
    mockQueryResult({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        message: '맛집 목록을 불러오지 못했어요. 다시 시도해 주세요.',
      }),
    );
  });

  it('초기 상태는 loading이다', () => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.order = () => builder;
    builder.then = () => new Promise(() => {}); // 영원히 pending
    fromMock.mockReturnValueOnce(builder);
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음)', async () => {
    mockQueryResult({ data: [], error: null });
    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', muklogs: [] }));

    mockQueryResult({ data: [row({ id: 'm9' })], error: null });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state.status).toBe('ready');
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
