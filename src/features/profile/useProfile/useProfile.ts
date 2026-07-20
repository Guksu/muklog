// src/features/profile/useProfile.ts
// 프로필 조회 훅 (plan §3.3, T5 / P1).
//
// 생산자: profiles RLS select(id=auth.uid()) → 본인 행만(nickname, avatar_url snake_case).
// 소비자: ProfileScreen(현재 닉네임/아바타 표시) + 저장/업로드 성공 후 refresh().
//
// 정책: 화면 진입 1회 조회 + 성공 후 refresh()만. 폴링/주기 조회 금지(비용 가드레일 §8).
//   로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유(진입 1회 + 명시적 refresh).
import { supabase } from '@/lib/supabase';
import { useOneShotQuery } from '@/lib/useOneShotQuery';

export type Profile = { nickname: string | null; avatarUrl: string | null };

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; message: string };

/**
 * 현재 사용자의 프로필(nickname/avatarUrl)을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id (= auth.uid())
 * @returns state(프로필 상태)와 refresh(재조회 함수)
 */
export const useProfile = ({ userId }: { userId: string }): {
  state: ProfileState;
  refresh: () => Promise<void>;
} => {
  // 쿼리+매핑만 정의 — 로딩/에러/마운트 가드/refresh 는 useOneShotQuery 가 소유.
  const fetchProfile = async (): Promise<{ profile: Profile }> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    // snake(avatar_url) → camel(avatarUrl). 0행이면 둘 다 null.
    const row = (data as { nickname?: string | null; avatar_url?: string | null } | null) ?? null;
    return { profile: { nickname: row?.nickname ?? null, avatarUrl: row?.avatar_url ?? null } };
  };

  return useOneShotQuery<{ profile: Profile }>({
    deps: [userId],
    fetch: fetchProfile,
    mapError: () => '프로필 조회에 실패했어요. 다시 시도해 주세요.',
  });
};
