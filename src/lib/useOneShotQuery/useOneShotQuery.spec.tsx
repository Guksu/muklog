// src/lib/useOneShotQuery.spec.tsx
// useOneShotQuery — "진입 1회 조회 + 명시적 refresh" 공용 훅 명세.
//   13개 조회 훅에 반복되던 (useState loading + mountedRef 가드 + 명명 effect(deps) + refresh) 를 흡수.
//   계약: ready state 는 { status:'ready' } + fetch 반환 payload(named 필드 보존). refresh 는 loading 으로 되돌리지 않는다.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useOneShotQuery } from './useOneShotQuery';

describe('useOneShotQuery', () => {
  it('마운트 시 1회 조회 → ready 에 payload 를 펼쳐 담는다(named 필드 보존)', async () => {
    const fetch = jest.fn().mockResolvedValue({ room: { id: 'r1' } });
    const { result } = renderHook(() =>
      useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR' }),
    );
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', room: { id: 'r1' } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetch throw → error 에 mapError 메시지', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('BOOM'));
    const mapError = jest.fn().mockReturnValue('불러오지 못했어요');
    const { result } = renderHook(() => useOneShotQuery({ deps: ['r1'], fetch, mapError }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toEqual({ status: 'error', message: '불러오지 못했어요' });
    expect(mapError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('refresh 는 재조회하되 loading 으로 되돌리지 않는다', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce({ n: 2 });
    const { result } = renderHook(() =>
      useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR' }),
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      await result.current.refresh();
    });
    // refresh 도중/후 loading 플래시 없음 — 곧장 새 ready.
    expect(result.current.state).toEqual({ status: 'ready', n: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('deps 변경 시 재조회한다', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true });
    const { rerender } = renderHook(
      ({ id }) => useOneShotQuery({ deps: [id], fetch, mapError: () => 'ERR' }),
      { initialProps: { id: 'a' } },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ id: 'b' });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('언마운트 후 도착한 응답은 setState 하지 않는다(mountedRef 가드)', async () => {
    let resolve: (v: unknown) => void = () => {};
    const fetch = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() =>
      useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR' }),
    );
    unmount();
    await act(async () => {
      resolve({ late: true });
    });
    // 언마운트 시점 상태(loading) 유지 — 경고/크래시 없음.
    expect(result.current.state).toEqual({ status: 'loading' });
  });
});
