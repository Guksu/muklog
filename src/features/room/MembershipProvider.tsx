// src/features/room/MembershipProvider.tsx
// 멤버십 state/refresh를 트리에 공유하는 context (plan §3.6).
//
// 생산자: useMembership({ userId }) — userId는 AuthProvider의 authenticated 상태에서 주입.
// 소비자: MembershipGate(분기) + OnboardingScreen(성공 후 refresh()).
import React, { createContext, useContext } from 'react';

import { useMembership, type MembershipState } from './useMembership';

type MembershipContextValue = {
  state: MembershipState;
  refresh: () => Promise<void>;
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

export const MembershipProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) => {
  const value = useMembership({ userId });
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
};

/** Provider 바깥 호출 시 명확히 throw. */
export const useMembershipContext = (): MembershipContextValue => {
  const ctx = useContext(MembershipContext);
  if (ctx === null) {
    throw new Error('useMembershipContext()는 <MembershipProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
