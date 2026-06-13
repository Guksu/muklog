// src/features/muklog/useMuklog.spec.ts
// 단일 먹로그 + 전체 사진 조회 훅 — from('muklogs').select(임베드).eq('id').maybeSingle() 계약,
//   snake→camel 매핑, muklog_photos(order_index 오름차순) + createSignedUrls 1회 배치 → photos[].uri,
//   maybeSingle null(0행=삭제/권한차단)→notFound, select error→error, hasCoords(lat&lng) 분기,
//   signed URL 부분 발급 실패는 해당 슬롯 제외(best-effort ready). (plan §3.3 / §6 ②a~e)
//   SQL/RLS/Storage 권한은 단위 대상 아님 → supabase 체이닝 + storage 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { useMuklog } from './useMuklog';

const fromMock = supabase.from as jest.Mock;
const storageFromMock = supabase.storage.from as jest.Mock;
const maybeSingleMock = jest.fn();
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
  lat: null,
  lng: null,
  road_address: null,
  created_by: 'u1',
  created_at: '2026-02-14T00:00:00.000Z',
  muklog_photos: [],
  ...over,
});

// select().eq().maybeSingle() 체이닝을 1회 resolve하는 빌더.
const mockQueryResult = ({ data, error }: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  builder.select = (...a: unknown[]) => {
    selectMock(...a);
    return builder;
  };
  builder.eq = (...a: unknown[]) => {
    eqMock(...a);
    return builder;
  };
  builder.maybeSingle = (...a: unknown[]) => {
    maybeSingleMock(...a);
    return Promise.resolve({ data, error });
  };
  fromMock.mockReturnValueOnce(builder);
};

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  eqMock.mockReset();
  maybeSingleMock.mockReset();
  createSignedUrlsMock.mockReset();
  storageFromMock.mockReturnValue({
    createSignedUrls: (...a: unknown[]) => createSignedUrlsMock(...a),
  });
  createSignedUrlsMock.mockResolvedValue({ data: [], error: null });
});

describe('useMuklog', () => {
  it('정상 행을 받으면 ready로 전이하고 snake→camel로 매핑한다 (사진 0장 → photos:[]) (AC a·b)', async () => {
    mockQueryResult({ data: row(), error: null });
    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({
      status: 'ready',
      muklog: {
        id: 'm1',
        roomId: 'r1',
        placeName: '트라토리아 보나',
        category: 'pasta',
        area: '연남동',
        memo: '맛있었다',
        rating: 5,
        visitedAt: '2026-02-14',
        roadAddress: null,
        hasCoords: false,
        createdBy: 'u1',
        createdAt: '2026-02-14T00:00:00.000Z',
        photos: [],
        photoStoragePaths: [],
      },
    });
    // 사진 0장이면 signed URL 배치 발급을 호출하지 않는다(비용 가드레일).
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('select에 muklog_photos(storage_path, order_index) 임베드를 포함하고 eq(id)·maybeSingle 계약을 지킨다', async () => {
    mockQueryResult({ data: row(), error: null });
    renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(maybeSingleMock).toHaveBeenCalled());
    expect(fromMock).toHaveBeenCalledWith('muklogs');
    expect(selectMock.mock.calls[0][0]).toContain('muklog_photos(storage_path, order_index)');
    expect(eqMock).toHaveBeenCalledWith('id', 'm1');
  });

  it('사진을 order_index 오름차순으로 정렬하고 path들의 signed URL을 1회 배치 발급해 photos[].uri로 채운다 (AC a·e)', async () => {
    mockQueryResult({
      data: row({
        muklog_photos: [
          { storage_path: 'r1/m1/c.jpg', order_index: 2 },
          { storage_path: 'r1/m1/a.jpg', order_index: 0 },
          { storage_path: 'r1/m1/b.jpg', order_index: 1 },
        ],
      }),
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        { path: 'r1/m1/a.jpg', signedUrl: 'https://signed/a' },
        { path: 'r1/m1/b.jpg', signedUrl: 'https://signed/b' },
        { path: 'r1/m1/c.jpg', signedUrl: 'https://signed/c' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    // 배치 1회, order_index 오름차순 path 순서로 발급.
    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ['r1/m1/a.jpg', 'r1/m1/b.jpg', 'r1/m1/c.jpg'],
      3600,
    );
    const state = result.current.state as {
      status: 'ready';
      muklog: { photos: { orderIndex: number; uri: string; storagePath: string }[] };
    };
    // 각 photo는 자신의 storagePath를 함께 보유(인덱스 산술 없이 편집 reconcile 매핑, order_index 갭 안전).
    expect(state.muklog.photos).toEqual([
      { orderIndex: 0, storagePath: 'r1/m1/a.jpg', uri: 'https://signed/a' },
      { orderIndex: 1, storagePath: 'r1/m1/b.jpg', uri: 'https://signed/b' },
      { orderIndex: 2, storagePath: 'r1/m1/c.jpg', uri: 'https://signed/c' },
    ]);
  });

  it('photoStoragePaths를 order_index 오름차순 전체 path로 매핑한다(URL 발급 실패와 무관, plan §3.6 e)', async () => {
    mockQueryResult({
      data: row({
        muklog_photos: [
          { storage_path: 'r1/m1/c.jpg', order_index: 2 },
          { storage_path: 'r1/m1/a.jpg', order_index: 0 },
          { storage_path: 'r1/m1/b.jpg', order_index: 1 },
        ],
      }),
      error: null,
    });
    // signed URL은 전부 실패시켜도 photoStoragePaths는 전체 path를 유지(삭제용).
    createSignedUrlsMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });

    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as {
      status: 'ready';
      muklog: { photos: unknown[]; photoStoragePaths: string[] };
    };
    expect(state.muklog.photoStoragePaths).toEqual(['r1/m1/a.jpg', 'r1/m1/b.jpg', 'r1/m1/c.jpg']);
    // 발급 전부 실패 → photos는 비지만 path는 보존.
    expect(state.muklog.photos).toEqual([]);
  });

  it('order_index에 갭이 있어도 각 photo가 자신의 storagePath를 보유한다(인덱스 산술 의존 제거, reindex 실패 안전)', async () => {
    // 갭 시나리오: order_index 0, 2(1 없음) — reindex 실패로 빈 슬롯이 생긴 상태.
    mockQueryResult({
      data: row({
        muklog_photos: [
          { storage_path: 'r1/m1/a.jpg', order_index: 0 },
          { storage_path: 'r1/m1/c.jpg', order_index: 2 },
        ],
      }),
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        { path: 'r1/m1/a.jpg', signedUrl: 'https://signed/a' },
        { path: 'r1/m1/c.jpg', signedUrl: 'https://signed/c' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as {
      status: 'ready';
      muklog: { photos: { orderIndex: number; uri: string; storagePath: string }[] };
    };
    // 각 photo의 storagePath는 같은 임베드 행에서 zip — order_index 갭과 무관하게 정확.
    expect(state.muklog.photos).toEqual([
      { orderIndex: 0, storagePath: 'r1/m1/a.jpg', uri: 'https://signed/a' },
      { orderIndex: 2, storagePath: 'r1/m1/c.jpg', uri: 'https://signed/c' },
    ]);
  });

  it('signed URL이 일부만 발급되면 발급 실패 슬롯은 제외하고 ready를 유지한다 (AC e best-effort)', async () => {
    mockQueryResult({
      data: row({
        muklog_photos: [
          { storage_path: 'r1/m1/a.jpg', order_index: 0 },
          { storage_path: 'r1/m1/b.jpg', order_index: 1 },
        ],
      }),
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'r1/m1/a.jpg', signedUrl: 'https://signed/a' }], // b는 누락
      error: null,
    });

    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as {
      status: 'ready';
      muklog: { photos: { orderIndex: number; uri: string; storagePath: string }[] };
    };
    expect(state.muklog.photos).toEqual([
      { orderIndex: 0, storagePath: 'r1/m1/a.jpg', uri: 'https://signed/a' },
    ]);
  });

  it('signed URL 배치 전체가 실패해도 ready(photos:[]) — 사진 때문에 화면을 막지 않는다 (AC e)', async () => {
    mockQueryResult({
      data: row({ muklog_photos: [{ storage_path: 'r1/m1/a.jpg', order_index: 0 }] }),
      error: null,
    });
    createSignedUrlsMock.mockResolvedValueOnce({ data: null, error: new Error('signed boom') });

    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const state = result.current.state as { status: 'ready'; muklog: { photos: unknown[] } };
    expect(state.muklog.photos).toEqual([]);
  });

  it('lat/lng 둘 다 있으면 hasCoords=true, 하나라도 없으면 false (AC d 좌표 분기)', async () => {
    mockQueryResult({ data: row({ lat: 37.5, lng: 127.0 }), error: null });
    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect((result.current.state as { muklog: { hasCoords: boolean } }).muklog.hasCoords).toBe(true);

    // lat만 있으면 false
    mockQueryResult({ data: row({ lat: 37.5, lng: null }), error: null });
    const { result: r2 } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(r2.current.state.status).toBe('ready'));
    expect((r2.current.state as { muklog: { hasCoords: boolean } }).muklog.hasCoords).toBe(false);
  });

  it('maybeSingle null(0행=삭제됨/타 방 권한 차단)이면 notFound로 전이한다 (AC c)', async () => {
    mockQueryResult({ data: null, error: null });
    const { result } = renderHook(() => useMuklog({ muklogId: 'gone' }));
    await waitFor(() => expect(result.current.state).toEqual({ status: 'notFound' }));
    // 0행이면 signed URL 발급 없음.
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('select error면 error 상태와 한국어 메시지로 전이한다 (AC d)', async () => {
    mockQueryResult({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect((result.current.state as { status: 'error'; message: string }).message).toMatch(/불러오지 못했어요/);
  });

  it('초기 상태는 loading이다', () => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () => new Promise(() => {}); // 영원히 pending
    fromMock.mockReturnValueOnce(builder);
    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음)', async () => {
    mockQueryResult({ data: row(), error: null });
    const { result } = renderHook(() => useMuklog({ muklogId: 'm1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    mockQueryResult({ data: row({ place_name: '어니언' }), error: null });
    await act(async () => {
      await result.current.refresh();
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect((result.current.state as { muklog: { placeName: string } }).muklog.placeName).toBe('어니언');
  });
});
