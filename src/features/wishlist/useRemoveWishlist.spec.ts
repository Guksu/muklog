// src/features/wishlist/useRemoveWishlist.spec.ts
// 위시 삭제 훅 — from('wishlist_items').delete().eq('id', id) 계약, 0행 무해(에러 아님), 에러 매핑/throw.
//   (plan §4.3 / TC-4, 경계면 B6) supabase 모킹으로 호출/에러 처리만 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { supabase } from '@/lib/supabase';
import { useRemoveWishlist } from './useRemoveWishlist';

const fromMock = supabase.from as jest.Mock;
const deleteEqMock = jest.fn();
const deleteMock = jest.fn((..._a: unknown[]) => ({ eq: (...a: unknown[]) => deleteEqMock(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockReturnValue({ delete: (...a: unknown[]) => deleteMock(...a) });
  deleteEqMock.mockResolvedValue({ error: null });
});

describe('useRemoveWishlist', () => {
  it('delete().eq("id", id) 계약으로 호출한다 (TC-4)', async () => {
    const { result } = renderHook(() => useRemoveWishlist());
    await act(async () => {
      await result.current.removeWishlist({ id: 'w1' });
    });
    expect(fromMock).toHaveBeenCalledWith('wishlist_items');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'w1');
    expect(result.current.error).toBeNull();
  });

  it('이미 삭제된 행(0행)도 에러 없이 무해하게 처리한다 (B6 동시성)', async () => {
    deleteEqMock.mockResolvedValue({ error: null, count: 0 });
    const { result } = renderHook(() => useRemoveWishlist());
    await act(async () => {
      await result.current.removeWishlist({ id: 'gone' });
    });
    expect(result.current.error).toBeNull();
  });

  it('delete 에러 → 한국어 메시지 세팅 + throw(낙관적 제거 롤백 트리거) (TC-4 실패)', async () => {
    deleteEqMock.mockResolvedValue({ error: new Error('boom') });
    const { result } = renderHook(() => useRemoveWishlist());
    await act(async () => {
      await expect(result.current.removeWishlist({ id: 'w1' })).rejects.toThrow();
    });
    expect(result.current.error).toBe('위시리스트 처리에 실패했어요. 다시 시도해 주세요.');
  });
});
