// src/features/appVersion/currentAppVersion/currentAppVersion.ts
// 현재 앱 버전 취득 (app-version-gate plan §3.7).
//   expo-constants(JS-only, 재빌드 불필요 — expo-application 미도입, §2 OUT). app.json `version`("x.y.z")을 읽는다.
//   top-level import 허용(네이티브 모듈 아님 → lazy-require 불요). 미확보 시 null → 게이트 unknown(fail-open).
import Constants from 'expo-constants';

/**
 * 현재 앱 버전(app.json version)을 취득한다.
 * @returns "x.y.z" 문자열 또는 null(Constants/expoConfig/version 미확보 → fail-open)
 */
export const getCurrentAppVersion = (): string | null => Constants.expoConfig?.version ?? null;
