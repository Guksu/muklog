// src/features/auth/useClearCachesOnSignOut.ts
// 로그아웃 시 조회 캐시·서명 URL 캐시를 비우는 훅 (query-cache plan §3.8).
//
// 왜 상태 전이를 보는가: AuthProvider가 unauthenticated로 가는 경로는 signOut() 하나가 아니다 —
//   익명 세션 잔재 강등(E8), 부트스트랩의 세션 없음/SIGNED_OUT 처리도 같은 결과를 만든다.
//   signOut() 한 곳에 비움을 심으면 나머지 경로에서 이전 계정의 캐시가 남는다 → 전이를 관찰한다.
// 왜 AuthGate에서 마운트하는가: AuthGate는 QueryClientProvider 안쪽(useQueryClient 가능)이면서 useAuth를
//   이미 쓰는 유일한 지점이다. 인증 상태와 데이터 캐시라는 두 세계를 잇는 자리는 게이트다.
// 마운트 시점의 초기 unauthenticated에서는 비우지 않는다 — 비울 것이 없고, 불필요한 호출을 만들지 않는다.
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { resetSignedUrlCache } from '@/features/muklog/signedUrlMap';

import { type AuthState } from '../AuthProvider';

/**
 * 인증 상태가 authenticated → unauthenticated로 바뀌면 두 캐시를 비운다(계정 전환 잔재 0, plan E1).
 * @param status 현재 인증 상태의 status(AuthGate가 useAuth()에서 받아 주입)
 */
export const useClearCachesOnSignOut = ({ status }: { status: AuthState['status'] }): void => {
  const queryClient = useQueryClient();
  // 직전 status. 초기값을 현재 status로 두어 "마운트 = 전이 아님"이 성립한다.
  const previousStatusRef = useRef<AuthState['status']>(status);

  useEffect(
    function clearCachesOnSignOutTransition() {
      const previous = previousStatusRef.current;
      previousStatusRef.current = status;
      if (previous !== 'authenticated' || status !== 'unauthenticated') return;
      queryClient.clear();
      resetSignedUrlCache();
    },
    [status, queryClient],
  );
};
