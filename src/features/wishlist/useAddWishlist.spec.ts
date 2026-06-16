// src/features/wishlist/useAddWishlist.spec.ts
// 위시 추가 훅 — auth.getUser()로 added_by 확보 + insert(row).select('id').single() 계약,
//   snake payload(added_by=내 uid), {id} 반환, 인증/장소명 가드, 에러 토큰→한국어+throw.
//   (plan §4.3 / TC-2, 경계면 B2·B8) supabase 모킹으로 클라 계약만 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

import { supabase } from '@/lib/supabase';
import { useAddWishlist } from './useAddWishlist';

const getUserMock = supabase.auth.getUser as jest.Mock;
const fromMock = supabase.from as jest.Mock;
const singleMock = jest.fn();
const selectMock = jest.fn();
const insertMock = jest.fn();

const wireInsert = ({ data, error }: { data: unknown; error: unknown }) => {
  singleMock.mockResolvedValueOnce({ data, error });
  selectMock.mockReturnValue({ single: (...a: unknown[]) => singleMock(...a) });
  insertMock.mockReturnValue({ select: (...a: unknown[]) => selectMock(...a) });
  fromMock.mockReturnValue({ insert: (...a: unknown[]) => insertMock(...a) });
};

const validInput = {
  roomId: 'r1',
  placeName: '성수동 베이커리',
  category: 'cafe',
  area: '성수동',
  roadAddress: '서울 성동구 연무장길 1',
  lat: 37.544,
  lng: 127.055,
  kakaoPlaceId: '12345',
  note: null,
};

beforeEach(() => {
  getUserMock.mockReset();
  singleMock.mockReset();
  selectMock.mockReset();
  insertMock.mockReset();
  fromMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: 'u9' } }, error: null });
});

describe('useAddWishlist', () => {
  it('insert에 added_by=내 uid를 채운 snake payload로 호출하고 {id}를 반환한다 (TC-2, B2)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useAddWishlist());

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.addWishlist({ input: validInput });
    });

    expect(fromMock).toHaveBeenCalledWith('wishlist_items');
    expect(insertMock).toHaveBeenCalledWith({
      room_id: 'r1',
      place_name: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      road_address: '서울 성동구 연무장길 1',
      lat: 37.544,
      lng: 127.055,
      kakao_place_id: '12345',
      note: null,
      added_by: 'u9',
    });
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(created).toEqual({ id: 'new-id' });
  });

  it('좌표/kakao 없는 검색결과 → null로 저장(insert 성공) (TC-2 경계, B8)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useAddWishlist());
    await act(async () => {
      await result.current.addWishlist({
        input: {
          roomId: 'r1',
          placeName: '이름만 있는 곳',
          category: null,
          area: null,
          roadAddress: null,
          lat: null,
          lng: null,
          kakaoPlaceId: null,
        },
      });
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: null,
        lng: null,
        kakao_place_id: null,
        road_address: null,
        note: null,
        added_by: 'u9',
      }),
    );
  });

  it('인증 사용자 없으면 insert 미호출 + 에러 세팅 후 throw (권한 §7)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    wireInsert({ data: { id: 'x' }, error: null });
    const { result } = renderHook(() => useAddWishlist());

    await act(async () => {
      await expect(result.current.addWishlist({ input: validInput })).rejects.toThrow();
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('로그인이 필요해요. 다시 로그인해 주세요.');
  });

  it('insert 에러(네트워크/RLS) → 한국어 메시지 세팅 + throw(입력 컨텍스트 보존) (TC-2 실패)', async () => {
    wireInsert({ data: null, error: new Error('boom-network') });
    const { result } = renderHook(() => useAddWishlist());

    await act(async () => {
      await expect(result.current.addWishlist({ input: validInput })).rejects.toThrow();
    });
    expect(result.current.error).toBe('위시리스트 처리에 실패했어요. 다시 시도해 주세요.');
  });

  it('트리거 PLACE_NAME_REQUIRED 에러를 한국어로 매핑하고 throw한다', async () => {
    wireInsert({ data: null, error: new Error('PLACE_NAME_REQUIRED') });
    const { result } = renderHook(() => useAddWishlist());

    await act(async () => {
      await expect(result.current.addWishlist({ input: validInput })).rejects.toThrow();
    });
    expect(result.current.error).toBe('장소 이름이 필요해요.');
  });

  it('응답에 id가 없으면 throw한다(나쁜 응답 방어)', async () => {
    wireInsert({ data: {}, error: null });
    const { result } = renderHook(() => useAddWishlist());
    await act(async () => {
      await expect(result.current.addWishlist({ input: validInput })).rejects.toThrow();
    });
  });
});
