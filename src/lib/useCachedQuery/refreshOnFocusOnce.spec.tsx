// src/lib/useCachedQuery/refreshOnFocusOnce.spec.tsx
// 신선도 트리거 단일화 회귀 가드 (query-cache plan §3.7 Q1=(A) / T5 AC5-2).
//
// 결정(리더 확정): 뮤테이션에 invalidateQueries를 배선하지 않는다. 저장 → goBack → 복귀 화면 포커스
//   재조회 1회가 신선도를 단독으로 소유한다. 여기에 invalidate를 더하면 저장 1회당 조회가 2회 나간다
//   (비용 가드레일 §8과 충돌). 이 spec이 그 "1회"를 못박는다 — 나중에 invalidate를 추가하면 여기서 깨진다.
//
// seam: useCachedQuery(재조회) × useRefreshOnFocus(트리거). 실제 NavigationContainer 없이 포커스만 수동 발화.
import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockFocus: { cb: null | (() => void) } = { cb: null };
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocus.cb = cb;
  },
}));

import { createQueryWrapper } from '@/lib/queryClient/testQueryWrapper';
import { useRefreshOnFocus } from '@/navigation/useRefreshOnFocus';

import { useCachedQuery } from './useCachedQuery';

const mapError = () => '불러오지 못했어요';

beforeEach(() => {
  mockFocus.cb = null;
});

describe('저장 → 복귀 시 조회 1회 (AC5-2)', () => {
  it('편집 저장 후 복귀(포커스 1회) = queryFn 1회 — 무효화 배선이 없어 중복 조회가 없다', async () => {
    const queryFn = jest.fn(async () => ({ muklog: { placeName: '어니언' } }));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => {
        const query = useCachedQuery({ queryKey: ['muklog', 'm1'], queryFn, mapError });
        useRefreshOnFocus({ refresh: query.refresh });
        return query;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(queryFn).toHaveBeenCalledTimes(1); // 마운트 조회

    // 첫 포커스 = 마운트 로드와 중복이므로 스킵된다.
    act(() => mockFocus.cb?.());
    expect(queryFn).toHaveBeenCalledTimes(1);

    // 에디터로 갔다가 저장 후 복귀 = 재포커스 1회 → 재조회도 정확히 1회.
    await act(async () => {
      mockFocus.cb?.();
    });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    // 그 뒤 아무 트리거(폴링·리스너)도 추가 조회를 만들지 않는다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('포커스 재조회가 도는 동안에도 화면은 ready를 유지한다(AC6-2 — 로딩으로 되돌아가지 않는다)', async () => {
    let resolveRefetch: ((value: { logs: string[] }) => void) | null = null;
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce({ logs: ['a'] })
      .mockImplementationOnce(
        () =>
          new Promise<{ logs: string[] }>((resolve) => {
            resolveRefetch = resolve;
          }),
      );
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => {
        const query = useCachedQuery({ queryKey: ['muklogs', 'r1'], queryFn, mapError });
        useRefreshOnFocus({ refresh: query.refresh });
        return query;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    act(() => mockFocus.cb?.()); // 첫 포커스(스킵)
    act(() => mockFocus.cb?.()); // 재포커스 → 재조회 시작

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(result.current.state).toEqual({ status: 'ready', logs: ['a'] });

    await act(async () => {
      resolveRefetch?.({ logs: ['b'] });
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', logs: ['b'] }));
  });
});
