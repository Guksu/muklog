// src/features/profile/useProfile.ts
// 프로필 조회 훅 (plan §3.3, T5 / P1).
//
// 생산자: profiles RLS select(id=auth.uid()) → 본인 행만(nickname, avatar_url snake_case).
// 소비자: ProfileScreen(현재 닉네임/아바타 표시) + 저장/업로드 성공 후 refresh().
//
// 정책: 화면 진입 1회 조회 + 성공 후 refresh()만. 폴링/주기 조회 금지(비용 가드레일 §8).
//   useMembership과 동일 패턴(마운트 guard, [userId] 의존 effect, useCallback 미사용).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

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
export const useProfile = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수(컨벤션상 useCallback 지양). effect는 [userId]에만 의존하므로
  // 매 렌더 새 참조여도 재조회 루프가 생기지 않는다.
  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '프로필 조회에 실패했어요. 다시 시도해 주세요.' });
      return;
    }

    // snake(avatar_url) → camel(avatarUrl). 0행이면 둘 다 null.
    const row = (data as { nickname?: string | null; avatar_url?: string | null } | null) ?? null;
    setState({
      status: 'ready',
      profile: { nickname: row?.nickname ?? null, avatarUrl: row?.avatar_url ?? null },
    });
  };

  useEffect(
    function loadProfileOnUser() {
      mountedRef.current = true;
      void fetchProfile();
      return function cleanupProfile() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId 변경 시에만 재조회(폴링 방지).
    [userId],
  );

  return { state, refresh: fetchProfile };
};
