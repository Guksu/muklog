// src/features/wishlist/useAddNearbyWish.spec.tsx
// 주변 음식점 위시 담기 오케스트레이션 훅 (plan §3.3·§4 / T3·T4·T5, 경계면 §7-1·2·3·4·7).
//   로그 0/1/2+ 분기 · 중복 pre-check · loading 가드 · 성공/중복/실패/로그없음 토스트를 supabase 무관하게 검증.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { type NearbyPlaceItem } from '@/features/map/types';

// --- 내 로그 목록 컨텍스트 ---
const mockMyLogsState: { value: unknown } = { value: { status: 'ready', logs: [] } };
jest.mock('@/features/room', () => ({
  useMyLogsContext: () => ({ state: mockMyLogsState.value, refresh: jest.fn() }),
}));

// --- 전역 토스트 ---
const mockShowToast = jest.fn();
jest.mock('@/components', () => ({ useToastController: () => ({ showToast: mockShowToast }) }));

// --- 위시 추가 훅 ---
const mockAddWishlist = jest.fn();
jest.mock('../useAddWishlist', () => ({
  useAddWishlist: () => ({ addWishlist: mockAddWishlist, loading: false, error: null }),
}));

// --- 중복 pre-check 헬퍼 ---
jest.mock('../wishlistExists', () => ({ wishlistExists: jest.fn() }));
import { wishlistExists } from '../wishlistExists';
const existsMock = wishlistExists as jest.Mock;

import { useAddNearbyWish, NEARBY_WISH_COPY } from './useAddNearbyWish';

const item: NearbyPlaceItem = {
  kakaoPlaceId: 'k-1',
  placeName: '성수 칼국수',
  categoryName: '음식점 > 한식 > 칼국수',
  categoryGroupCode: 'FD6',
  lat: 37.544,
  lng: 127.055,
  distance: 320,
};

const logs = [
  { roomId: 'r1', name: '우리 로그', memberCount: 2 },
  { roomId: 'r2', name: '성수 로그', memberCount: 1 },
];

const setLogs = (value: unknown[]) => {
  mockMyLogsState.value = { status: 'ready', logs: value };
};

beforeEach(() => {
  jest.clearAllMocks();
  existsMock.mockResolvedValue(false);
  mockAddWishlist.mockResolvedValue({ id: 'w-new' });
  mockMyLogsState.value = { status: 'ready', logs: [] };
});

describe('useAddNearbyWish', () => {
  it('로그 0개면 안내 토스트만 뜨고 mockAddWishlist 미호출 (T4 빈상태)', async () => {
    setLogs([]);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });

    expect(mockShowToast).toHaveBeenCalledWith({ message: NEARBY_WISH_COPY.noLog, tone: 'neutral' });
    expect(mockAddWishlist).not.toHaveBeenCalled();
    expect(result.current.choosing).toBeNull();
  });

  it('로그 1개면 시트 없이 그 roomId로 매핑 input을 담고 성공 토스트 (T3·T4)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() =>
      expect(mockAddWishlist).toHaveBeenCalledWith({
        input: {
          roomId: 'only',
          placeName: '성수 칼국수',
          category: 'noodle',
          area: null,
          roadAddress: null,
          lat: 37.544,
          lng: 127.055,
          kakaoPlaceId: 'k-1',
          note: null,
        },
      }),
    );
    expect(result.current.choosing).toBeNull();
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({ message: NEARBY_WISH_COPY.success, tone: 'positive' }),
    );
  });

  it('로그 2+개면 시트를 노출하고 선택 시 그 roomId로 담는다 (T4 멀티)', async () => {
    setLogs(logs);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });
    // 시트 노출: 담을 item + 로그 목록 보유, insert는 아직 미발생.
    expect(result.current.choosing).not.toBeNull();
    expect(result.current.choosing?.logs).toHaveLength(2);
    expect(mockAddWishlist).not.toHaveBeenCalled();

    await act(async () => {
      result.current.chooseLog({ roomId: 'r2' });
    });
    await waitFor(() =>
      expect(mockAddWishlist).toHaveBeenCalledWith({ input: expect.objectContaining({ roomId: 'r2' }) }),
    );
    // 선택 후 시트 닫힘.
    expect(result.current.choosing).toBeNull();
  });

  it('시트 취소(dismiss) 시 담기 미발생 (T4 취소)', async () => {
    setLogs(logs);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });
    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.choosing).toBeNull();
    expect(mockAddWishlist).not.toHaveBeenCalled();
  });

  it('중복(pre-check 1건)이면 mockAddWishlist 미호출 + 중복 토스트 (T2 중복)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    existsMock.mockResolvedValue(true);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({ message: NEARBY_WISH_COPY.duplicate, tone: 'neutral' }),
    );
    expect(mockAddWishlist).not.toHaveBeenCalled();
  });

  it('mockAddWishlist 실패 시 에러 토스트, 성공 토스트 미발생 (T5 실패)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    mockAddWishlist.mockRejectedValue(new Error('boom-network'));
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        message: '위시리스트 처리에 실패했어요. 다시 시도해 주세요.',
        tone: 'neutral',
      }),
    );
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'positive' }),
    );
  });

  it('pre-check 조회 실패 시 에러 토스트 + mockAddWishlist 미호출 (T5 실패)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    existsMock.mockRejectedValue(new Error('select-fail'));
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'neutral' }),
      ),
    );
    expect(mockAddWishlist).not.toHaveBeenCalled();
  });

  it('loading 가드 — 담는 중 연속 탭이 중복 insert를 만들지 않는다 (T5 가드)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    const { result } = renderHook(() => useAddNearbyWish());

    await act(async () => {
      result.current.requestAdd({ item });
      result.current.requestAdd({ item });
    });

    expect(mockAddWishlist).toHaveBeenCalledTimes(1);
  });

  // ── map-wish-pins: 담기 성공 후 onAdded 콜백(위시 핀 즉시 refresh 배선 지점) ──
  it('담기 성공 후 onAdded 콜백을 호출한다 (map-wish-pins add-후 refresh)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    const onAdded = jest.fn();
    const { result } = renderHook(() => useAddNearbyWish({ onAdded }));

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
  });

  it('중복이면 onAdded를 호출하지 않는다(insert 미발생 → refresh 불필요)', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    existsMock.mockResolvedValue(true);
    const onAdded = jest.fn();
    const { result } = renderHook(() => useAddNearbyWish({ onAdded }));

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({ message: NEARBY_WISH_COPY.duplicate, tone: 'neutral' }),
    );
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('실패면 onAdded를 호출하지 않는다', async () => {
    setLogs([{ roomId: 'only', name: '단독', memberCount: 1 }]);
    mockAddWishlist.mockRejectedValue(new Error('boom'));
    const onAdded = jest.fn();
    const { result } = renderHook(() => useAddNearbyWish({ onAdded }));

    await act(async () => {
      result.current.requestAdd({ item });
    });

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
    expect(onAdded).not.toHaveBeenCalled();
  });
});
