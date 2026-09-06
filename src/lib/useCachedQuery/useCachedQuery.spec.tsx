// src/lib/useCachedQuery/useCachedQuery.spec.tsx
// 캐시 조회 어댑터 명세 (query-cache plan §3.4 / T3, H5~H8).
//   seam = 반환 { state, refresh }. useQuery 내부 상태(isFetching 등)는 단언하지 않는다(라이브러리 동작).
import { renderHook, waitFor, act } from '@testing-library/react-native';

import { createQueryWrapper } from '@/lib/queryClient/testQueryWrapper';

import { useCachedQuery } from './useCachedQuery';

const mapError = () => '불러오지 못했어요';

describe('useCachedQuery', () => {
  it('H5: 마운트 → loading → ready(payload 펼침)', async () => {
    const queryFn = jest.fn(async () => ({ logs: ['a'] }));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useCachedQuery({ queryKey: ['t', '1'], queryFn, mapError }),
      { wrapper },
    );

    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', logs: ['a'] }));
  });

  it('H6(AC3-5): refresh() 중에도 loading으로 되돌아가지 않는다', async () => {
    let resolveSecond: ((value: { logs: string[] }) => void) | null = null;
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce({ logs: ['first'] })
      .mockImplementationOnce(
        () =>
          new Promise<{ logs: string[] }>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useCachedQuery({ queryKey: ['t', '2'], queryFn, mapError }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    let refreshed: Promise<void> | null = null;
    act(() => {
      refreshed = result.current.refresh();
    });
    // 응답이 아직 도착하지 않은 시점 — 이미 그려진 목록이 유지되어야 한다.
    expect(result.current.state).toEqual({ status: 'ready', logs: ['first'] });

    await act(async () => {
      resolveSecond?.({ logs: ['second'] });
      await refreshed;
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', logs: ['second'] }));
  });

  it('H7(AC3-6): queryFn이 throw하면 error 상태가 되고 refresh()는 reject하지 않는다', async () => {
    const queryFn = jest.fn(async () => {
      throw new Error('boom');
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useCachedQuery({ queryKey: ['t', '3'], queryFn, mapError }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: '불러오지 못했어요' }));

    // await refresh()가 호출부에서 그대로 동작해야 한다(기존 useOneShotQuery.refresh 계약).
    await act(async () => {
      await expect(result.current.refresh()).resolves.toBeUndefined();
    });
  });

  it('H8(AC3-4): 성공 이후 재조회가 실패해도 ready를 유지한다(오프라인 포커스 복귀 E3)', async () => {
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce({ logs: ['cached'] })
      .mockRejectedValueOnce(new Error('offline'));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useCachedQuery({ queryKey: ['t', '4'], queryFn, mapError }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      await result.current.refresh();
    });
    // refresh() 반환 직후에는 옵저버가 아직 실패를 반영하지 않는다 —
    //   한 틱 정착시켜야 error가 실제로 도착한 뒤의 판정(data 우선)을 단언하게 된다(qa-logic S2).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.state).toEqual({ status: 'ready', logs: ['cached'] });
  });

  it('AC3-6: refresh()를 두 번 부르면 queryFn도 그만큼 더 호출된다(폴링이 아니라 명시 호출로만 재조회)', async () => {
    const queryFn = jest.fn(async () => ({ logs: ['a'] }));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useCachedQuery({ queryKey: ['t', '5'], queryFn, mapError }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      await result.current.refresh();
      await result.current.refresh();
    });

    expect(queryFn).toHaveBeenCalledTimes(3); // 마운트 1 + refresh 2
  });

  it('AC4-3의 기반: 같은 캐시로 재마운트하면 첫 렌더가 loading이 아니라 ready다', async () => {
    const queryFn = jest.fn(async () => ({ logs: ['a'] }));
    const { wrapper, client } = createQueryWrapper();

    const first = renderHook(() => useCachedQuery({ queryKey: ['t', '6'], queryFn, mapError }), { wrapper });
    await waitFor(() => expect(first.result.current.state.status).toBe('ready'));
    first.unmount();

    const { wrapper: sameCache } = createQueryWrapper({ client });
    const second = renderHook(() => useCachedQuery({ queryKey: ['t', '6'], queryFn, mapError }), {
      wrapper: sameCache,
    });

    expect(second.result.current.state).toEqual({ status: 'ready', logs: ['a'] });
  });
});
