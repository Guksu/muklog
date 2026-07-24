// src/features/appVersion/useAppUpdateStatus/useAppUpdateStatus.ts
// 설정 화면 업데이트 상태 판정 훅 (app-update-actions plan §3.2).
//   마운트 1회: fetchAppConfig → getCurrentAppVersion → resolveVersionGate → available/latest/unknown 매핑.
//   생산자 재사용: fetchAppConfig(app_config)·getCurrentAppVersion(expo-constants)·resolveVersionGate(순수 판정).
//   ⚠️ suggest-dismissal 미참조 — 설정 액션은 "나중에"와 무관하게 항상 노출(useAppVersionGate와의 계약 차이, §3.2).
//   폴링/Realtime 0 — 마운트 1회 조회만(비용 가드레일 §8). 재판정=앱 재시작.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getCurrentAppVersion } from '../currentAppVersion';
import { fetchAppConfig } from '../fetchAppConfig';
import { resolveVersionGate, VersionGateDecision } from '../resolveVersionGate';

/** 설정 업데이트 상태(판별 유니온). available만 액션 노출, 나머지는 버전 텍스트만(§3.3 표). */
export type AppUpdateStatus =
  | { kind: 'checking' } // 조회 중 — 버전만 표시
  | { kind: 'available'; storeUrl: string | null } // 최신 아님(force/suggest) → 업데이트 액션
  | { kind: 'latest' } // 최신(ok)
  | { kind: 'unknown' }; // 조회실패/형불량/current null → 버전만(fail-open)

/**
 * 마운트 1회 app_config 조회 + 현재 버전 비교로 설정 업데이트 상태를 낸다.
 *   force/suggest → available(+플랫폼 storeUrl), ok → latest, unknown/fetch null/current null → unknown.
 * @returns status(설정 업데이트 상태)
 */
export const useAppUpdateStatus = (): { status: AppUpdateStatus } => {
  const [status, setStatus] = useState<AppUpdateStatus>({ kind: 'checking' });
  const mountedRef = useRef(true);

  // 일반 함수(컨벤션상 useCallback 지양). effect는 마운트 1회만 실행(폴링 방지).
  const evaluateUpdateStatus = async () => {
    const config = await fetchAppConfig();
    if (!mountedRef.current) return;
    // 조회 실패/빈 → fail-open(상태 주장 안 함, 버전만).
    if (!config) {
      setStatus({ kind: 'unknown' });
      return;
    }

    const current = getCurrentAppVersion();
    const decision = resolveVersionGate({
      current,
      minSupported: config.minSupportedVersion,
      latest: config.latestVersion,
    });
    const storeUrl = Platform.OS === 'ios' ? config.storeUrlIos : config.storeUrlAndroid;

    // 설정에선 force/suggest 모두 "업데이트 가능"으로 접는다(게이트 차단은 별개 경로).
    if (decision === VersionGateDecision.Force || decision === VersionGateDecision.Suggest) {
      setStatus({ kind: 'available', storeUrl });
      return;
    }
    if (decision === VersionGateDecision.Ok) {
      setStatus({ kind: 'latest' });
      return;
    }

    // unknown(결측/형불량) → fail-open.
    setStatus({ kind: 'unknown' });
  };

  useEffect(function evaluateUpdateStatusOnMount() {
    mountedRef.current = true;
    void evaluateUpdateStatus();
    return function cleanupUpdateStatus() {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 판정(폴링 방지).
  }, []);

  return { status };
};
