// src/features/map/useDeferredFlag.spec.ts
// 콜드스타트 보호용 지연 플래그 훅 — 초기 false, 첫 프레임 후(runAfterInteractions)/유휴 시점에 true (map-prewarm T1·T6).
//   InteractionManager는 단위에서 mock(실제 유휴 타이밍은 디바이스 스모크). fake timer로 delayMs 검증.
import { InteractionManager } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useDeferredFlag } from './useDeferredFlag';

describe('useDeferredFlag', () => {
  let runAfterInteractionsSpy: jest.SpyInstance;
  let setTimeoutSpy: jest.SpyInstance;
  // runAfterInteractions 콜백을 수동으로 발화하기 위한 보관소(즉시 실행하지 않고 flush 제어).
  let pendingInteractionCallbacks: Array<() => void>;
  // setTimeout 반환값(타이머 id) 누적 — cleanup이 정확히 그 id를 clearTimeout하는지 검증용(식별 비교만 — unknown).
  let setTimeoutReturns: unknown[];

  beforeEach(() => {
    jest.useFakeTimers();
    pendingInteractionCallbacks = [];
    setTimeoutReturns = [];
    runAfterInteractionsSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task?: unknown) => {
        // task는 함수 형태(SimpleTask)일 때만 보관 — 훅은 함수 콜백으로 호출한다.
        if (typeof task === 'function') pendingInteractionCallbacks.push(task as () => void);
        // runAfterInteractions가 반환하는 cancellable 핸들 형태를 흉내(cancel no-op).
        return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() } as never;
      });
    // setTimeout 호출의 반환 id를 누적(원래 동작은 유지) — cleanup이 그 id를 clearTimeout하는지 단언하기 위함.
    const realSetTimeout = global.setTimeout as unknown as (...a: unknown[]) => unknown;
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((...a: unknown[]) => {
        const id = realSetTimeout(...a);
        setTimeoutReturns.push(id);
        return id;
      }) as unknown as typeof setTimeout);
  });

  afterEach(() => {
    runAfterInteractionsSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // 보류 중인 runAfterInteractions 콜백을 모두 실행(첫 프레임 완료를 흉내).
  const flushInteractions = () => {
    act(() => {
      pendingInteractionCallbacks.forEach((cb) => cb());
      pendingInteractionCallbacks = [];
    });
  };

  it('초기 반환값은 false다 (콜드스타트 첫 프레임 경합 방지)', () => {
    const { result } = renderHook(() => useDeferredFlag({}));
    expect(result.current).toBe(false);
  });

  it('runAfterInteractions(첫 프레임 완료) 후 true로 전환한다', () => {
    const { result } = renderHook(() => useDeferredFlag({}));
    expect(result.current).toBe(false);
    flushInteractions();
    expect(result.current).toBe(true);
  });

  it('delayMs가 있으면 인터랙션 완료 후 추가 지연이 경과해야 true가 된다', () => {
    const { result } = renderHook(() => useDeferredFlag({ delayMs: 500 }));
    flushInteractions();
    // 인터랙션은 끝났지만 추가 지연 미경과 → 아직 false.
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });

  it('delayMs=0이면 인터랙션 완료 직후 true가 된다', () => {
    const { result } = renderHook(() => useDeferredFlag({ delayMs: 0 }));
    flushInteractions();
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current).toBe(true);
  });

  // 언마운트 정리(cleanup) — 보류 중이던 delayTimer를 clearTimeout으로 직접 정리하는지 spy로 강제(load-bearing).
  //   ⚠️ React 18.3+는 setState-after-unmount 경고를 없앴고 renderHook 언마운트 후 result.current가 고정돼
  //      "경고 0 + result false" 단언만으로는 cleanup을 깨도 green이 유지된다(qa-logic mutation 확인).
  //      → clearTimeout 호출과 "보류 콜백이 setState하지 않음(state setter 미호출)"을 명시 단언해 mutation 시 red가 되게 한다.
  it('언마운트 시 보류 중이던 delayTimer를 clearTimeout으로 정리한다 (cleanup load-bearing)', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount } = renderHook(() => useDeferredFlag({ delayMs: 500 }));

    // 인터랙션을 먼저 flush → delayTimer(setTimeout 500)가 실제로 스케줄된 상태를 만든다.
    flushInteractions();
    const scheduledTimerId = setTimeoutReturns.at(-1);
    expect(scheduledTimerId).toBeDefined();

    clearTimeoutSpy.mockClear();
    unmount();

    // cleanup이 정확히 그 보류 타이머를 clearTimeout으로 정리해야 한다(mutation 시 호출 0 → red).
    expect(clearTimeoutSpy).toHaveBeenCalledWith(scheduledTimerId);
    clearTimeoutSpy.mockRestore();
  });

  it('언마운트 후 인터랙션이 뒤늦게 flush돼도 cancelled 플래그로 delayTimer를 스케줄하지 않는다 (cancelled load-bearing)', () => {
    // 언마운트가 인터랙션 flush보다 먼저 일어나는 레이스 — interactionHandle.cancel이 콜백을 못 막은 경우를 가정.
    //   afterInteractions가 그래도 실행되면 cancelled 플래그가 setTimeout(delayTimer) 스케줄을 막아야 한다.
    //   cancelled를 mutation하면(미설정) 언마운트 후 setTimeout이 새로 스케줄돼 호출 수가 늘어 → red.
    const { unmount } = renderHook(() => useDeferredFlag({ delayMs: 500 }));
    unmount(); // 인터랙션 flush 전에 언마운트.

    const setTimeoutCallsBefore = setTimeoutReturns.length;
    flushInteractions(); // 뒤늦게 보류 인터랙션 콜백 발화(afterInteractions 실행).

    // cancelled가 살아있으면 afterInteractions가 early-return → 새 delayTimer 스케줄 0(setTimeout 미증가).
    expect(setTimeoutReturns.length).toBe(setTimeoutCallsBefore);
  });
});
