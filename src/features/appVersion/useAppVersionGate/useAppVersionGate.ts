// src/features/appVersion/useAppVersionGate/useAppVersionGate.ts
// 버전 게이트 판정 훅 (app-version-gate plan §3.6).
//   콜드스타트 1회: fetchAppConfig → getCurrentAppVersion → resolveVersionGate → force/suggest(미dismiss)/none.
//   생산자: fetchAppConfig(app_config)·getCurrentAppVersion(expo-constants)·updateSuggestDismissal(AsyncStorage).
//   소비자: AppVersionGate(상태별 렌더). fail-open: fetch null/current null/ok/unknown/dismiss됨 → none(막지 않음).
//   폴링/Realtime 0 — 마운트 1회 조회만(비용 가드레일 §8). 재판정=앱 재시작.
//   invite-share(U72): 같은 조회의 store_url_ios를 판정·플랫폼과 무관하게 storeUrlIos로 내놓는다 —
//     AppVersionGate가 AppStoreLinksProvider로 내려 초대 메시지 링크에 재사용한다(추가 조회 0).
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getCurrentAppVersion } from '../currentAppVersion';
import { fetchAppConfig } from '../fetchAppConfig';
import { resolveVersionGate, VersionGateDecision } from '../resolveVersionGate';
import { loadDismissedVersion, saveDismissedVersion } from '../updateSuggestDismissal';

/** 게이트 상태(판별 유니온). checking·none은 자식 정상 렌더(fail-open), force만 자식 대체. */
export type VersionGateState =
  | { status: 'checking' } // 조회 중 — 자식 정상 렌더(콜드스타트 비차단)
  | { status: 'force'; storeUrl: string | null } // 차단
  | { status: 'suggest'; latestVersion: string; storeUrl: string | null } // 권유(미dismiss)
  | { status: 'none' }; // ok/unknown/dismiss됨/조회실패 → 자식만(fail-open)

/**
 * 콜드스타트 1회 원격 버전 확인으로 게이트 상태와 dismiss 핸들러를 제공하는 훅.
 * @returns state(게이트 상태)·dismissSuggest(권유 "나중에" — 버전당 1회 기록 + none)·
 *   storeUrlIos(조회 성공 시 app_config.store_url_ios — 판정·플랫폼 무관, 조회 전·실패면 null)
 */
export const useAppVersionGate = (): {
  state: VersionGateState;
  dismissSuggest: () => void;
  storeUrlIos: string | null;
} => {
  const [state, setState] = useState<VersionGateState>({ status: 'checking' });
  const [storeUrlIos, setStoreUrlIos] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // 현재 suggest 대상 latest — dismissSuggest가 저장할 버전(state가 none으로 바뀐 뒤에도 참조 가능).
  const suggestLatestRef = useRef<string | null>(null);

  // 일반 함수(컨벤션상 useCallback 지양). effect는 마운트 1회만 실행(폴링 방지).
  const evaluateGate = async () => {
    const config = await fetchAppConfig();
    if (!mountedRef.current) return;
    // 조회 실패/빈 → fail-open(막지 않음).
    if (!config) {
      setState({ status: 'none' });
      return;
    }
    // 판정과 무관하게 iOS 링크를 남긴다(평상시 none에서도 초대 메시지가 재사용 — 조회 수 불변).
    setStoreUrlIos(config.storeUrlIos);

    const current = getCurrentAppVersion();
    const decision = resolveVersionGate({
      current,
      minSupported: config.minSupportedVersion,
      latest: config.latestVersion,
    });
    const storeUrl = Platform.OS === 'ios' ? config.storeUrlIos : config.storeUrlAndroid;

    if (decision === VersionGateDecision.Force) {
      setState({ status: 'force', storeUrl });
      return;
    }

    if (decision === VersionGateDecision.Suggest && config.latestVersion) {
      // 버전당 1회 — 이미 이 latest를 "나중에" 했으면 미노출(none).
      const dismissed = await loadDismissedVersion();
      if (!mountedRef.current) return;
      if (dismissed === config.latestVersion) {
        setState({ status: 'none' });
        return;
      }
      suggestLatestRef.current = config.latestVersion;
      setState({ status: 'suggest', latestVersion: config.latestVersion, storeUrl });
      return;
    }

    // ok / unknown → 미차단(fail-open).
    setState({ status: 'none' });
  };

  useEffect(function evaluateGateOnMount() {
    mountedRef.current = true;
    void evaluateGate();
    return function cleanupGate() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 콜드스타트 1회 판정(폴링 방지).
  }, []);

  const dismissSuggest = () => {
    const version = suggestLatestRef.current;
    if (version) void saveDismissedVersion({ version }); // best-effort 로컬 기록(버전당 1회).
    setState({ status: 'none' });
  };

  return { state, dismissSuggest, storeUrlIos };
};
