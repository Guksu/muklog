// src/features/room/MyLogsProvider.tsx
// 내 로그 목록 state/refresh를 트리에 공유하는 context (plan §3.5). MembershipProvider를 대체한다.
//
// 생산자: useMyLogs({ userId }) — userId는 AuthProvider의 authenticated 상태에서 주입.
// 소비자: LogListScreen(목록 분기) + PlusHeaderButton(생성 후 refresh). (입장 후 refresh는 차기 log-invite.)
import React, { createContext, useContext } from 'react';

import { useMyLogs, type MyLogsState } from '../useMyLogs';

type MyLogsContextValue = {
  state: MyLogsState;
  refresh: () => Promise<void>;
};

const MyLogsContext = createContext<MyLogsContextValue | null>(null);

export const MyLogsProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) => {
  const value = useMyLogs({ userId });
  return <MyLogsContext.Provider value={value}>{children}</MyLogsContext.Provider>;
};

/** Provider 바깥 호출 시 명확히 throw. */
export const useMyLogsContext = (): MyLogsContextValue => {
  const ctx = useContext(MyLogsContext);
  if (ctx === null) {
    throw new Error('useMyLogsContext()는 <MyLogsProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
