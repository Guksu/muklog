// src/features/profile/ProfileProvider.tsx
// 본인 프로필(state/refresh)을 트리에 공유하는 context (#2 — 닉네임/아바타 변경 전파).
//   기존엔 화면마다 독립 useProfile 인스턴스라 ProfileScreen에서 닉/아바타를 바꿔도
//   HomeHeader·LogList 등 다른 화면은 자기 인스턴스를 재조회하지 않아 옛 값이 남았다.
//   → AuthGate에서 단일 useProfile을 마운트해 context로 공유. ProfileScreen 저장/업로드 성공 후
//     이 공유 refresh()를 호출하면 모든 소비자가 한 번에 갱신된다(MyLogsProvider 패턴 동일).
//
// 생산자: useProfile({ userId }) — userId는 AuthProvider authenticated 상태에서 주입.
// 소비자: HomeHeader·LogListScreen(useSelfDisplay)·LogScreen·ProfileScreen·NotifSettings·MuklogDetailRoute.
import React, { createContext, useContext } from 'react';

import { useProfile, type ProfileState } from './useProfile';

type ProfileContextValue = {
  state: ProfileState;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) => {
  const value = useProfile({ userId });
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

/** Provider 바깥 호출 시 명확히 throw. */
export const useProfileContext = (): ProfileContextValue => {
  const ctx = useContext(ProfileContext);
  if (ctx === null) {
    throw new Error('useProfileContext()는 <ProfileProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
