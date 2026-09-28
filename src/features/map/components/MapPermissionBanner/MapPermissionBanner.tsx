// src/features/map/components/MapPermissionBanner/MapPermissionBanner.tsx
// 위치 권한 거부 안내 배너 — 문구 + "설정 열기" + 닫기(map-location-denied, UX 백로그 U7 · U13 ③).
//
// ⚠ 킷 templates/muklog에 원본이 없다. mk-home MapScreen(:320-392)의 지도 오버레이는 범례·locate FAB·핀·
//   스팟 카드뿐이고 권한 안내 요소가 0건이다 → 킷 시안 재현이 아니라 **킷 패턴 파생 신규 요소**다.
//   파생 근거 3겹(ui-spec §2):
//     ① 스킨 = 같은 지도 상태 안내인 MapStatusOverlay(:42-53) — surface 배경 · 헤어라인 보더 · radius.card ·
//        shadow.md(지도 위에 떠 있는 레이어라 그림자, 헤어라인과 함께). 문구 bodySm · fgWeak도 같은 급.
//     ② 행동 버튼 = MapStatusOverlay "다시 시도"와 같은 Button soft sm(킷 MkButton, mk-ui:83-108).
//     ③ [행동 버튼][닫기 X]를 한 줄에 두는 구성 = 킷 위시 행(mk-extra:209-215: gap 8 · 버튼 옆 close 15).
//   한 줄 배치(문구 flex:1 · 버튼 · 닫기)는 360·375·430pt 폭에서 문구 2줄 → 카드 높이 68pt(≤88, plan §4.3)라서다.
//   계산은 ui-spec §3.
//
// 이 컴포넌트는 **자기 노출 조건·배치를 모른다**. 거부 여부·닫힘 상태로 조건 렌더하는 것, 하단 절대 배치
//   (FAB 위 bottom 72 · 좌우 16)는 부모(MapTabScreen) 책임이다(MapResearchButton·MapLocateButton과 같은 레이아웃 분리).
//   모션 없음 — 진입·퇴장 전이는 지도 오버레이 전이(U52 ①)와 일괄(plan D8). 눌림 피드백만 MotionPressable 계약.
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Button, Icon, IconName, MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

// 닫기 버튼 한 변 — 최소 터치 타깃 44pt를 치수 자체로 확보한다(hitSlop을 쓰면 바로 옆 행동 버튼의 터치 영역과 겹친다).
//   카드 오른쪽 패딩 0 + 글리프 가운데 → 글리프 우측 시각 여백 (44 − 15) / 2 ≈ 14.5로 좌측 패딩 16과 균형을 맞춘다.
const BANNER_DISMISS_SIZE = 44;

// 킷 위시 행 닫기 글리프 크기(mk-extra:214 EI name="close" size={15}) — 행동 버튼 옆 보조 동작의 킷 선례.
const BANNER_DISMISS_ICON_SIZE = 15;

// Button sm 실높이 35(9 + 17 + 9, Button.tsx:35) → 세로 5씩 넓혀 45pt(MapResearchButton RESEARCH_HIT_SLOP 선례).
//   가로는 0 — 오른쪽은 닫기 버튼과 맞닿아 있어 넓히면 두 버튼의 터치 영역이 겹친다.
const BANNER_ACTION_HIT_SLOP = { top: 5, bottom: 5, left: 0, right: 0 } as const;

// 닫기 눌림 불투명도 — 아이콘 단독 버튼 선례(IconButton·위시 행 닫기 0.6) 승계.
const BANNER_DISMISS_PRESSED_OPACITY = 0.6;

export type MapPermissionBannerProps = {
  /** 안내 문구(카피 단일 출처는 MapTabScreen MAP_COPY). 말줄임하지 않는다. */
  message: string;
  /** 행동 버튼 라벨(예: "설정 열기"). 접근성 라벨도 이 값. */
  actionLabel: string;
  /** 행동 버튼 접근성 힌트(예: "기기 설정에서 위치 권한을 허용할 수 있어요"). */
  actionHint?: string;
  /** 행동 버튼 탭 콜백(설정 앱 이동은 호출부가 배선). */
  onAction: () => void;
  /** 닫기 버튼 접근성 라벨(예: "위치 안내 닫기"). 아이콘 단독이라 필수. */
  dismissLabel: string;
  /** 닫기 버튼 탭 콜백(닫힘 상태는 호출부가 소유). */
  onDismiss: () => void;
  /** 루트 테스트 식별자(기본 'map-permission-banner'). */
  testID?: string;
};

export const MapPermissionBanner = ({
  message,
  actionLabel,
  actionHint,
  onAction,
  dismissLabel,
  onDismiss,
  testID = 'map-permission-banner',
}: MapPermissionBannerProps) => {
  const theme = useTheme();
  // MapStatusOverlay 스킨 파생 + 한 줄 배치 패딩(세로 12 · 좌 16 · 우 0 — 우측 여백은 닫기 버튼 44 박스가 만든다).
  const card: ViewStyle = {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.hairline,
    borderRadius: theme.radius.card,
    paddingVertical: theme.spacing[12],
    paddingLeft: theme.spacing[16],
    gap: theme.spacing[8],
    ...theme.shadow.md,
  };
  return (
    // 루트는 accessible 그룹으로 묶지 않는다 — 묶으면 두 버튼이 따로 포커스되지 않는다(plan §4.8).
    //   polite 라이브 영역: Android는 배너가 나타나면 TalkBack이 읽고, iOS는 무시하는 무해한 prop(plan D9).
    <View testID={testID} accessibilityLiveRegion="polite" style={[styles.card, card]}>
      {/* 어절 단위 줄바꿈 — RN iOS 기본 전략('none')은 한글을 음절 사이에서 끊어 430pt에서
          "…볼 수 있어 / 요"처럼 한 글자만 둘째 줄에 남긴다. hangul-word면 "…볼 수 / 있어요"(ui-spec §3.2).
          Android는 이 prop을 무시한다(해 없음) — Android 줄바꿈은 디바이스 스모크 D5에서 확인. */}
      <Text
        variant="bodySm"
        color="fgWeak"
        lineBreakStrategyIOS="hangul-word"
        style={styles.message}
      >
        {message}
      </Text>
      <View style={styles.actions}>
        <Button
          testID="map-permission-action"
          title={actionLabel}
          variant="soft"
          size="sm"
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint}
          hitSlop={BANNER_ACTION_HIT_SLOP}
          onPress={onAction}
        />
        <MotionPressable
          testID="map-permission-dismiss"
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          pressSize="sm"
          pressedOpacity={BANNER_DISMISS_PRESSED_OPACITY}
          style={styles.dismiss}
        >
          {/* 색은 문구와 같은 fgWeak — 킷의 옅은 X(assistive/alternative)는 목록·입력의 보조 동작용이고,
              지도 면적을 되찾는 유일한 수단인 배너 닫기는 비텍스트 대비 3:1 이상이 필요하다(ui-spec §2.4). */}
          <Icon name={IconName.Close} size={BANNER_DISMISS_ICON_SIZE} color="fgWeak" />
        </MotionPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // 한 줄 배치 — 문구 · [설정 열기 · 닫기]가 세로 가운데 정렬.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // 남는 폭을 문구가 차지하고 줄바꿈한다(버튼·닫기는 RN 기본 flexShrink 0이라 줄지 않는다).
  message: { flex: 1 },
  // 행동 버튼과 닫기는 맞닿는다 — 둘 사이 시각 간격은 닫기 44 박스 안의 여백(≈14.5)이 만든다.
  actions: { flexDirection: 'row', alignItems: 'center' },
  dismiss: {
    width: BANNER_DISMISS_SIZE,
    height: BANNER_DISMISS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
