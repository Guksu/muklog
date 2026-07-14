// src/features/wishlist/wishlistExists.spec.ts
// 중복 담기 pre-check 헬퍼 — 같은 (room_id, kakao_place_id) 위시 존재 여부 select (plan §3.3 / T2, 경계면 §7-3).
//   RLS select(내 방)로 허용되는 일반 조회 — DEFINER/Realtime 미사용(비용 가드). 1건 이상이면 true.
//   에러는 throw(호출측 useAddNearbyWish가 담기 중단 + 에러 토스트로 처리 — plan §5-1 실패 케이스).
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '@/lib/supabase';

import { wishlistExists } from './wishlistExists';

const fromMock = supabase.from as jest.Mock;
const limitMock = jest.fn();
const eqPlaceMock = jest.fn();
const eqRoomMock = jest.fn();
const selectMock = jest.fn();

const wireSelect = ({ data, error }: { data: unknown; error: unknown }) => {
  limitMock.mockResolvedValueOnce({ data, error });
  eqPlaceMock.mockReturnValue({ limit: (...a: unknown[]) => limitMock(...a) });
  eqRoomMock.mockReturnValue({ eq: (...a: unknown[]) => eqPlaceMock(...a) });
  selectMock.mockReturnValue({ eq: (...a: unknown[]) => eqRoomMock(...a) });
  fromMock.mockReturnValue({ select: (...a: unknown[]) => selectMock(...a) });
};

beforeEach(() => {
  fromMock.mockReset();
  limitMock.mockReset();
  eqPlaceMock.mockReset();
  eqRoomMock.mockReset();
  selectMock.mockReset();
});

describe('wishlistExists', () => {
  it('room_id·kakao_place_id로 필터한 select를 던지고 1건이면 true (T2 중복)', async () => {
    wireSelect({ data: [{ id: 'w1' }], error: null });

    const exists = await wishlistExists({ roomId: 'r1', kakaoPlaceId: 'k-1' });

    expect(exists).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('wishlist_items');
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(eqRoomMock).toHaveBeenCalledWith('room_id', 'r1');
    expect(eqPlaceMock).toHaveBeenCalledWith('kakao_place_id', 'k-1');
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it('0건이면 false (T2 신규)', async () => {
    wireSelect({ data: [], error: null });
    const exists = await wishlistExists({ roomId: 'r1', kakaoPlaceId: 'k-1' });
    expect(exists).toBe(false);
  });

  it('data가 null이어도 false로 안전 처리한다', async () => {
    wireSelect({ data: null, error: null });
    const exists = await wishlistExists({ roomId: 'r1', kakaoPlaceId: 'k-1' });
    expect(exists).toBe(false);
  });

  it('select 에러면 throw한다 (담기 중단 경로)', async () => {
    wireSelect({ data: null, error: new Error('boom') });
    await expect(wishlistExists({ roomId: 'r1', kakaoPlaceId: 'k-1' })).rejects.toThrow('boom');
  });
});
