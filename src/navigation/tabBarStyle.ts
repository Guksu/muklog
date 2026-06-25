// src/navigation/tabBarStyle.ts
// 하단 탭바(GNB) 스타일 빌더 — #1 Android safe-area 버그픽스.
//
// 근본원인: 기존 HomeTabs의 tabBarStyle은 하단 패딩을 react-navigation의 자동 home-indicator
//   safe-area inset에 맡겼다. 그러나 Android(edge-to-edge 미설정)에서 react-native-safe-area-context는
//   insets.bottom을 0으로 보고하므로 react-navigation도 하단 패딩을 0으로 둔다 → 탭바가 화면 끝에 붙어
//   시스템 내비게이션바(제스처/3버튼)에 가려졌다.
// 수정: 다른 화면들과 동일하게 useSafeAreaInsets().bottom을 컴포넌트에서 직접 읽어 탭바 하단 패딩·높이에
//   명시적으로 더한다(코드베이스 공통 패턴 — Screen edges 제외 + insets.bottom 수동 적용과 일관).
//   inset이 0인 기기는 콘텐츠 높이만 → iOS 홈인디케이터·인셋 있는 기기는 그만큼 위로 자란다(회귀 0).
import { type ViewStyle } from 'react-native';

import { type Theme } from '@/theme/tokens';

// 탭바 콘텐츠(아이콘 25 + 라벨 11 + paddingTop)의 인셋 제외 높이.
//   react-navigation 기본(~49)에 paddingTop(spacing[8])·라벨 여유를 더한 킷 정합 값.
export const TAB_BAR_CONTENT_HEIGHT = 56;

type BuildTabBarStyleArgs = {
  insets: { bottom: number };
  theme: Theme;
};

/**
 * 하단 탭바 스타일을 빌드한다. bottom safe-area inset을 하단 패딩·전체 높이에 반영해
 * Android 시스템 내비바(제스처·3버튼)·iOS 홈인디케이터에 가려지지 않게 한다.
 */
export const buildTabBarStyle = ({ insets, theme }: BuildTabBarStyleArgs): ViewStyle => ({
  // 킷 mk-ui:183 — 바 배경 surface(다크 정합), 상단 구분선 line-alt(hairlineAlt), paddingTop 9(≈spacing[8]).
  backgroundColor: theme.color.surface,
  borderTopColor: theme.color.hairlineAlt,
  paddingTop: theme.spacing[8],
  // 시스템 내비바 inset만큼 하단 패딩 — 콘텐츠가 내비바 위로 클리어.
  paddingBottom: insets.bottom,
  // 바 전체 높이를 inset만큼 키워 GNB가 가려지지 않게(콘텐츠 위치는 paddingBottom으로 보존).
  height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
});
