// src/components/Sheet/Sheet.tsx
// 공용 하단 시트(액션시트/모달 베이스) — mk-ui Sheet 재현 (plan §6.4, T4).
//   딤 배경 + 하단 패널(핸들바 + 옵션 title + children). 딤 탭 → onClose, 패널 탭은 전파 차단.
//   패널 전체 드래그-to-dismiss. **제스처 수단은 react-native-gesture-handler(RNGH)** —
//     아래로 SHEET_DISMISS_DISTANCE 초과, 또는 최소 이동을 넘긴 상태에서 아래로 빠르게 플릭하면 닫고,
//     아니면 제자리 스프링 스냅백. 드래그를 따라 딤도 옅어진다(SHEET_BACKDROP_* — 킷에 없는 RN 모션 확장,
//     정지 상태 값은 킷과 동일).
//   ⚠️ 왜 PanResponder가 아니라 RNGH인가 (sheet-drag-rework, 2026-08-19)
//     이전 구현은 패널 전체에 비캡처 PanResponder를 붙였다. RN responder 협상(JS 레이어)에 의존하는 방식인데,
//     실기기(Android)에서 모든 시트가 전혀 끌리지 않았다. PanResponder 배선 자체는 단위 테스트로 전부 green이라
//     문제는 "네이티브 터치가 JS responder 협상까지 도달/성립하는 구간"에 있고, 그 구간은 jest가 볼 수 없다.
//     RNGH는 네이티브 제스처 인식기를 패널 뷰에 직접 붙이므로 JS responder 협상을 통째로 우회한다.
//   ⚠️ Android + RN Modal 함정: Modal은 별도 네이티브 윈도우(Dialog)라 앱 루트의 GestureHandlerRootView
//     컨텍스트가 끊긴다. 그래서 **Modal 내용물을 GestureHandlerRootView로 다시 감싼다**(이게 없으면
//     Android에서 제스처가 조용히 무동작).
//   ⚠️ 드래그 영역 정책: 패널 전체가 드래그 영역이다.
//     · 자식 Pressable(메뉴 행·날짜 셀) — 아래로 SHEET_DRAG_ACTIVATE_DY를 넘기면 RNGH가 활성화되며
//       네이티브가 터치를 취소해 탭이 발화하지 않고 드래그로 전환된다. 짧은 탭은 그대로 동작.
//     · 자식 ScrollView — 스크롤이 우선이어야 한다(현재 유일한 소비처: LogPickerSheet).
//       스크롤 뷰는 useSheetScrollGesture()로 시트 드래그를 블록해 스크롤 우선권을 명시적으로 가져간다.
//       (장소검색은 풀스크린 PlaceSearchView로 이관됐다 — architecture.md §4. 시트 안 TextInput 소비처는 0개.)
//   RN Modal(transparent) 위에 absolute 오버레이를 깔아 네비 스택과 무관하게 화면 전체를 덮는다.
//   스타일은 토큰만(raw hex 0). radius=sheet(20 위쪽 라운드는 26 근사 — 킷 26,26,0,0), 딤=반투명 잉크.
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type GestureType,
  type NativeGesture,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Text } from '../Text';

const SHEET_TOP_RADIUS = 26; // mk-ui Sheet: 26px 26px 0 0 (상단 라운드)
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 5;
// 패널 상단 캡 — 내용(로그 목록 등)이 길어져도 상태바를 침범하지 않게 화면의 88%까지만(나머지는 내부 스크롤).
//   킷 Sheet는 디바이스 프레임 inset:0 안에서 자라므로 RN에선 maxHeight + 하단 safe-area inset으로 번역.
const PANEL_MAX_HEIGHT_RATIO = '88%';

/** 드래그로 인식하기 시작하는 최소 아래 방향 이동(px). 탭·가로 제스처 보존. */
export const SHEET_DRAG_ACTIVATE_DY = 4;
/** 이 거리(px)만큼 위로 먼저 끌면 시트 드래그가 아니다 — 자식(리스트 스크롤 등)에게 넘긴다. */
export const SHEET_DRAG_FAIL_UP_DY = 8;
/** 이 거리(px)를 넘겨 내리면 속도와 무관하게 닫는다. */
export const SHEET_DISMISS_DISTANCE = 80;
/** 이 속도(px/ms) 이상으로 아래로 튕기면 닫는다(플릭). */
export const SHEET_DISMISS_VELOCITY = 0.5;
/** 플릭으로 닫히기 위한 최소 이동(px) — 제자리 미세 흔들림이 dismiss로 오인되는 것을 막는다. */
export const SHEET_FLICK_MIN_DISTANCE = 24;
/** 닫힐 때 패널을 밀어낼 거리(px) — 대부분 기기 높이 이상이라 화면 밖으로 완전히 나간다. */
export const SHEET_DISMISS_TRANSLATE = 700;
/** 닫힘 애니메이션 시간(ms). 킷 mkSlideUp 260ms보다 약간 빠르게. */
export const SHEET_DISMISS_DURATION = 200;
/** 스냅백 스프링 — 오버슈트 없이 단정하게. */
export const SHEET_SNAP_BACK_SPRING = { bounciness: 0, speed: 14 } as const;
/** 딤 불투명도 — 킷 rgba(20,12,8,.32) 근사(정지 상태 값). */
export const SHEET_BACKDROP_OPACITY = 0.32;
/** 드래그를 끝까지 내렸을 때의 딤 불투명도. */
export const SHEET_BACKDROP_OPACITY_MIN = 0.1;
/** 딤이 최소값까지 옅어지는 데 필요한 드래그 거리(px). */
export const SHEET_BACKDROP_FADE_DISTANCE = 240;
/** RNGH 속도 단위(px/s) → 판정 계약 단위(px/ms) 환산 계수. */
export const SHEET_VELOCITY_MS_PER_SECOND = 1000;
/** 드래그 제스처의 테스트 식별자(getByGestureTestId). */
export const SHEET_DRAG_GESTURE_TEST_ID = 'sheet-drag';

/**
 * 드래그 릴리스 시 시트를 닫을지 결정한다(순수 — 단위 테스트 대상).
 *   dy<=0(위로 끌었거나 제자리)이면 절대 닫지 않는다.
 *   충분히 내렸거나, 최소 이동을 넘긴 상태에서 아래로 빠르게 튕기면(플릭) 닫는다.
 * @param dy 시작점 대비 세로 이동(px, 아래로 +)
 * @param vy 세로 속도(px/ms, 아래로 +)
 * @returns 닫아야 하면 true, 스냅백해야 하면 false
 */
export const shouldDismissSheet = ({ dy, vy }: { dy: number; vy: number }): boolean =>
  dy > 0 &&
  (dy > SHEET_DISMISS_DISTANCE ||
    (vy > SHEET_DISMISS_VELOCITY && dy > SHEET_FLICK_MIN_DISTANCE));

/**
 * 이동량이 시트 드래그로 인식할 만한지 판정한다(순수 — 단위 테스트 대상).
 *   아래로 임계를 넘고 세로가 우세할 때만 패널이 손가락을 따라간다(탭·가로 스와이프 보존).
 *   RNGH가 activeOffsetY로 "아래로 임계 초과"를 네이티브에서 먼저 거르고, 세로 우세 판정은 이 유틸이 맡는다.
 * @param dy 시작점 대비 세로 이동(px, 아래로 +)
 * @param dx 시작점 대비 가로 이동(px)
 * @returns 드래그를 시작해야 하면 true
 */
export const shouldStartSheetDrag = ({ dy, dx }: { dy: number; dx: number }): boolean =>
  dy > SHEET_DRAG_ACTIVATE_DY && Math.abs(dy) > Math.abs(dx);

/**
 * 드래그 이동량에 대응하는 딤 불투명도를 구한다(선형, 양 끝 클램프 — 순수).
 *   딤 Animated interpolate의 outputRange를 이 함수로 산출해 값의 단일 출처를 유지한다.
 * @param dy 패널이 내려간 거리(px)
 * @returns 불투명도(SHEET_BACKDROP_OPACITY_MIN ~ SHEET_BACKDROP_OPACITY)
 */
export const resolveBackdropOpacity = ({ dy }: { dy: number }): number => {
  if (dy <= 0) return SHEET_BACKDROP_OPACITY;
  if (dy >= SHEET_BACKDROP_FADE_DISTANCE) return SHEET_BACKDROP_OPACITY_MIN;
  return (
    SHEET_BACKDROP_OPACITY +
    (SHEET_BACKDROP_OPACITY_MIN - SHEET_BACKDROP_OPACITY) * (dy / SHEET_BACKDROP_FADE_DISTANCE)
  );
};

/**
 * 패널을 제자리(0)로 되돌린다 — 임계 미달 릴리스와 제스처 강제 종료의 공통 복구 경로.
 * @param translateY 패널 세로 오프셋 Animated 값
 */
const snapPanelBack = ({ translateY }: { translateY: Animated.Value }) => {
  Animated.spring(translateY, {
    toValue: 0,
    ...SHEET_SNAP_BACK_SPRING,
    useNativeDriver: false,
  }).start();
};

// 시트 본문의 스크롤 뷰가 드래그 제스처와 우선순위를 협상할 수 있도록 패널의 pan 제스처 ref를 내려준다.
//   Sheet 밖에서 훅을 쓰면 null — 그때는 관계 없는 순수 Native 제스처가 된다(무해).
const SheetDragGestureContext = createContext<React.MutableRefObject<GestureType | undefined> | null>(
  null,
);

/** 컨텍스트 밖 호출 경고 문구 — 조용한 실패(관계 미성립)를 개발 중에 드러낸다. */
export const SHEET_SCROLL_GESTURE_OUT_OF_SHEET_WARNING =
  'useSheetScrollGesture는 Sheet의 children 안에서 호출해야 시트 드래그와 우선순위 관계가 맺어집니다. Sheet를 렌더하는 부모에서 호출하면 리스트 스크롤이 시트 드래그에 뺏길 수 있습니다.';

/**
 * 시트 본문 스크롤 뷰에 물릴 제스처를 만든다 — 스크롤이 시트 드래그보다 우선권을 갖는다.
 *   `<GestureDetector gesture={useSheetScrollGesture()}><ScrollView …/></GestureDetector>` 형태로 쓴다.
 *   blocksExternalGesture: 이 네이티브(스크롤) 제스처가 실패할 때까지 시트 드래그는 활성화되지 않는다
 *   → 리스트 위에서는 스크롤만, 시트를 닫으려면 헤더(핸들·제목)를 잡는다(iOS 표준 시트와 같은 멘탈 모델).
 *   ⚠️ **반드시 `Sheet`의 children 서브트리 안에서 호출해야 한다.** 컨텍스트는 렌더 트리 위치로 해석되므로,
 *      `<Sheet>`를 렌더하는 쪽(부모)에서 호출하면 컨텍스트가 null이라 관계가 조용히 안 맺어진다.
 *      본문을 별도 컴포넌트로 분리해 children으로 넘기고 그 안에서 호출한다(LogPickerBody 선례).
 * @returns GestureDetector에 넘길 Native 제스처
 */
export const useSheetScrollGesture = (): NativeGesture => {
  const dragGestureRef = useContext(SheetDragGestureContext);
  const scrollGesture = Gesture.Native();
  if (!dragGestureRef) {
    if (__DEV__) console.warn(SHEET_SCROLL_GESTURE_OUT_OF_SHEET_WARNING);
    return scrollGesture;
  }
  scrollGesture.blocksExternalGesture(dragGestureRef);
  return scrollGesture;
};

// 딤은 드래그를 따라 opacity가 변하면서도 탭 onClose·접근성 라벨을 같은 노드에 유지해야 한다
// (testID/역할이 이동하면 스크린리더의 유일한 닫기 경로가 끊긴다).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SheetProps = {
  /** 표시 여부. false면 미렌더(children 마운트 안 함). */
  visible: boolean;
  /** 딤 배경 탭/패널 드래그-다운/요청 시 닫기. */
  onClose: () => void;
  /** 시트 상단 제목(가운데). 생략 가능. */
  title?: string;
  children: React.ReactNode;
};

export const Sheet = ({ visible, onClose, title, children }: SheetProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 패널 세로 오프셋(드래그 추종). 닫힘/스냅백 후 0으로 복원해 다음 오픈을 깨끗이.
  const translateY = useRef(new Animated.Value(0)).current;
  // 닫힘 애니메이션 구간 — 재터치·딤 탭을 무시해 onClose가 정확히 1회만 나가게 한다.
  const closingRef = useRef(false);
  // 제스처가 활성화된 뒤 "세로 우세"까지 만족해 실제로 패널이 손가락을 따라가는 중인지.
  const followingRef = useRef(false);
  // 자식 스크롤 뷰가 우선권을 주장할 수 있도록 내려보내는 pan 제스처 참조.
  const dragGestureRef = useRef<GestureType | undefined>(undefined);
  // onClose는 렌더마다 바뀔 수 있어 ref로 최신값을 읽는다(제스처 콜백은 오래 살아남는다).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const beginDrag = () => {
    followingRef.current = false;
  };

  // 활성화 시점(onStart)과 이후 이동(onUpdate)이 같은 추종 로직을 쓴다 — 활성화 이벤트도 이미 이동량을 갖고 있어,
  //   여기서 흘리면 패널이 한 프레임 늦게 붙는다. 파라미터는 두 이벤트의 공통 페이로드로 받는다.
  const followDrag = (event: PanGestureHandlerEventPayload) => {
    if (closingRef.current) return;
    if (!followingRef.current) {
      // 네이티브 activeOffsetY가 "아래로 4px 초과"를 이미 걸렀고, 여기서 세로 우세를 확인한다.
      if (!shouldStartSheetDrag({ dy: event.translationY, dx: event.translationX })) return;
      followingRef.current = true;
    }
    // 아래로만 추종. 손가락이 시작점 위로 올라가면 0에 붙는다(시트가 위로 솟지 않게).
    translateY.setValue(Math.max(event.translationY, 0));
  };

  const settleDrag = (event: PanGestureHandlerEventPayload, success: boolean) => {
    const wasFollowing = followingRef.current;
    followingRef.current = false;
    // 추종 전(가로 우세 등)이면 패널은 제자리 그대로다 — 애니메이션도 판정도 필요 없다.
    if (closingRef.current || !wasFollowing) return;
    // success=false는 강제 종료(시스템 제스처·다른 핸들러가 가져감) — 스냅백으로 복구한다.
    if (
      !success ||
      !shouldDismissSheet({
        dy: event.translationY,
        vy: event.velocityY / SHEET_VELOCITY_MS_PER_SECOND,
      })
    ) {
      snapPanelBack({ translateY });
      return;
    }
    closingRef.current = true;
    Animated.timing(translateY, {
      toValue: SHEET_DISMISS_TRANSLATE,
      duration: SHEET_DISMISS_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // RN은 애니메이션이 중단될 때도 완료 콜백을 부른다(재오픈의 setValue가 stop을 유발).
      //   중단된 닫힘은 사용자가 시트를 닫은 게 아니므로 onClose를 내보내지 않는다.
      //   중단 경로(resetOffsetOnOpen)가 closingRef 해제와 오프셋 복원을 이미 마쳤으므로 정리 누락도 없다.
      if (!finished) return;
      onCloseRef.current();
      translateY.setValue(0); // 다음 오픈을 위해 복원.
      closingRef.current = false;
    });
  };

  // 제스처 객체는 렌더마다 새로 만들어도 GestureDetector가 핸들러만 갱신한다(handlerTag 유지).
  //   콜백이 ref만 읽으므로 stale closure가 없다 — useMemo 불필요(컨벤션).
  const dragGesture = Gesture.Pan()
    .withRef(dragGestureRef)
    .withTestId(SHEET_DRAG_GESTURE_TEST_ID)
    // reanimated 미설치 환경 — 콜백을 JS 스레드에서 돌린다는 것을 명시한다.
    .runOnJS(true)
    .activeOffsetY(SHEET_DRAG_ACTIVATE_DY)
    .failOffsetY(-SHEET_DRAG_FAIL_UP_DY)
    .onBegin(beginDrag)
    .onStart(followDrag)
    .onUpdate(followDrag)
    .onEnd(settleDrag);

  const resetOffsetOnOpen = () => {
    if (!visible) return;
    // 부모가 onClose를 무시해 시트가 안 닫혔다가 다시 열리는 경우에도 패널이 화면 밖에 남지 않게.
    closingRef.current = false;
    followingRef.current = false;
    translateY.setValue(0);
  };
  useEffect(resetOffsetOnOpen, [visible]);

  // 닫히는 중 딤 탭·안드로이드 뒤로가기는 무시(닫힘은 애니메이션 완료 콜백이 책임진다).
  const requestClose = () => {
    if (closingRef.current) return;
    onClose();
  };

  if (!visible) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SHEET_BACKDROP_FADE_DISTANCE],
    outputRange: [
      resolveBackdropOpacity({ dy: 0 }),
      resolveBackdropOpacity({ dy: SHEET_BACKDROP_FADE_DISTANCE }),
    ],
    extrapolate: 'clamp',
  });

  return (
    // animationType="none": fade면 닫히는 모달이 페이드아웃되는 동안 이전 시트 내용이 잔상으로 보임
    //   (시트→다른 시트 전환 시). none으로 즉시 마운트/언마운트해 잔상 제거(딤=즉시 피드백, 드래그 슬라이드는 유지).
    <Modal visible transparent animationType="none" onRequestClose={requestClose}>
      {/* Android에서 Modal은 별도 네이티브 윈도우라 앱 루트의 제스처 컨텍스트가 닿지 않는다 — 여기서 다시 루트를 연다. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* 딤 배경 — 탭하면 닫힘. 드래그를 따라 옅어진다. */}
        <AnimatedPressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={requestClose}
          style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: backdropOpacity }]}
        />
        {/* 하단 패널 — 탭해도 닫히지 않음(딤 위에 별도 레이어로 전파 차단). 드래그 추종 transform. */}
        <View style={styles.panelWrap} pointerEvents="box-none">
          <GestureDetector gesture={dragGesture}>
            <Animated.View
              testID="sheet-panel"
              style={[
                styles.panel,
                {
                  backgroundColor: theme.color.surface,
                  paddingHorizontal: theme.spacing[20],
                  // 하단 = 킷 34 근사(20) + 홈 인디케이터 safe-area inset(침범 방지).
                  paddingBottom: insets.bottom + theme.spacing[20],
                  transform: [{ translateY }],
                },
                theme.shadow.lg,
              ]}
            >
              {/* 핸들 영역 — 비주얼 전용(드래그는 패널 전체가 받는다). */}
              <View
                testID="sheet-handle"
                style={[
                  styles.handleZone,
                  { paddingTop: theme.spacing[10], paddingBottom: theme.spacing[14] },
                ]}
              >
                <View style={[styles.handle, { backgroundColor: theme.color.hairline }]} />
              </View>
              {title ? (
                <Text
                  variant="sheetTitle"
                  color="fg"
                  style={[styles.title, { marginBottom: theme.spacing[16] }]}
                >
                  {title}
                </Text>
              ) : null}
              {/* body — maxHeight 캡 아래에서 줄어들 수 있게 flexShrink. 내부 ScrollView가 이 영역 안에서 스크롤. */}
              <SheetDragGestureContext.Provider value={dragGestureRef}>
                <View style={styles.body}>{children}</View>
              </SheetDragGestureContext.Provider>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  panelWrap: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    maxHeight: PANEL_MAX_HEIGHT_RATIO,
  },
  // 핸들바를 가운데 두고 위아래 패딩으로 헤더 여백을 만든다.
  handleZone: { alignItems: 'center' },
  handle: { width: HANDLE_WIDTH, height: HANDLE_HEIGHT, borderRadius: HANDLE_HEIGHT },
  title: { textAlign: 'center' },
  body: { flexShrink: 1 },
});
