// src/features/muklog/useMuklogs.spec.ts
// 먹로그 목록 조회 훅 — from('muklogs').select(임베드).eq().order().order() 계약, snake→camel 매핑,
//   muklog_photos 임베드(대표 1장 + 개수) + createSignedUrls 배치 발급 → coverUri/photoCount.
//   빈 배열→ready(에러 아님), error 전이, 정렬 인자 검증, refresh 재조회(폴링 없음).
//   (plan §5.2·§3.5 / §5 ⑤⑥, AC1·AC6·AC11) SQL/RLS는 단위 대상 아님 → supabase 체이닝+storage 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { useMuklogs } from './useMuklogs';

// 체이닝 빌더: select/eq/order는 this(빌더)를 반환, 마지막 order가 thenable로 결과를 resolve한다.
const fromMock = supabase.from as jest.Mock;
const storageFromMock = supabase.storage.from as jest.Mock;
const orderMock = jest.fn();
const eqMock = jest.fn();
const selectMock = jest.fn();
const createSignedUrlsMock = jest.fn();

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
  muklog_photos: [],
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
  createSignedUrlsMock.mockReset();
  storageFromMock.mockReturnValue({
    createSignedUrls: (...a: unknown[]) => createSignedUrlsMock(...a),
  });
  // 기본: 배치 발급 0건(사진 없는 케이스).
  createSignedUrlsMock.mockResolvedValue({ data: [], error: null });
});

describe('useMuklogs', () => {
  it('rows를 받으면 ready로 전이하고 snake→camel로 매핑한다 (사진 없으면 photoCount 0 / coverUri null) (AC1)', async () => {
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
          photoCount: 0,
          coverUri: null,
        },
      ],
    });
    // 사진 0건이면 signed URL 배치 발급을 호출하지 않는다(비용 가드레일).
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('select에 muklog_photos 임베드(storage_path, order_index)를 포함한다 (경계: 컬럼명 정확)', async () => {
    mockQueryResult({ data: [], error: null });
    renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(selectMock).toHaveBeenCalled());
    expect(selectMock.mock.calls[0][0]).toContain('muklog_photos(storage_path, order_index)');
  });

  it('임베드된 사진 → 대표(order_index 최소) storage_path의 signed URL을 coverUri로, 개수를 photoCount로 채운다', async () => {
    // order 2/0/1 → 대표는 order 0 = p-cover.
    mockQueryResult({
      data: [
        row({
          muklog_photos: [
            { storage_path: 'r1/m1/c.jpg', order_index: 2 },
            { storage_path: 'r1/m1/a.jpg', order_index: 0 },
            { storage_path: 'r1/m1/b.jpg', order_index: 1 },
          ],
        }),
      ],
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'r1/m1/a.jpg', signedUrl: 'https://signed/a' }],
      error: null,
    });

    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    // 대표 path 1개만 배치 발급(전체 5장 아님 — 비용 가드레일 §8).
    expect(createSignedUrlsMock).toHaveBeenCalledWith(['r1/m1/a.jpg'], 3600);
    const state = result.current.state as { status: 'ready'; muklogs: { photoCount: number; coverUri: string | null }[] };
    expect(state.muklogs[0].photoCount).toBe(3);
    expect(state.muklogs[0].coverUri).toBe('https://signed/a');
  });

  it('여러 먹로그의 대표 path를 한 번에 배치 발급한다 (createSignedUrls 1회)', async () => {
    mockQueryResult({
      data: [
        row({ id: 'm1', muklog_photos: [{ storage_path: 'r1/m1/a.jpg', order_index: 0 }] }),
        row({ id: 'm2', muklog_photos: [{ storage_path: 'r1/m2/a.jpg', order_index: 0 }] }),
      ],
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        { path: 'r1/m1/a.jpg', signedUrl: 'https://signed/m1' },
        { path: 'r1/m2/a.jpg', signedUrl: 'https://signed/m2' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(['r1/m1/a.jpg', 'r1/m2/a.jpg'], 3600);
    const state = result.current.state as { status: 'ready'; muklogs: { coverUri: string | null }[] };
    expect(state.muklogs[0].coverUri).toBe('https://signed/m1');
    expect(state.muklogs[1].coverUri).toBe('https://signed/m2');
  });

  it('signed URL 발급 실패해도 목록은 ready(coverUri null로 폴백) — 사진 때문에 목록을 막지 않는다', async () => {
    mockQueryResult({
      data: [row({ muklog_photos: [{ storage_path: 'r1/m1/a.jpg', order_index: 0 }] })],
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({ data: null, error: new Error('signed boom') });

    const { result } = renderHook(() => useMuklogs({ roomId: 'r1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as { status: 'ready'; muklogs: { photoCount: number; coverUri: string | null }[] };
    expect(state.muklogs[0].photoCount).toBe(1);
    expect(state.muklogs[0].coverUri).toBeNull();
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
