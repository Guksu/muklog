// src/features/wishlist/useRemoveWishlist.ts
// 위시 삭제 훅 (plan §4.3 / TC-4, 경계면 B6).
//
// 생산자: 클라 직접 delete(RLS wishlist_delete_member 하 — 룸 멤버 누구나, 공유 리스트).
//   from('wishlist_items').delete().eq('id', id). RLS가 내 방 행만 삭제 허용.
// 소비자: ① WishlistView 카드 닫기(✕) → 성공 후 목록에서 제거(낙관/refresh).
//   ② "다녀왔어요" 먹로그 생성 성공 콜백 → removeWishlist({ id: fromWishlistId }).
//
// 0행 무해(B6): 파트너가 먼저 지운 행은 delete 시 0행 영향이지만 에러가 아니다 → throw하지 않는다
//   (이미 없는 행 삭제는 멱등·무해). 실제 error(네트워크/RLS 위반)만 mapWishlistError 매핑 + throw.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapWishlistError } from '../errors';

/**
 * 위시 삭제 액션과 로딩/에러 상태를 제공하는 훅.
 * removeWishlist({ id })가 .delete().eq('id', id)를 호출한다(0행은 무해, 에러 아님).
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(낙관적 제거 롤백 트리거).
 */
export const useRemoveWishlist = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeWishlist = async ({ id }: { id: string }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('wishlist_items').delete().eq('id', id);
      // count는 체크하지 않는다 — 0행(이미 삭제됨)은 무해(멱등). 실제 error만 승격.
      if (deleteError) throw deleteError;
    } catch (err) {
      setError(mapWishlistError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { removeWishlist, loading, error };
};
