// src/features/ota/updatesModule/updatesModule.ts
// expo-updates 안전 로더 (expo-updates-ota plan §3.3, T3).
//   생산자: expo-updates 네이티브 런타임. 소비자: useOtaUpdate(체크·다운로드·적용).
//   네이티브 안전(S1·usePushReceive 준용): requireOptionalNativeModule로 조용히 probe →
//   미탑재(현 Dev Client·테스트 환경·Expo Go)면 SDK require 자체를 하지 않고 null. throw 0, 로그 0.
//   ⚠️ expo-updates의 진입점은 requireNativeModule('ExpoUpdates')를 top-level에서 실행해 미탑재 시 throw한다
//      (node_modules/expo-updates/build/ExpoUpdates.js:5) → top-level import 절대 금지, 반드시 probe 후 require.
// requireOptionalNativeModule: 네이티브 모듈이 없으면 null 반환(로그·throw 없음) — 조용한 가용성 probe용.
import { requireOptionalNativeModule } from 'expo-modules-core';

/** 이 기능이 실제로 쓰는 expo-updates 표면만 좁게 선언(테스트 모킹 대상 = 이 4개). */
export type UpdatesModule = {
  /** 이 빌드에서 업데이트가 활성인지(Debug/dev-client 빌드는 false). */
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

// expo-updates가 자신의 네이티브 모듈에 붙이는 실제 이름(추측 아님 — 위 ExpoUpdates.js:5 근거).
const UPDATES_NATIVE_MODULE_NAME = 'ExpoUpdates';

/**
 * expo-updates 네이티브 모듈이 현재 빌드에 탑재됐는지 조용히 확인한다.
 *   미탑재면 requireOptionalNativeModule이 throw/로그 없이 null → false(SDK require 자체를 안 함).
 */
const isUpdatesNativeModuleAvailable = (): boolean => {
  try {
    return requireOptionalNativeModule(UPDATES_NATIVE_MODULE_NAME) != null;
  } catch {
    return false;
  }
};

/**
 * 현재 빌드에 expo-updates 네이티브 모듈이 탑재됐을 때만 JS 모듈을 로드한다.
 * @returns 좁게 선언한 UpdatesModule, 또는 미탑재·로드 실패 시 null(throw 0·로그 0)
 */
export const loadUpdatesModule = (): UpdatesModule | null => {
  if (!isUpdatesNativeModuleAvailable()) return null;

  try {
    // 가용성 확인 후 동기 require — jest 모킹/spy 참조가 그대로 적용된다(S1 패턴).
    const Updates = require('expo-updates') as typeof import('expo-updates');
    return {
      isEnabled: Updates.isEnabled,
      checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
      fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
      reloadAsync: () => Updates.reloadAsync(),
    };
  } catch {
    // 미탑재 판정을 통과했는데도 로드가 실패하는 경우(부분 링크 등) — 조용히 비활성 취급.
    return null;
  }
};
