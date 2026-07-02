// src/features/appVersion/AppVersionGate/AppVersionGate.tsx
// 버전 게이트 래퍼 (app-version-gate plan §4.1, T7) — App.tsx에서 AuthGate를 감싼다(AuthGate 상위·인증 무관).
//   checking/none → 자식 그대로(콜드스타트 비차단·fail-open). force → ForceUpdateScreen(자식 대체).
//   suggest → 자식 + UpdateSuggestModal 오버레이. 배선(동작): 스토어 Linking + Android 하드웨어백 no-op.
import React, { useEffect, type ReactNode } from 'react';
import { BackHandler } from 'react-native';
import * as Linking from 'expo-linking';

import { ForceUpdateScreen } from '../ForceUpdateScreen';
import { UpdateSuggestModal } from '../UpdateSuggestModal';
import { useAppVersionGate } from '../useAppVersionGate';

export type AppVersionGateProps = {
  /** 게이트가 통과(checking/none/suggest)일 때 렌더할 앱 본체(AuthGate). */
  children: ReactNode;
};

export const AppVersionGate = ({ children }: AppVersionGateProps) => {
  const { state, dismissSuggest } = useAppVersionGate();

  // 스토어 이동 — URL 없으면 no-op(버튼은 애초에 숨김이나 이중 방어). expo-linking(네이티브 모듈 아님).
  const openStore = ({ storeUrl }: { storeUrl: string | null }) => {
    if (!storeUrl) return;
    void Linking.openURL(storeUrl);
  };

  // 강제 차단 중 Android 하드웨어백 no-op — 뒤로가기로 우회 불가(iOS는 이벤트 미발화라 무해).
  useEffect(
    function blockHardwareBackOnForce() {
      if (state.status !== 'force') return;
      const onHardwareBack = () => true; // true=이벤트 소비(기본 뒤로가기 차단).
      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return function removeBackHandler() {
        subscription.remove();
      };
    },
    [state.status],
  );

  if (state.status === 'force') {
    return (
      <ForceUpdateScreen
        storeUrl={state.storeUrl}
        onUpdatePress={() => openStore({ storeUrl: state.storeUrl })}
      />
    );
  }

  return (
    <>
      {children}
      {state.status === 'suggest' ? (
        <UpdateSuggestModal
          visible
          storeUrl={state.storeUrl}
          onUpdatePress={() => openStore({ storeUrl: state.storeUrl })}
          onDismiss={dismissSuggest}
        />
      ) : null}
    </>
  );
};
