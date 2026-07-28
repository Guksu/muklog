// src/features/appVersion/appVersionGateStatus/appVersionGateStatus.tsx
// 스토어 게이트 상태 컨텍스트 (expo-updates-ota plan §3.7, T6) — additive.
//   생산자: AppVersionGate(useAppVersionGate의 state.status를 자식에게 제공).
//   소비자: OtaUpdateGate(§4.2 우선순위 — suggest면 OTA 안내를 억제한다).
//   기본값 'none': Provider 없이 렌더되는 기존 화면·테스트는 영향 0(안전 기본값).
import React, { createContext, useContext, type ReactNode } from 'react';

import type { VersionGateState } from '../useAppVersionGate';

/** 스토어 게이트 현재 상태(판별 유니온의 status만 추출). */
export type AppVersionGateStatus = VersionGateState['status'];

const AppVersionGateStatusContext = createContext<AppVersionGateStatus>('none');

export type AppVersionGateStatusProviderProps = {
  /** 현재 스토어 게이트 상태. */
  status: AppVersionGateStatus;
  children: ReactNode;
};

export const AppVersionGateStatusProvider = ({
  status,
  children,
}: AppVersionGateStatusProviderProps) => (
  <AppVersionGateStatusContext.Provider value={status}>
    {children}
  </AppVersionGateStatusContext.Provider>
);

/**
 * 스토어 게이트 현재 상태를 읽는다(두 업데이트 축 조정용).
 * @returns 'checking' | 'force' | 'suggest' | 'none'. Provider 밖이면 'none'.
 */
export const useAppVersionGateStatus = (): AppVersionGateStatus =>
  useContext(AppVersionGateStatusContext);
