// src/features/map/components/MapResearchButton/MapResearchButton.tsx
// 지도 "이 지역에서 검색" 재검색 pill(map-pin-loading) + 검색 중·실패 상태(map-nearby-feedback, UX 백로그 U10 ①②).
//
// ⚠ 킷 templates/muklog에 원본이 없다. mk-home MapScreen(:320-392)의 지도 오버레이는 범례·locate FAB·핀·
//   스팟 카드뿐이고 재검색 계열 요소가 0건이다 → 킷 시안 재현이 아니라 **킷 패턴 파생 신규 제안**이다.
//   파생 근거 2겹(map-pin-loading):
//     ① 스킨(지도 위에 떠 있는 레이어) = 킷 locate FAB(mk-home:363-372) → surface 배경 · radius.full ·
//        box-shadow 0 4px 14px rgba(0,0,0,.18) = shadow.fab · press scale(.92)(→ MotionPressable 등급 fab). 헤어라인 보더가 아니라
//        그림자를 쓰는 이유 = 떠 있는 레이어라서(브랜드 규칙의 예외가 아니라 선례 준수).
//     ② 내용(라벨+아이콘을 가진 컨트롤) = 킷 MkButton size="sm" variant="soft"(mk-ui:85-104) →
//        pad 9×14 · 700/14 · gap 8 · leftIcon size fs+3=17 · 아이콘·라벨 동색 accentStrong.
//   radius만 킷 sm 버튼의 control(14)이 아니라 full — 떠 있는 레이어 = 원형/pill(map-pin-loading 확정).
//
// 상태(state) — 세 상태 모두 스킨·패딩·높이 35·hitSlop이 같고 안의 내용만 바뀐다(map-nearby-feedback):
//   Idle      검색 아이콘 + "이 지역에서 검색".
//   Searching 아이콘 자리(17pt 상자)에 시스템 스피너 + "검색하는 중이에요". 탭 무시(disabled) · busy.
//             흐리게 하지 않는다 — 떠 있는 흰 면이 반투명해지면 지도가 비쳐 고장처럼 보이고, 진행은 스피너와 문구가 알린다.
//   Failed    아이콘 없이 "주변 음식점을 불러오지 못했어요 · 다시 시도" 한 줄. 문구 = 지도 안내 급(Medium · fgWeak,
//             MapStatusOverlay·MapPermissionBanner 문구와 같은 급), 행동 = 버튼 급(Bold · accentStrong).
//             가운뎃점은 킷 토스트 "로그에서 나갔어요 · 24시간 뒤 삭제돼요"(SPEC.md:84)의 한 줄 두 절 선례.
//             아이콘을 빼는 이유: SUIT 글자 폭 실측으로 아이콘 포함 ≈300pt라 320pt 기기 가용 폭 288pt를 넘고, 빼면 ≈275pt.
//   상태 전환 모션은 없다 — 지도 오버레이 전이는 UX 백로그 U52 ①로 일괄.
//
// 이 컴포넌트는 **자기 노출 조건을 모른다**. 훅 researchState가 Hidden이면 렌더하지 않고 나머지를 state로 매핑하는 것은
//   부모(MapTabScreen) 책임이고, 배치(상단 가로 중앙 절대배치)도 부모 소유다(레이아웃 책임 분리).
import React from 'react';
import { ActivityIndicator, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';

import { Icon, IconName, MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

/** pill이 보일 모양. 숨김(Hidden)은 값이 아니라 부모가 렌더하지 않는 것으로 표현한다. */
export const MapResearchButtonState = {
  Idle: 'idle',
  Searching: 'searching',
  Failed: 'failed',
} as const;
export type MapResearchButtonState =
  (typeof MapResearchButtonState)[keyof typeof MapResearchButtonState];

/** pill 카피 단일 출처 — 화면은 스크린리더 알림에 failedMessage를 재사용한다(map-nearby-feedback). */
export const MAP_RESEARCH_COPY = {
  // 지도 관용 표현이라 해요체 예외(map-pin-loading 리더 확정). 보이는 문구 = 접근성 이름.
  idle: '이 지역에서 검색',
  searching: '검색하는 중이에요',
  // "주변 음식점" = 범례 라벨(킷 mk-home:360)과 같은 말, "불러오지 못했어요" = 지도 오류 안내와 같은 꼴.
  failedMessage: '주변 음식점을 불러오지 못했어요',
  failedAction: '다시 시도',
} as const;

// 보이는 줄은 가운뎃점으로 잇고, 접근성 이름은 쉼표로 잇는다 — 스크린리더는 "·"를 기호 이름으로 읽는다.
const FAILED_SEPARATOR = ' · ';
const FAILED_ACCESSIBILITY_LABEL = `${MAP_RESEARCH_COPY.failedMessage}, ${MAP_RESEARCH_COPY.failedAction}`;

const ACCESSIBILITY_LABEL_BY_STATE: Record<MapResearchButtonState, string> = {
  [MapResearchButtonState.Idle]: MAP_RESEARCH_COPY.idle,
  [MapResearchButtonState.Searching]: MAP_RESEARCH_COPY.searching,
  [MapResearchButtonState.Failed]: FAILED_ACCESSIBILITY_LABEL,
};

// 킷 MkButton size="sm" 실값(mk-ui:85-86, 킷 leftIcon size = fontSize + 3 → mk-ui:104).
//   컨트롤 내부 수치라 4px 그리드 밖 — Button.tsx BUTTON_SIZE.sm과 같은 규율로 토큰화하지 않는다.
const RESEARCH_PILL = { paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, lineHeight: 17, iconSize: 17 } as const;

// RN ActivityIndicator size="small"의 고정 상자(iOS·Android 모두 20×20). 그대로 두면 pill이 35 → 38pt로 커지므로
//   아이콘과 같은 17pt 상자에 넣고 17/20으로 줄여 검색 아이콘과 같은 크기로 보이게 한다(높이 변화 0).
const SMALL_SPINNER_BOX = 20;

// 최소 터치 타깃 보정 — pill 실높이 35(9+17+9)라 세로 hitSlop 5로 45pt를 확보한다(킷 pad는 불변).
const RESEARCH_HIT_SLOP = { top: 5, bottom: 5, left: 8, right: 8 } as const;

// 킷은 눌림에 스케일만 지정했다(불투명도 변화 없음) — 감소 모션에서의 최소 피드백은
//   MotionPressable의 바닥값이 책임진다. FAB과 같은 값을 쓴다(같은 오버레이 층).
const MAP_OVERLAY_PRESSED_OPACITY = 1;

export type MapResearchButtonProps = {
  /** 탭 콜백(현재 뷰포트 1회 재조회는 호출부=MapTabScreen이 nearby.research로 배선). Searching에서는 호출되지 않는다. */
  onPress: () => void;
  /** 보일 모양. 기본 Idle(기존 소비처 호환). 훅 researchState → 이 값 매핑은 부모가 한다. */
  state?: MapResearchButtonState;
  /** 테스트 식별자. */
  testID?: string;
};

export const MapResearchButton = ({
  onPress,
  state = MapResearchButtonState.Idle,
  testID,
}: MapResearchButtonProps) => {
  const theme = useTheme();
  const isSearching = state === MapResearchButtonState.Searching;
  // 킷 locate FAB 스킨: 흰 카드면(surface) + radius full + shadow.fab(떠 있는 레이어라 헤어라인 아님).
  const container: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.full,
    ...theme.shadow.fab,
  };
  // 킷 MkButton sm: 700/14(button 토큰 = SUIT-Bold)에 킷 실수치 오버라이드. lineHeight = round(14×1.2).
  //   실패 문구(Medium)도 같은 14/17로 맞춰 세 상태의 pill 높이를 35로 고정한다.
  const label: TextStyle = { fontSize: RESEARCH_PILL.fontSize, lineHeight: RESEARCH_PILL.lineHeight };
  return (
    <MotionPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={ACCESSIBILITY_LABEL_BY_STATE[state]}
      // 검색 중만 busy·disabled. RN의 disabled는 웹 disabled와 달리 VoiceOver·TalkBack 포커스를 빼앗지 않는다
      //   (흐림 표시로 읽힐 뿐) — fe-skills loading-button이 disabled를 피한 이유(포커스 튕김)가 RN에는 없다.
      accessibilityState={isSearching ? { busy: true, disabled: true } : undefined}
      disabled={isSearching}
      hitSlop={RESEARCH_HIT_SLOP}
      onPress={onPress}
      pressSize="fab"
      pressedOpacity={MAP_OVERLAY_PRESSED_OPACITY}
      style={[styles.pill, container]}
    >
      {state === MapResearchButtonState.Failed ? (
        // 한 Text 흐름 — 글자 크기를 키워 폭이 모자라면 문구·행동이 함께 어절 단위로 줄바꿈된다(말줄임으로 "다시 시도"를 잃지 않게).
        <Text
          variant="bodySm"
          color="fgWeak"
          lineBreakStrategyIOS="hangul-word"
          style={[label, styles.failedLine]}
        >
          <Text variant="bodySm" color="fgWeak" style={label}>
            {MAP_RESEARCH_COPY.failedMessage}
          </Text>
          {FAILED_SEPARATOR}
          <Text variant="button" color="accentStrong" style={label}>
            {MAP_RESEARCH_COPY.failedAction}
          </Text>
        </Text>
      ) : (
        <>
          {isSearching ? (
            <View testID="map-research-spinner-slot" style={styles.spinnerSlot}>
              {/* 색 = 라벨과 같은 accentStrong(킷 soft variant의 currentColor 상속, Button loading 스피너 선례). */}
              <ActivityIndicator
                testID="map-research-spinner"
                size="small"
                color={theme.color.accentStrong}
                style={styles.spinner}
              />
            </View>
          ) : (
            // 킷 soft variant: 아이콘·라벨이 같은 accentStrong(currentColor 상속, mk-ui:96·104).
            <Icon name={IconName.Search} size={RESEARCH_PILL.iconSize} color="accentStrong" />
          )}
          <Text variant="button" color="accentStrong" style={label}>
            {isSearching ? MAP_RESEARCH_COPY.searching : MAP_RESEARCH_COPY.idle}
          </Text>
        </>
      )}
    </MotionPressable>
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
  // 검색 아이콘과 같은 상자 — 스피너가 들어와도 pill 높이·왼쪽 여백이 Idle과 같다.
  spinnerSlot: {
    width: RESEARCH_PILL.iconSize,
    height: RESEARCH_PILL.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { transform: [{ scale: RESEARCH_PILL.iconSize / SMALL_SPINNER_BOX }] },
  // 부모 폭이 모자랄 때만 줄어들어 줄바꿈되고, 줄바꿈되면 가운데 정렬(기본 글자 크기에선 한 줄이라 영향 없음).
  failedLine: { flexShrink: 1, textAlign: 'center' },
});
