// src/components/modalInsets/modalInsets.ts
// 상태바를 덮는 Modal(statusBarTranslucent) 안에서 쓰는 상단 여백 계산 (dim-full-cover T2, plan §3.4).
//   statusBarTranslucent를 켜면 RN이 Modal 컨테이너의 위쪽 inset을 0으로 바꿔치기해 내용이 상태바 아래로
//   확장된다(ReactModalHostView.kt:334 → WindowUtil.kt:16-31). 딤은 그래서 화면 끝까지 덮지만,
//   같은 이유로 카드·패널처럼 상태바를 피해야 하는 콘텐츠는 스스로 여백을 확보해야 한다.

/**
 * 상태바를 덮는 Modal 안에서 콘텐츠가 상태바를 피하는 데 필요한 상단 여백(px)을 구한다.
 *   Android 비 edge-to-edge에서는 SafeAreaProvider가 보고하는 insets.top이 0이라
 *   (react-native-safe-area-context SafeAreaUtils.kt:70 — 루트 뷰가 이미 상태바만큼 내려가 있어 차가 0)
 *   그 값만 쓰면 카드가 상태바 높이만큼 위로 밀린다. 두 값 중 큰 쪽을 쓰면 세 환경이 한 식으로 덮인다:
 *     · Android 비 edge-to-edge — insetTop 0 / currentHeight 상태바 높이 → 상태바 높이
 *     · Android edge-to-edge(API 35+) — 둘 다 상태바 높이 → 이중 적용 없이 상태바 높이
 *     · iOS — currentHeight가 undefined → 노치 inset 그대로
 * @param insetTop useSafeAreaInsets().top
 * @param statusBarHeight StatusBar.currentHeight (Android 전용, iOS는 undefined)
 * @returns 상단 여백(px)
 */
export const resolveModalTopInset = ({
  insetTop,
  statusBarHeight,
}: {
  insetTop: number;
  statusBarHeight: number | null | undefined;
}): number => Math.max(insetTop, statusBarHeight ?? 0);
