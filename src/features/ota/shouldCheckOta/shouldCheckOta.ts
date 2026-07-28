// src/features/ota/shouldCheckOta/shouldCheckOta.ts
// OTA 체크 발화 판정(순수) (expo-updates-ota plan §3.4, T4).
//   소비자: useOtaUpdate — 하나라도 막히면 네트워크 호출 0(체크 자체를 하지 않는다).
//   3중 가드인 이유: Dev Client(Debug)에서 isEnabled가 false일 것으로 "예상"되지만 거기에만 의존하지 않는다(§3.8).

/**
 * OTA 체크를 발화해도 되는지 판정한다.
 * @param isDev __DEV__ (Metro 개발 번들 구동 중이면 true → 발화 금지)
 * @param hasModule expo-updates 네이티브 모듈 탑재 여부(loadUpdatesModule 성공)
 * @param isEnabled Updates.isEnabled (빌드에서 업데이트 활성 — Debug/dev-client 빌드는 false)
 * @returns 세 조건을 모두 만족할 때만 true
 */
export const shouldCheckOta = ({
  isDev,
  hasModule,
  isEnabled,
}: {
  isDev: boolean;
  hasModule: boolean;
  isEnabled: boolean;
}): boolean => !isDev && hasModule && isEnabled;
