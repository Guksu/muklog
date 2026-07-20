// src/navigation/useRefreshOnFocus.spec.tsx
// useRefreshOnFocus — 화면 재포커스 시 refresh 재조회 공용 훅 명세.
//   기존 4개 화면(LogScreen·LogListScreen·MapTabScreen·MuklogDetailRoute)에 흩어진 동일 패턴
//   (refreshRef + hasFocusedRef 첫 포커스 스킵 + useCallback + useFocusEffect)을 한 곳으로 흡수.
//   useFocusEffect 는 콜백만 캡처해 수동 발화(실제 NavigationContainer 불필요).
import { renderHook } from '@testing-library/react-native';

const mockFocus: { cb: null | (() => void) } = { cb: null };
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocus.cb = cb;
  },
}));

import { useRefreshOnFocus } from './useRefreshOnFocus';

beforeEach(() => {
  mockFocus.cb = null;
});

describe('useRefreshOnFocus', () => {
  it('기본(skipFirst)에서 첫 포커스는 스킵하고 이후 포커스마다 refresh한다', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnFocus({ refresh }));

    // 첫 포커스 = 마운트 로드와 중복 → 스킵.
    mockFocus.cb?.();
    expect(refresh).not.toHaveBeenCalled();

    // 재포커스부터 호출.
    mockFocus.cb?.();
    expect(refresh).toHaveBeenCalledTimes(1);
    mockFocus.cb?.();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('skipFirst:false 면 첫 포커스부터 refresh한다(지도 탭 정책)', () => {
    const refresh = jest.fn();
    renderHook(() => useRefreshOnFocus({ refresh, skipFirst: false }));

    mockFocus.cb?.();
    expect(refresh).toHaveBeenCalledTimes(1);
    mockFocus.cb?.();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('최신 refresh 참조를 호출한다(리렌더로 refresh가 바뀌어도 최신본 발화)', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ refresh }) => useRefreshOnFocus({ refresh }), {
      initialProps: { refresh: first },
    });
    // 첫 포커스 스킵.
    mockFocus.cb?.();
    rerender({ refresh: second });
    mockFocus.cb?.();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
