// src/features/wishlist/useWishlist.spec.ts
// 위시 목록 조회 훅 — from('wishlist_items').select(컬럼).eq('room_id').order('created_at',desc) 계약,
//   getSession으로 meId 확보 → snake→camel 매핑(addedByMe), status 전이, refresh 재조회(폴링 없음).
//   (plan §4.3·§4.4 / TC-3, 경계면 B1·B3·B4) SQL/RLS는 단위 대상 아님 → supabase 체이닝+auth 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { useWishlist } from './useWishlist';

const fromMock = supabase.from as jest.Mock;
const getSessionMock = supabase.auth.getSession as jest.Mock;
const orderMock = jest.fn();
const eqMock = jest.fn();
const selectMock = jest.fn();

const row = (over?: Record<string, unknown>) => ({
  id: 'w1',
  room_id: 'r1',
  place_name: '성수동 베이커리',
  category: 'cafe',
  area: '성수동',
  road_address: '서울 성동구 연무장길 1',
  lat: 37.544,
  lng: 127.055,
  kakao_place_id: '12345',
  note: '크루아상 맛집',
  added_by: 'me',
  created_at: '2026-06-16T10:00:00.000Z',
  ...over,
});

// select→eq→order 체이닝, 마지막 order가 thenable로 결과를 resolve.
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
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
});

describe('useWishlist', () => {
  it('rows를 받으면 ready로 전이하고 snake→camel + addedByMe(본인)로 매핑한다 (TC-3)', async () => {
    mockQueryResult({ data: [row()], error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({
      status: 'ready',
      items: [
        {
          id: 'w1',
          roomId: 'r1',
          placeName: '성수동 베이커리',
          category: 'cafe',
          area: '성수동',
          roadAddress: '서울 성동구 연무장길 1',
          lat: 37.544,
          lng: 127.055,
          kakaoPlaceId: '12345',
          note: '크루아상 맛집',
          addedBy: 'me',
          addedByMe: true,
          createdAt: '2026-06-16T10:00:00.000Z',
        },
      ],
    });
  });

  it('added_by가 내가 아니면 addedByMe=false(짝꿍) (B4)', async () => {
    mockQueryResult({ data: [row({ added_by: 'partner' })], error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as { status: 'ready'; items: { addedByMe: boolean }[] };
    expect(state.items[0].addedByMe).toBe(false);
  });

  it('세션이 없으면(meId null) 모든 항목 addedByMe=false로 안전 폴백한다', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    mockQueryResult({ data: [row({ added_by: 'me' })], error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as { status: 'ready'; items: { addedByMe: boolean }[] };
    expect(state.items[0].addedByMe).toBe(false);
  });

  it('select 컬럼 + from/eq/order(created_at desc) 계약을 지킨다 (B1·B3)', async () => {
    mockQueryResult({ data: [], error: null });
    renderHook(() => useWishlist({ roomId: 'r1' }));

    await waitFor(() => expect(orderMock).toHaveBeenCalled());
    expect(fromMock).toHaveBeenCalledWith('wishlist_items');
    expect(selectMock.mock.calls[0][0]).toBe(
      'id, room_id, place_name, category, area, road_address, lat, lng, kakao_place_id, note, added_by, created_at',
    );
    expect(eqMock).toHaveBeenCalledWith('room_id', 'r1');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('빈 배열이면 ready + items:[] 로 전이한다 (빈 상태=정상) (TC-1)', async () => {
    mockQueryResult({ data: [], error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', items: [] }));
  });

  it('data가 null이어도 ready + items:[] 로 흡수한다', async () => {
    mockQueryResult({ data: null, error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', items: [] }));
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다', async () => {
    mockQueryResult({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        message: '위시리스트를 불러오지 못했어요. 다시 시도해 주세요.',
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
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음)', async () => {
    mockQueryResult({ data: [], error: null });
    const { result } = renderHook(() => useWishlist({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', items: [] }));

    mockQueryResult({ data: [row({ id: 'w9' })], error: null });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state.status).toBe('ready');
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
