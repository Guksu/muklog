// src/features/room/useMembership.ts
// 멤버십 게이트용 조회 훅 (plan §3.6, C3).
//
// 생산자: room_members RLS select(user_id=auth.uid()) → 본인 행만.
// 소비자: MembershipProvider → MembershipGate 분기 / Onboarding 성공 후 refresh().
//
// 정책: 앱 진입 1회 조회 + 성공 후 refresh()만. 폴링/주기 조회 금지(비용 가드레일 §8).
//   refresh()는 의도적으로 'loading'으로 되돌리지 않는다 → 게이트의 NavigationContainer 언마운트 방지
//   (Onboarding 성공 시 navigation.reset과 함께 백그라운드 상태 갱신).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type MembershipState =
  | { status: 'loading' }
  | { status: 'no-room' }
  | { status: 'in-room'; roomId: string }
  | { status: 'error'; message: string };

/**
 * 현재 사용자의 방 멤버십을 1회 조회하고 상태/재조회 함수를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id
 * @returns state(멤버십 상태)와 refresh(재조회 함수)
 */
export const useMembership = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<MembershipState>({ status: 'loading' });
  const mountedRef = useRef(true);

  // 일반 함수로 정의(컨벤션상 useCallback 지양). 아래 effect는 [userId]에만 의존하므로
  // 매 렌더 새 함수 참조가 만들어져도 재조회 루프가 발생하지 않는다.
  const fetchMembership = async () => {
    // 1인 1방 불변식 → 최대 1행. RLS가 user_id=auth.uid()로 한정하지만 eq도 명시.
    const { data, error } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (error) {
      setState({ status: 'error', message: '멤버십 조회에 실패했어요. 다시 시도해 주세요.' });
      return;
    }

    const roomId = (data as { room_id?: string } | null)?.room_id;
    setState(roomId ? { status: 'in-room', roomId } : { status: 'no-room' });
  };

  useEffect(
    function loadMembershipOnUser() {
      mountedRef.current = true;
      // 진입 1회(또는 userId 변경 시) 조회. fetchMembership은 최신 렌더 클로저를 사용한다.
      void fetchMembership();
      return function cleanupMembership() {
        mountedRef.current = false;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId 변경 시에만 재조회(폴링 방지). fetchMembership 의존 시 매 렌더 재조회됨.
    [userId],
  );

  return { state, refresh: fetchMembership };
};
