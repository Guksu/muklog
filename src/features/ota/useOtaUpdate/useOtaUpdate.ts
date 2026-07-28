// src/features/ota/useOtaUpdate/useOtaUpdate.ts
// OTA 상태 훅 (expo-updates-ota plan §3.5, T5).
//   콜드스타트 1회: loadUpdatesModule → shouldCheckOta → check → fetch → ready. 사용자가 탭할 때만 reloadAsync.
//   생산자: updatesModule(expo-updates 안전 로더)·shouldCheckOta(순수 판정). 소비자: OtaUpdateGate(렌더 분기).
//   fail-open: 체크·다운로드 실패는 조용히 흡수(UI 없음) — 스토어 게이트와 동일 철학.
//   폴링·타이머·AppState 리스너 0(비용 가드레일 §8). 재확인 = 다음 콜드스타트.
import { useEffect, useRef, useState } from 'react';

import { shouldCheckOta } from '../shouldCheckOta';
import { loadUpdatesModule, type UpdatesModule } from '../updatesModule';

/** OTA 진행 상태. ready만 사용자 접점(안내 다이얼로그)이고 나머지는 UI 없음. */
export const OtaStatus = {
  Idle: 'idle', // 체크 전 / 미지원 / 업데이트 없음 / 무시됨 — UI 없음
  Checking: 'checking', // checkForUpdateAsync 진행 중 — UI 없음
  Downloading: 'downloading', // fetchUpdateAsync 진행 중 — UI 없음(백그라운드)
  Ready: 'ready', // 다운로드 완료 — 안내 노출 대상
  Reloading: 'reloading', // "지금 적용" 탭 → reloadAsync 진행 중
} as const;
export type OtaStatus = (typeof OtaStatus)[keyof typeof OtaStatus];

export type OtaUpdateState = { status: OtaStatus };

/**
 * 콜드스타트 1회 OTA 확인·다운로드 상태와 적용/무시 핸들러를 제공하는 훅.
 * @returns state(진행 상태), applyUpdate(지금 적용 — reloadAsync), dismiss(나중에 — idle)
 */
export const useOtaUpdate = (): {
  state: OtaUpdateState;
  applyUpdate: () => void;
  dismiss: () => void;
} => {
  const [state, setState] = useState<OtaUpdateState>({ status: OtaStatus.Idle });
  const mountedRef = useRef(true);
  // 단일 마운트 내 중복 체크 방지(usePushReceive 가드 준용) — 리렌더로 재체크되지 않는다.
  const initializedRef = useRef(false);
  // 적용 시점에 다시 로드하지 않도록 체크에 성공한 모듈을 보관(로더 재호출 0).
  const updatesRef = useRef<UpdatesModule | null>(null);

  // 일반 함수(컨벤션상 useCallback 지양). effect는 마운트 1회만 실행(폴링 방지).
  const runOtaCheck = async () => {
    const updates = loadUpdatesModule();
    const canCheck = shouldCheckOta({
      isDev: __DEV__,
      hasModule: updates !== null,
      isEnabled: updates?.isEnabled ?? false,
    });
    // 가드 하나라도 막히면 네트워크 호출 0 — 상태는 idle 그대로.
    if (!canCheck || updates === null) return;
    updatesRef.current = updates;

    setState({ status: OtaStatus.Checking });
    try {
      const check = await updates.checkForUpdateAsync();
      if (!mountedRef.current) return;
      if (!check.isAvailable) {
        setState({ status: OtaStatus.Idle });
        return;
      }

      setState({ status: OtaStatus.Downloading });
      const fetched = await updates.fetchUpdateAsync();
      if (!mountedRef.current) return;
      setState({ status: fetched.isNew ? OtaStatus.Ready : OtaStatus.Idle });
    } catch {
      // 오프라인·서버 오류·타임아웃 → 조용히 흡수(사용자에게 아무 표시 없음). 다음 콜드스타트에 재시도.
      if (mountedRef.current) setState({ status: OtaStatus.Idle });
    }
  };

  useEffect(function checkOtaOnMount() {
    mountedRef.current = true;
    if (!initializedRef.current) {
      initializedRef.current = true;
      void runOtaCheck();
    }
    return function cleanupOtaCheck() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 콜드스타트 1회 확인(폴링 방지).
  }, []);

  const applyUpdate = () => {
    const updates = updatesRef.current;
    if (!updates) return;
    setState({ status: OtaStatus.Reloading });
    void updates.reloadAsync().catch(function recoverFromReloadFailure(error) {
      // 적용 실패해도 앱은 계속 동작하고, 다운로드분은 다음 콜드스타트에 자동 적용된다.
      console.warn('[useOtaUpdate] 업데이트 적용 실패(다음 실행 때 자동 적용):', error);
      if (mountedRef.current) setState({ status: OtaStatus.Idle });
    });
  };

  const dismiss = () => setState({ status: OtaStatus.Idle });

  return { state, applyUpdate, dismiss };
};
