// src/features/appVersion/AppVersionGate/AppVersionGate.tsx
// 버전 게이트 래퍼 (app-version-gate plan §4.1, T7) — App.tsx에서 AuthGate를 감싼다(AuthGate 상위·인증 무관).
//   checking/none → 자식 그대로(콜드스타트 비차단·fail-open). force → ForceUpdateScreen(자식 대체).
//   suggest → 자식 + UpdateSuggestModal 오버레이. 배선(동작): 스토어 Linking + Android 하드웨어백 no-op.
//   invite-share(U72): 통과 분기의 자식에게 조회한 iOS 스토어 링크를 AppStoreLinksProvider로 내린다(초대 메시지 재사용, 추가 조회 0).
import React, { useEffect, type ReactNode } from 'react';
import { BackHandler } from 'react-native';
import * as Linking from 'expo-linking';

import { AppStoreLinksProvider } from '../appStoreLinks';
import { AppVersionGateStatusProvider } from '../appVersionGateStatus';
import { ForceUpdateScreen } from '../ForceUpdateScreen';
import { UpdateSuggestModal } from '../UpdateSuggestModal';
import { useAppVersionGate } from '../useAppVersionGate';

export type AppVersionGateProps = {
  /** 게이트가 통과(checking/none/suggest)일 때 렌더할 앱 본체(AuthGate). */
  children: ReactNode;
};

export const AppVersionGate = ({ children }: AppVersionGateProps) => {
  const { state, dismissSuggest, storeUrlIos } = useAppVersionGate();

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

  // 자식(OTA 축 포함)에 현재 게이트 상태를 알린다(expo-updates-ota §3.7 — 렌더 분기·props·export 불변, 한 겹 추가).
  //   스토어 링크도 한 겹 더 내린다(invite-share). `?? null`: 훅 대역이 storeUrlIos를 주지 않는 기존 spec과 호환.
  return (
    <>
      <AppVersionGateStatusProvider status={state.status}>
        <AppStoreLinksProvider storeUrlIos={storeUrlIos ?? null}>{children}</AppStoreLinksProvider>
      </AppVersionGateStatusProvider>
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
