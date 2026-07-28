// src/test/setDevMode.ts
// 테스트 전용 — RN 전역 `__DEV__`를 케이스별로 제어한다(expo-updates-ota T5·T8).
//   `__DEV__`는 RN 런타임이 주입하는 전역이라 TS의 `globalThis` 타입에는 없다 → 2단 캐스팅이 불가피하다.
//   프로덕션 코드가 아니라 테스트에서만 쓰므로 전역 타입 선언(declare global)으로 앱 타입 표면을 넓히지 않는다.

/**
 * 개발 번들 여부(`__DEV__`)를 설정한다. 테스트 종료 시 원복은 호출자(afterEach) 책임.
 * @param isDev true면 Metro 개발 번들 구동 중으로 취급
 */
export const setDevMode = ({ isDev }: { isDev: boolean }): void => {
  (global as unknown as { __DEV__: boolean }).__DEV__ = isDev;
};
