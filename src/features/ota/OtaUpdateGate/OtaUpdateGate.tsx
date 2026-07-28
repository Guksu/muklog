// src/features/ota/OtaUpdateGate/OtaUpdateGate.tsx
// OTA 게이트 래퍼 (expo-updates-ota plan §4.2·§4.4, T8) — App.tsx에서 AppVersionGate 자식으로 AuthGate를 감싼다.
//   children은 항상 그대로 렌더한다(앱 진행 차단 0). ready일 때만 안내 다이얼로그를 오버레이.
//   두 축 우선순위(§4.2): force → 이 게이트가 애초에 마운트되지 않음(AppVersionGate가 children을 대체).
//                        suggest → 다운로드는 진행하되 안내만 억제(모달 2개 겹침 방지, 다음 콜드스타트에 자동 적용).
import React, { type ReactNode } from 'react';

// 배럴(@/features/appVersion) 대신 슬라이스 직접 참조 — 배럴은 supabase 클라이언트까지 끌어와 트리를 무겁게 한다.
import { useAppVersionGateStatus } from '@/features/appVersion/appVersionGateStatus';

import { OtaReadyDialog } from '../OtaReadyDialog';
import { OtaStatus, useOtaUpdate } from '../useOtaUpdate';

export type OtaUpdateGateProps = {
  /** 항상 그대로 렌더하는 앱 본체(AuthGate). */
  children: ReactNode;
};

export const OtaUpdateGate = ({ children }: OtaUpdateGateProps) => {
  const { state, applyUpdate, dismiss } = useOtaUpdate();
  const storeGateStatus = useAppVersionGateStatus();

  const showReadyDialog = state.status === OtaStatus.Ready && storeGateStatus !== 'suggest';

  return (
    <>
      {children}
      {showReadyDialog ? (
        <OtaReadyDialog visible onApply={applyUpdate} onDismiss={dismiss} />
      ) : null}
    </>
  );
};
