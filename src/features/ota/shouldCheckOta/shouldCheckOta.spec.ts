// src/features/ota/shouldCheckOta/shouldCheckOta.spec.ts
// OTA 체크 발화 판정 단위 테스트 (expo-updates-ota plan §3.4, T4 · §5-1).
//   3중 가드(개발 아님 · 네이티브 탑재 · 빌드 업데이트 활성)를 2×2×2 = 8조합 전수 단언.
import { shouldCheckOta } from './shouldCheckOta';

describe('shouldCheckOta (T4)', () => {
  it('개발 아님 + 모듈 있음 + 활성 → true (유일한 발화 조합)', () => {
    expect(shouldCheckOta({ isDev: false, hasModule: true, isEnabled: true })).toBe(true);
  });

  it.each([
    ['개발 중', { isDev: true, hasModule: true, isEnabled: true }],
    ['모듈 미탑재', { isDev: false, hasModule: false, isEnabled: true }],
    ['빌드 비활성', { isDev: false, hasModule: true, isEnabled: false }],
    ['개발 중 + 모듈 미탑재', { isDev: true, hasModule: false, isEnabled: true }],
    ['개발 중 + 비활성', { isDev: true, hasModule: true, isEnabled: false }],
    ['모듈 미탑재 + 비활성', { isDev: false, hasModule: false, isEnabled: false }],
    ['전부 불충족', { isDev: true, hasModule: false, isEnabled: false }],
  ])('%s → false', (_label, params) => {
    expect(shouldCheckOta(params)).toBe(false);
  });
});
