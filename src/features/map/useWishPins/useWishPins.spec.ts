// src/features/map/useWishPins.spec.ts
// 크로스-로그 위시 핀 조회 훅 — from('wishlist_items').select(컬럼).not(lat,is,null).not(lng,is,null)
//   .order('created_at',desc) 계약. room 필터 없음(RLS가 크로스-로그 스코프), 마운트 1회 + refresh(폴링 없음).
//   (map-wish-pins §3.2·§7-1 / T4) SQL/RLS는 단위 대상 아님 → supabase 체이닝 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '@/lib/supabase';
import { useWishPins } from './useWishPins';

const fromMock = supabase.from as jest.Mock;
const selectMock = jest.fn();
const notMock = jest.fn();
const orderMock = jest.fn();
const eqMock = jest.fn();

const row = (over?: Record<string, unknown>) => ({
  id: 'w1',
  room_id: 'r1',
  place_name: '성수 칼국수',
  category: 'noodle',
  area: '성수동',
  lat: 37.544,
  lng: 127.055,
  ...over,
});

// select→not→not→order 체이닝, 마지막 order가 thenable로 결과 resolve.
const mockQueryResult = ({ data, error }: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  const result = Promise.resolve({ data, error });
  builder.select = (...a: unknown[]) => {
    selectMock(...a);
    return builder;
  };
  builder.not = (...a: unknown[]) => {
    notMock(...a);
    return builder;
  };
  builder.eq = (...a: unknown[]) => {
    eqMock(...a);
    return builder;
  };
  builder.order = (...a: unknown[]) => {
    orderMock(...a);
    return builder;
  };
  builder.then = (onFulfilled: (v: unknown) => unknown) => result.then(onFulfilled);
  fromMock.mockReturnValue(builder);
};

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  notMock.mockReset();
  eqMock.mockReset();
  orderMock.mockReset();
});

describe('useWishPins', () => {
  it('마운트 시 wishlist_items를 크로스-로그로 조회하고 ready로 전이한다(room 필터 없음)', async () => {
    mockQueryResult({ data: [row()], error: null });
    const { result } = renderHook(() => useWishPins());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(fromMock).toHaveBeenCalledWith('wishlist_items');
    // 크로스-로그: room 필터(.eq('room_id')) 미포함 — RLS가 내 방 스코프.
    expect(eqMock).not.toHaveBeenCalled();
  });

  it('lat/lng not null 필터를 건다(좌표 있는 위시만)', async () => {
    mockQueryResult({ data: [row()], error: null });
    renderHook(() => useWishPins());
    await waitFor(() => expect(notMock).toHaveBeenCalledWith('lat', 'is', null));
    expect(notMock).toHaveBeenCalledWith('lng', 'is', null);
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('rows를 WishPin[]로 매핑한다(toWishPin, 좌표 비유한 제외)', async () => {
    mockQueryResult({ data: [row({ id: 'w1' }), row({ id: 'bad', lat: null })], error: null });
    const { result } = renderHook(() => useWishPins());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state;
    if (state.status !== 'ready') throw new Error('expected ready');
    // lat=null 행은 toWishPin이 제외 → 유효 1건.
    expect(state.pins.map((p) => p.id)).toEqual(['w1']);
    expect(state.pins[0].roomId).toBe('r1');
  });

  it('조회 실패 시 error 상태로 전이한다', async () => {
    mockQueryResult({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useWishPins());
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('refresh는 재조회하지만 폴링은 없다(마운트 1회 + refresh만)', async () => {
    mockQueryResult({ data: [row()], error: null });
    const { result } = renderHook(() => useWishPins());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(fromMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });
    expect(fromMock).toHaveBeenCalledTimes(2); // refresh 1회 추가, 그 외 자동 폴링 없음.
  });
});
