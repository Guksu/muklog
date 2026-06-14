// src/features/muklog/usePlaceSearch.spec.ts
// 장소검색 훅 — 디바운스·min 글자수·캐싱·레이스 가드·에러 상태 (plan §3.5·§6 / T6, 비용 §8).
//   searchPlaces 모킹 + fake timers로 호출 횟수/상태 전이를 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('./searchPlaces', () => ({ searchPlaces: jest.fn() }));
import { searchPlaces } from './searchPlaces';
import {
  PLACE_SEARCH_DEBOUNCE_MS,
  PLACE_SEARCH_MIN_LENGTH,
  usePlaceSearch,
} from './usePlaceSearch';

const searchMock = searchPlaces as jest.Mock;

const makeItem = (id: string) => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  addressName: '서울 마포구 연남동',
  roadAddressName: '',
  lat: 37.5,
  lng: 127.0,
  phone: '',
});

beforeEach(() => {
  jest.useFakeTimers();
  searchMock.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('usePlaceSearch', () => {
  it('디바운스: 연속 입력은 마지막 1회만 호출 (a)', async () => {
    searchMock.mockResolvedValue([makeItem('1')]);
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.setQuery('스시'));
    act(() => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS - 100);
    });
    act(() => result.current.setQuery('스시집'));
    expect(searchMock).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith({ query: '스시집' });
  });

  it('min 글자수 미만은 미호출 + idle/빈 결과 (b)', async () => {
    const { result } = renderHook(() => usePlaceSearch());
    act(() => result.current.setQuery('스'.repeat(PLACE_SEARCH_MIN_LENGTH - 1)));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    expect(searchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.results).toEqual([]);
  });

  it('동일 쿼리 재검색은 캐시 히트로 invoke 미호출 (c)', async () => {
    searchMock.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve([makeItem(query)]),
    );
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.setQuery('스시'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    act(() => result.current.setQuery('김밥'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);

    // 다시 '스시' → 캐시 히트(추가 호출 없음), 결과·status 즉시 반영.
    act(() => result.current.setQuery('스시'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
    expect(result.current.results).toEqual([makeItem('스시')]);
  });

  it('레이스: 늦게 온 직전(stale) 응답은 폐기하고 최신 결과만 반영 (d)', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    searchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    searchMock.mockResolvedValueOnce([makeItem('second')]);

    const { result } = renderHook(() => usePlaceSearch());
    act(() => result.current.setQuery('스시'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    }); // 첫 요청 발사(pending)

    act(() => result.current.setQuery('스시집'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    }); // 둘째 요청 → [second] 반영

    await act(async () => {
      resolveFirst([makeItem('first')]); // 늦게 온 첫 응답
    });
    expect(result.current.results).toEqual([makeItem('second')]);
  });

  it('검색 실패 → status=error + 한국어 메시지 (폴백 안내)', async () => {
    searchMock.mockRejectedValueOnce(new Error('KAKAO_KEY_MISSING'));
    const { result } = renderHook(() => usePlaceSearch());
    act(() => result.current.setQuery('스시'));
    await act(async () => {
      jest.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('장소 검색을 사용할 수 없어요. 직접 입력해 주세요.');
    expect(result.current.results).toEqual([]);
  });
});
