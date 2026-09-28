// src/features/map/components/MapLocateButton.tsx
// 지도 현재위치 FAB("내 위치로 이동") — 킷 mk-home.jsx:362-372 정합 (map-locate-button, T9).
//   사양(킷): right:16 bottom:16 / 46×46 / radius:999 / background var(--mk-card)=surface
//     / box-shadow 0 4px 14px rgba(0,0,0,.18)=shadow.fab(검정 근사) / locate 아이콘 24 / color #3B82F6=mapLocate.
//   탭 피드백: 킷 onMouseDown transform scale(.92) → 공용 MotionPressable 등급 fab(=0.92)으로 승계
//     (motion-press-final B1 — 누름 즉각 축소·복귀 스프링. 감소 모션 대비는 프리미티브 바닥값이 책임진다).
//   ⚠ 펄스 링(킷 mkLocate, mk-home.jsx:340-342)은 지도 위 me 마커의 1회 애니메이션 → WebView(mapHtml) 영역.
//     이 RN FAB은 onPress 콜백만 노출(데이터/권한/위치 로직 없음). 마커 펄스는 developer/mapHtml가 책임(ui-spec 기록).
//   배치(우하단 absolute·카드 회피 z/오프셋)는 부모(MapTabScreen이 MapWebView children 오버레이로) 책임 — 레이아웃 분리.
import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Icon, IconName, MotionPressable } from '@/components';
import { useTheme } from '@/theme';

// 킷은 눌림에 스케일만 지정했다(불투명도 변화 없음) — 감소 모션에서의 최소 피드백은
//   MotionPressable의 바닥값이 책임진다(ui-spec §2). 소비처에서 감소 모션 분기를 두지 않는다.
const MAP_OVERLAY_PRESSED_OPACITY = 1;

// 킷 FAB 한 변 46(mk-home:364). 부모가 FAB 위에 다른 오버레이(위치 권한 배너)를 쌓을 때
//   bottom = FAB bottom + 이 값 + 간격으로 합성하는 단일 출처다(map-location-denied UP5) — 리터럴 복제 금지.
export const MAP_LOCATE_BUTTON_SIZE = 46;

export type MapLocateButtonProps = {
  /** 탭 콜백(현재위치 재취득·재센터는 호출부=MapTabScreen이 배선). */
  onPress: () => void;
  /** 테스트 식별자. */
  testID?: string;
};

export const MapLocateButton = ({ onPress, testID }: MapLocateButtonProps) => {
  const theme = useTheme();
  // 킷: 흰 카드면(surface) 원형 + radius full. 그림자는 떠 있는 레이어라 shadow.fab(헤어라인 아님).
  const container: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.full,
    ...theme.shadow.fab,
  };
  return (
    <MotionPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="내 위치로 이동"
      onPress={onPress}
      pressSize="fab"
      pressedOpacity={MAP_OVERLAY_PRESSED_OPACITY}
      style={[styles.button, container]}
    >
      {/* 킷: I name="locate" size=24 color #3B82F6 → mapLocate 토큰(킷 verbatim, primary와 미세 차이). */}
      <Icon name={IconName.Locate} size={24} color="mapLocate" />
    </MotionPressable>
  );
};

const styles = StyleSheet.create({
  // 킷 46×46 원형(mk-home:364).
  button: {
    width: MAP_LOCATE_BUTTON_SIZE,
    height: MAP_LOCATE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
