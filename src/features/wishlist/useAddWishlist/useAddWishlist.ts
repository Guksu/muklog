// src/features/wishlist/useAddWishlist.ts
// 위시 추가 훅 (plan §4.3 / TC-2, 경계면 B2·B8).
//
// 생산자: 클라 직접 insert(RLS 하). added_by = auth.getUser()의 uid를 채워
//   from('wishlist_items').insert(row).select('id').single(). RLS `with check (added_by=auth.uid())`가
//   누락/위조를 거부(B2). 트리거(enforce_wishlist_fields)가 place_name 공백을 최종 방어.
// 소비자: WishlistView '추가' → PlaceSearchView pick → addWishlist({ input }) → 성공 시 refresh + 토스트(plan §5).
//
// 에러: mapWishlistError로 한국어 메시지(error 상태) + 원본 throw(추가 플로우가 입력 컨텍스트 보존).
//   중복 추가는 loading 중 버튼 비활성으로 방지(배선 단계 책임).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapWishlistError, WishlistErrorToken } from '../errors';
import { toWishlistRow } from '../toWishlistRow';
import { type AddWishlistInput } from '../types';

export type AddWishlistResult = { id: string };

/**
 * 위시 추가 액션과 로딩/에러 상태를 제공하는 훅.
 * addWishlist({ input })가 added_by(내 uid)를 채워 insert하고 { id }를 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(추가 플로우가 입력 보존).
 */
export const useAddWishlist = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addWishlist = async ({
    input,
  }: {
    input: AddWishlistInput;
  }): Promise<AddWishlistResult> => {
    setLoading(true);
    setError(null);
    try {
      // added_by는 RLS with check가 auth.uid()와 일치하길 강제 → 실제 인증 uid를 채운다(B2).
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error(WishlistErrorToken.NotAuthenticated);

      const { data, error: insertError } = await supabase
        .from('wishlist_items')
        .insert(toWishlistRow({ input, userId }))
        .select('id')
        .single();
      if (insertError) throw insertError;

      const obj = (data ?? {}) as { id?: string };
      if (!obj.id) throw new Error('ADD_WISHLIST_BAD_RESPONSE');

      return { id: obj.id };
    } catch (err) {
      setError(mapWishlistError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { addWishlist, loading, error };
};
