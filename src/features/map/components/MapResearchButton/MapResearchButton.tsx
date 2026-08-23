// src/features/map/components/MapResearchButton/MapResearchButton.tsx
// 지도 "이 지역에서 검색" 재검색 pill(map-pin-loading, plan §5.1).
//
// ⚠ 킷 templates/muklog에 원본이 없다. mk-home MapScreen(:320-392)의 지도 오버레이는 범례·locate FAB·핀·
//   스팟 카드뿐이고 재검색 계열 요소가 0건이다 → 킷 시안 재현이 아니라 **킷 패턴 파생 신규 제안**이다.
//   파생 근거 2겹(ui-spec §2):
//     ① 스킨(지도 위에 떠 있는 레이어) = 킷 locate FAB(mk-home:363-372) → surface 배경 · radius.full ·
//        box-shadow 0 4px 14px rgba(0,0,0,.18) = shadow.fab · press scale(.92). 헤어라인 보더가 아니라
//        그림자를 쓰는 이유 = 떠 있는 레이어라서(브랜드 규칙의 예외가 아니라 선례 준수).
//     ② 내용(라벨+아이콘을 가진 컨트롤) = 킷 MkButton size="sm" variant="soft"(mk-ui:85-104) →
//        pad 9×14 · 700/14 · gap 8 · leftIcon size fs+3=17 · 아이콘·라벨 동색 accentStrong.
//   radius만 킷 sm 버튼의 control(14)이 아니라 full — plan §5.2가 확정한 pill 형태(떠 있는 레이어 = 원형/pill).
//
// 이 컴포넌트는 **자기 노출 조건을 모른다**. `researchAvailable`(useNearbyPlaces)로 조건 렌더하는 것은
//   부모(MapTabScreen) 책임이고, 배치(상단 가로 중앙 절대배치)도 부모 소유다(ui-spec §3, 레이아웃 책임 분리).
import React from 'react';
import { Pressable, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { Icon, IconName, Text } from '@/components';
import { useTheme } from '@/theme';

// 카피 단일 출처(리더 Q3 확정). 라벨 = 접근성 라벨(지도 관용 표현, 해요체 예외 — plan §5.1).
const RESEARCH_LABEL = '이 지역에서 검색';

// 킷 MkButton size="sm" 실값(mk-ui:85-86, 킷 leftIcon size = fontSize + 3 → mk-ui:104).
//   컨트롤 내부 수치라 4px 그리드 밖 — Button.tsx BUTTON_SIZE.sm과 같은 규율로 토큰화하지 않는다.
const RESEARCH_PILL = { paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, lineHeight: 17, iconSize: 17 } as const;

// 최소 터치 타깃 보정 — pill 실높이 35(9+17+9)라 세로 hitSlop 5로 45pt를 확보한다(킷 pad는 불변).
const RESEARCH_HIT_SLOP = { top: 5, bottom: 5, left: 8, right: 8 } as const;

export type MapResearchButtonProps = {
  /** 탭 콜백(현재 뷰포트 1회 재조회는 호출부=MapTabScreen이 nearby.research로 배선). */
  onPress: () => void;
  /** 테스트 식별자. */
  testID?: string;
};

export const MapResearchButton = ({ onPress, testID }: MapResearchButtonProps) => {
  const theme = useTheme();
  // 킷 locate FAB 스킨: 흰 카드면(surface) + radius full + shadow.fab(떠 있는 레이어라 헤어라인 아님).
  const container: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.full,
    ...theme.shadow.fab,
  };
  // 킷 MkButton sm: 700/14(button 토큰 = SUIT-Bold)에 킷 실수치 오버라이드. lineHeight = round(14×1.2).
  const label: TextStyle = { fontSize: RESEARCH_PILL.fontSize, lineHeight: RESEARCH_PILL.lineHeight };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={RESEARCH_LABEL}
      hitSlop={RESEARCH_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, container, pressed ? styles.pressed : null]}
    >
      {/* 킷 soft variant: 아이콘·라벨이 같은 accentStrong(currentColor 상속, mk-ui:96·104). */}
      <Icon name={IconName.Search} size={RESEARCH_PILL.iconSize} color="accentStrong" />
      <Text variant="button" color="accentStrong" style={label}>
        {RESEARCH_LABEL}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // 킷 MkButton sm pad 9×14 + gap 8(mk-ui:85,88).
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: RESEARCH_PILL.paddingVertical,
    paddingHorizontal: RESEARCH_PILL.paddingHorizontal,
  },
  // 킷 locate FAB onMouseDown scale(.92)(mk-home:368) — 지도 위 떠 있는 레이어 2종(FAB·pill)의 press 피드백 통일.
  //   킷 MkButton은 .97이나, 같은 오버레이 층에서 두 피드백이 갈리면 어긋나 보인다(리더 확정: .92).
  pressed: { transform: [{ scale: 0.92 }] },
});
