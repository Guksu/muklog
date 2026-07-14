// src/features/wishlist/wishlistExists.ts
// 중복 담기 pre-check 헬퍼 — 같은 (room_id, kakao_place_id) 위시가 이미 있는지 조회 (plan §3.3 / T2, 경계면 §7-3).
//   생산자: 클라 직접 select(RLS 하, RPC 아님) — RLS(`room_id IN 내 방`)가 방 격리. DEFINER/Realtime 미사용(비용 가드 §8).
//   소비자: useAddNearbyWish가 insert 직전 호출 — true면 insert 스킵 + "이미 담은 곳이에요" 토스트.
//   best-effort: 커플 동시 담기 레이스로 중복이 슬쩍 들어와도 무해(위시 중복 허용, DB 제약 무변경 — plan §6).
//   에러는 throw(호출측이 담기 중단 + 에러 토스트로 처리 — plan §5-1 실패 케이스).
import { supabase } from '@/lib/supabase';

/**
 * 한 로그(roomId)에 같은 카카오 장소(kakaoPlaceId) 위시가 이미 있는지 조회한다.
 * @param roomId 대상 로그 id
 * @param kakaoPlaceId 카카오 장소 id
 * @returns 1건 이상이면 true(중복), 없으면 false. 조회 실패 시 throw.
 */
export const wishlistExists = async ({
  roomId,
  kakaoPlaceId,
}: {
  roomId: string;
  kakaoPlaceId: string;
}): Promise<boolean> => {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('room_id', roomId)
    .eq('kakao_place_id', kakaoPlaceId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
};
