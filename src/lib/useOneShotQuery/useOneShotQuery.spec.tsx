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

  // QA F3-S1(join-push 3차): 위 테스트는 refresh 가 끝난 "뒤"만 본다 — 진행 중 상태를 직접 봐야 "loading 으로 되돌리지 않는다"가
  //   잠긴다. LogScreen 은 재포커스·알림 탭마다 멤버를 다시 부르므로, 깨지면 그때마다 참여자 블록·제목이 깜박인다.
  it('refresh 진행 중에도 직전 ready 를 그대로 둔다(진행 중 상태를 직접 본다 — loading 플래시 0)', async () => {
    let resolveSecond: (value: { n: number }) => void = () => {};
    const fetch = jest
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockReturnValueOnce(new Promise<{ n: number }>((resolve) => (resolveSecond = resolve)));
    const { result } = renderHook(() =>
      useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR' }),
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.refresh();
    });
    // 재조회가 끝나기 전 — 직전 값 그대로(LogScreen 재포커스마다 참여자 블록이 사라졌다 나타나지 않는다).
    expect(result.current.state).toEqual({ status: 'ready', n: 1 });

    await act(async () => {
      resolveSecond({ n: 2 });
      await pending;
    });
    expect(result.current.state).toEqual({ status: 'ready', n: 2 });
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

  // join-push V3(리더 결정 2026-10-01): "직전 ready 유지"는 선택 옵션(keepLastReady)이다. 이 훅을 쓰는 소비처 대부분은
  //   옵션을 켜지 않으므로 기존 계약(재조회 실패 = error)이 그대로여야 한다 — 기본값을 바꾸는 것은 U14 범위다.
  describe('keepLastReady — 직전 ready 유지(선택 옵션, join-push V3)', () => {
    it('옵션을 켜지 않으면(기본) ready 뒤 재조회 실패는 error 가 된다(켜지 않은 소비처는 기존과 같다)', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockRejectedValueOnce(new Error('OFFLINE'));
      const { result } = renderHook(() =>
        useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR' }),
      );
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.state).toEqual({ status: 'error', message: 'ERR' });
    });

    it('옵션을 켜면 ready 뒤 재조회가 실패해도 직전 ready 를 그대로 두고, 다음 성공은 새 값이 된다', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockRejectedValueOnce(new Error('OFFLINE'))
        .mockResolvedValueOnce({ n: 3 });
      const { result } = renderHook(() =>
        useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR', keepLastReady: true }),
      );
      await waitFor(() => expect(result.current.state.status).toBe('ready'));

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.state).toEqual({ status: 'ready', n: 1 });

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.state).toEqual({ status: 'ready', n: 3 });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('옵션을 켜도 한 번도 ready 가 아니었으면(첫 조회 실패) error 다 — 유지할 값이 없다', async () => {
      const fetch = jest.fn().mockRejectedValue(new Error('OFFLINE'));
      const { result } = renderHook(() =>
        useOneShotQuery({ deps: ['r1'], fetch, mapError: () => 'ERR', keepLastReady: true }),
      );
      await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: 'ERR' }));
    });

    it('옵션을 켜도 deps 가 바뀐 뒤 첫 조회가 실패하면 error 다 — 이전 deps 의 값(다른 로그의 멤버)을 남기지 않는다', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockRejectedValueOnce(new Error('OFFLINE'));
      const { result, rerender } = renderHook(
        ({ id }) => useOneShotQuery({ deps: [id], fetch, mapError: () => 'ERR', keepLastReady: true }),
        { initialProps: { id: 'a' } },
      );
      await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', n: 1 }));

      rerender({ id: 'b' });

      await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: 'ERR' }));
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('옵션을 켜면 deps 가 바뀌고 새 값이 ready 가 된 뒤의 재조회 실패는 그 새 값을 유지한다', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce({ n: 1 })
        .mockResolvedValueOnce({ n: 2 })
        .mockRejectedValueOnce(new Error('OFFLINE'));
      const { result, rerender } = renderHook(
        ({ id }) => useOneShotQuery({ deps: [id], fetch, mapError: () => 'ERR', keepLastReady: true }),
        { initialProps: { id: 'a' } },
      );
      await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', n: 1 }));
      rerender({ id: 'b' });
      await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', n: 2 }));

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.state).toEqual({ status: 'ready', n: 2 });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    // QA F4-S1(join-push 4차): 로그가 바뀌기 전에 시작한 조회가 늦게 성공해도 "지금 로그의 ready"로 치지 않는다 —
    //   그 뒤 새 로그 조회가 실패하면 error(이전 로그의 멤버를 붙잡지 않는다). 세대는 조회를 시작할 때 잡은 값으로 기록한다.
    it('옵션을 켜도 deps 가 바뀌기 전에 시작한 조회가 늦게 성공한 뒤 새 deps 조회가 실패하면 error 다(이전 deps 값을 붙잡지 않는다)', async () => {
      let resolveOld: (value: { n: number }) => void = () => {};
      let rejectNew: (reason: Error) => void = () => {};
      const fetch = jest
        .fn()
        .mockReturnValueOnce(new Promise<{ n: number }>((resolve) => (resolveOld = resolve)))
        .mockReturnValueOnce(new Promise<{ n: number }>((_resolve, reject) => (rejectNew = reject)));
      const { result, rerender } = renderHook(
        ({ id }) => useOneShotQuery({ deps: [id], fetch, mapError: () => 'ERR', keepLastReady: true }),
        { initialProps: { id: 'a' } },
      );
      rerender({ id: 'b' });
      expect(fetch).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveOld({ n: 1 });
      });
      await act(async () => {
        rejectNew(new Error('OFFLINE'));
      });
      expect(result.current.state).toEqual({ status: 'error', message: 'ERR' });
    });

    // QA F4-S2(join-push 4차): 로그가 바뀌고 새 값이 ready 가 된 뒤 늦게 도착한 이전 로그 조회의 실패는 새 값을 덮지 않는다.
    it('옵션을 켜면 deps 가 바뀌고 새 값이 ready 가 된 뒤 늦게 도착한 이전 deps 조회의 실패는 새 값을 그대로 둔다', async () => {
      let rejectOld: (reason: Error) => void = () => {};
      const fetch = jest
        .fn()
        .mockReturnValueOnce(new Promise<{ n: number }>((_resolve, reject) => (rejectOld = reject)))
        .mockResolvedValueOnce({ n: 2 });
      const { result, rerender } = renderHook(
        ({ id }) => useOneShotQuery({ deps: [id], fetch, mapError: () => 'ERR', keepLastReady: true }),
        { initialProps: { id: 'a' } },
      );
      rerender({ id: 'b' });
      await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', n: 2 }));

      await act(async () => {
        rejectOld(new Error('OFFLINE'));
      });
      expect(result.current.state).toEqual({ status: 'ready', n: 2 });
    });
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
