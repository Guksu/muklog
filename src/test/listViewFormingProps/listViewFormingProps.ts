// src/test/listViewFormingProps/listViewFormingProps.ts
// 테스트 전용 — 새 아키텍처(Fabric)가 이 호스트 View를 실제 화면 뷰(네이티브 뷰)로 남기는지 렌더 트리에서 판정한다.
//   왜 필요한가: 새 아키텍처는 레이아웃만 하는 View를 없애는데(평탄화), 네이티브 뷰로 남은 View는 넘치는 자식이 없으면
//   자기 경계 밖 터치를 버린다(iOS React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm:606-614 betterHitTest ·
//   Android ReactAndroid/.../uimanager/TouchTargetHelper.java:274-276). 그래서 버튼을 감싼 View가 네이티브 뷰가 되면
//   버튼 위아래로 넓힌 터치 영역(hitSlop)이 그 경계에서 잘린다.
//   소비처: InviteCodeCard.spec(버튼 열) · JoinLogScreen.spec(붙여넣기·지우기를 감싼 조상). 빈 배열이어야 레이아웃 전용이다.
//
// 규칙 출처 — RN 0.76.9 설치 소스(node_modules/react-native, 경로는 ReactCommon/react/renderer 기준):
//   · components/view/ViewShadowNode.cpp:51-67 — 쌓임 맥락(formsStackingContext) 조건. 이것이면 네이티브 뷰도 만든다.
//   · components/view/ViewShadowNode.cpp:69-73 — 그 밖에 배경색·테두리·testID·boxShadow·backgroundImage면 네이티브 뷰(formsView).
//     테두리는 두께가 "정의되기만" 해도 걸린다 — :42-49 hasBorder가 border(edge).isDefined()를 보므로 0도 해당한다.
//     테두리 키는 JS가 네이티브로 넘기고(Libraries/NativeComponent/BaseViewConfig.ios.js validAttributes) 네이티브가 yoga 테두리로
//     읽는(components/view/YogaStylableProps.cpp:394-473) 일곱 가지다.
//   · components/view/platform/android/.../HostPlatformViewTraitsInitializer.h:15-25 — Android만 더하는 조건(elevation ·
//     nativeBackground/ForegroundAndroid · focusable · hasTVPreferredFocus · needsOffscreenAlphaCompositing ·
//     renderToHardwareTextureAndroid). iOS는 platform/cxx 판(React-Fabric.podspec:105·147)이라 더하는 조건이 없다.
//   · mounting/Differentiator.cpp:235-239 — 부모가 collapsableChildren={false}면 그 자식도 네이티브 뷰다.
//   · 이벤트 비트(events.bits.any()) = VIEW_EVENT_PROP_NAMES(components/view/propsConversions.h:248-440 · BaseViewProps.cpp:352-376).
//   · 색은 알파가 0보다 클 때만 의미 있다(graphics/Color.cpp:12-18 isColorMeaningful). zIndex는 position이 static이 아닐 때만 —
//     RN 기본 position은 relative다(yoga/yoga/style/Style.h:669-670). overflow는 visible이 아니면(BaseViewProps.cpp:533-535).
//     transform은 항등 변형이라도 목록이 비어 있지 않으면 기본값과 다르다(graphics/Transform.cpp:316-331).
//   · jest의 View는 목(mockComponent)이라 View.js의 별칭 변환(id → nativeID · aria-hidden → accessibilityElementsHidden·
//     importantForAccessibility · tabIndex → focusable, Libraries/Components/View/View.js:104-114)을 거치지 않는다 → 두 이름을 다 본다.
//
// 판정하지 않는 것(한계):
//   · 실제 레이아웃과 터치 — 넘치는 자식이 있으면 경계 밖 터치도 받는다(overflowInset). 실제로 눌리는지는 기기 스모크.
//   · 네이티브가 해석하지 못하는 값(예: 색이 아닌 문자열) — 네이티브와 같게 "의미 없음"으로 본다.
import { processColor, StyleSheet, type ColorValue, type ViewStyle } from 'react-native';

/** 렌더 트리 노드에서 이 헬퍼가 읽는 최소 형태(react-test-renderer의 ReactTestInstance와 구조 호환). */
export type ViewFormingTreeNode = {
  type: unknown;
  props: Record<string, unknown>;
  parent: ViewFormingTreeNode | null;
};

// 이벤트 비트를 켜는 핸들러 이름(값이 있으면 네이티브 뷰) — propsConversions.h:248-440(BaseViewProps.cpp:352-376을 포함한다).
const VIEW_EVENT_PROP_NAMES = [
  'onPointerEnter',
  'onPointerMove',
  'onPointerLeave',
  'onPointerEnterCapture',
  'onPointerMoveCapture',
  'onPointerLeaveCapture',
  'onPointerOver',
  'onPointerOut',
  'onClick',
  'onClickCapture',
  'onPointerDown',
  'onPointerDownCapture',
  'onPointerUp',
  'onPointerUpCapture',
  'onMoveShouldSetResponder',
  'onMoveShouldSetResponderCapture',
  'onStartShouldSetResponder',
  'onStartShouldSetResponderCapture',
  'onResponderGrant',
  'onResponderReject',
  'onResponderStart',
  'onResponderEnd',
  'onResponderRelease',
  'onResponderMove',
  'onResponderTerminate',
  'onResponderTerminationRequest',
  'onShouldBlockNativeResponder',
  'onTouchStart',
  'onTouchMove',
  'onTouchEnd',
  'onTouchCancel',
] as const;

// 정의만 돼도(0 포함) 네이티브 뷰를 만드는 테두리 두께 키 — YogaStylableProps.cpp:394-473 · BaseViewConfig.ios.js.
const BORDER_WIDTH_STYLE_KEYS = [
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStartWidth',
  'borderEndWidth',
] as const;

// 판정에 쓰는 RN 호스트 타입·속성·스타일 값 — 외부 API 값을 한 곳에 모은다(컨벤션 enum-style 상수).
const RN_VALUE = {
  hostView: 'View',
  pointerEventsNone: 'none',
  displayNone: 'none',
  positionStatic: 'static',
  overflowVisible: 'visible',
  importantForAccessibilityAuto: 'auto',
  cursorAuto: 'auto',
  isolationIsolate: 'isolate',
  mixBlendModeNormal: 'normal',
} as const;

/**
 * 값이 정해져 있는지(undefined·null이 아닌지) — 네이티브는 두 경우 모두 기본값으로 읽는다.
 * @param value 속성·스타일 값
 * @returns 정해져 있으면 true
 */
const isPresent = ({ value }: { value: unknown }): boolean => value !== undefined && value !== null;

/**
 * 비어 있지 않은 문자열인지(testID·nativeID — 네이티브는 빈 문자열을 "없음"으로 본다).
 * @param value 속성 값
 * @returns 한 글자 이상인 문자열이면 true
 */
const isNonEmptyString = ({ value }: { value: unknown }): boolean => typeof value === 'string' && value.length > 0;

/**
 * 배열·문자열 값이 비어 있지 않은지(transform·filter·boxShadow·backgroundImage).
 * @param value 스타일 값
 * @returns 원소·글자가 하나 이상이면 true(배열·문자열이 아닌 값은 정해져 있으면 true)
 */
const isNonEmpty = ({ value }: { value: unknown }): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return isPresent({ value });
};

/**
 * 색이 화면에 보이는지(알파 > 0) — graphics/Color.cpp isColorMeaningful과 같은 판정.
 * @param color 스타일 색 값
 * @returns 알파가 0보다 크면 true. 플랫폼 색 객체(PlatformColor 등)는 알파를 알 수 없어 보이는 쪽(true)으로 본다
 */
const isColorMeaningful = ({ color }: { color: unknown }): boolean => {
  if (!isPresent({ value: color })) return false;
  const processed = processColor(color as ColorValue);
  // processColor는 0xAARRGGBB(Android는 부호 있는 32비트)를 돌려준다 — 부호 없는 이동으로 알파 바이트를 읽는다.
  if (typeof processed === 'number') return processed >>> 24 > 0;
  return isPresent({ value: processed });
};

/**
 * 가장 가까운 호스트 조상(type이 문자열)을 찾는다 — 합성 컴포넌트는 네이티브 트리에 없으므로 건너뛴다.
 * @param node 시작 노드
 * @returns 호스트 조상(없으면 null)
 */
const findHostParent = ({ node }: { node: ViewFormingTreeNode }): ViewFormingTreeNode | null => {
  let current = node.parent;
  while (current !== null && typeof current.type !== 'string') current = current.parent;
  return current;
};

/**
 * 새 아키텍처에서 이 호스트 View를 네이티브 뷰로 만드는(평탄화를 막는) 이유를 모은다(RN 0.76.9 규칙 — 파일 머리 주석).
 * @param node 판정할 호스트 노드(getByLabelText 등으로 얻은 요소 또는 그 조상)
 * @returns 이유 이름 배열 — 속성은 그 이름('testID'), 스타일은 'style.키', 부모 조건은 'parent.collapsableChildren',
 *   View가 아닌 호스트는 'host:타입'. 빈 배열이어야 레이아웃 전용(평탄화)이다
 * @throws 호스트가 아닌 노드(합성 컴포넌트)를 넘기면 — 판정 없이 빈 배열로 빠져나가 가드가 껍데기가 되지 않게
 */
export const listViewFormingProps = ({ node }: { node: ViewFormingTreeNode }): string[] => {
  if (typeof node.type !== 'string') {
    throw new Error('listViewFormingProps: 호스트 노드(type이 문자열)만 판정한다 — 합성 컴포넌트를 넘겼다');
  }
  // View가 아닌 호스트(Text·ScrollView 등)는 그 자체가 네이티브 뷰다.
  if (node.type !== RN_VALUE.hostView) return [`host:${node.type}`];

  const { props } = node;
  const style = (StyleSheet.flatten(props.style as ViewStyle) ?? {}) as Record<string, unknown>;
  const hostParent = findHostParent({ node });

  const checks: [string, boolean][] = [
    // 쌓임 맥락(formsStackingContext) — ViewShadowNode.cpp:51-67
    ['collapsable', props.collapsable === false],
    ['pointerEvents', props.pointerEvents === RN_VALUE.pointerEventsNone],
    ['style.pointerEvents', style.pointerEvents === RN_VALUE.pointerEventsNone],
    ['nativeID', isNonEmptyString({ value: props.nativeID })],
    ['id', isNonEmptyString({ value: props.id })],
    ['accessible', props.accessible === true],
    ['style.opacity', isPresent({ value: style.opacity }) && style.opacity !== 1],
    ['style.transform', isNonEmpty({ value: style.transform })],
    ['style.zIndex', isPresent({ value: style.zIndex }) && style.position !== RN_VALUE.positionStatic],
    ['style.display', style.display === RN_VALUE.displayNone],
    ['style.overflow', isPresent({ value: style.overflow }) && style.overflow !== RN_VALUE.overflowVisible],
    ...VIEW_EVENT_PROP_NAMES.map((name): [string, boolean] => [
      name,
      isPresent({ value: props[name] }) && props[name] !== false,
    ]),
    ['style.shadowColor', isColorMeaningful({ color: style.shadowColor })],
    ['accessibilityElementsHidden', props.accessibilityElementsHidden === true],
    ['aria-hidden', props['aria-hidden'] === true],
    ['accessibilityViewIsModal', props.accessibilityViewIsModal === true],
    [
      'importantForAccessibility',
      isPresent({ value: props.importantForAccessibility }) &&
        props.importantForAccessibility !== RN_VALUE.importantForAccessibilityAuto,
    ],
    ['removeClippedSubviews', props.removeClippedSubviews === true],
    ['style.cursor', isPresent({ value: style.cursor }) && style.cursor !== RN_VALUE.cursorAuto],
    ['style.filter', isNonEmpty({ value: style.filter })],
    [
      'style.experimental_mixBlendMode',
      isPresent({ value: style.experimental_mixBlendMode }) &&
        style.experimental_mixBlendMode !== RN_VALUE.mixBlendModeNormal,
    ],
    ['style.isolation', style.isolation === RN_VALUE.isolationIsolate],
    // Android 쌓임 맥락 — HostPlatformViewTraitsInitializer.h:15-17
    ['style.elevation', isPresent({ value: style.elevation }) && style.elevation !== 0],
    // 네이티브 뷰(formsView) — ViewShadowNode.cpp:69-73
    ['style.backgroundColor', isColorMeaningful({ color: style.backgroundColor })],
    ...BORDER_WIDTH_STYLE_KEYS.map((key): [string, boolean] => [`style.${key}`, isPresent({ value: style[key] })]),
    ['testID', isNonEmptyString({ value: props.testID })],
    ['style.boxShadow', isNonEmpty({ value: style.boxShadow })],
    ['style.experimental_backgroundImage', isNonEmpty({ value: style.experimental_backgroundImage })],
    // Android 네이티브 뷰 — HostPlatformViewTraitsInitializer.h:19-25
    ['nativeBackgroundAndroid', isPresent({ value: props.nativeBackgroundAndroid })],
    ['nativeForegroundAndroid', isPresent({ value: props.nativeForegroundAndroid })],
    ['focusable', props.focusable === true],
    ['tabIndex', props.tabIndex === 0],
    ['hasTVPreferredFocus', props.hasTVPreferredFocus === true],
    ['needsOffscreenAlphaCompositing', props.needsOffscreenAlphaCompositing === true],
    ['renderToHardwareTextureAndroid', props.renderToHardwareTextureAndroid === true],
    // 부모 — Differentiator.cpp:235-239
    ['parent.collapsableChildren', hostParent !== null && hostParent.props.collapsableChildren === false],
  ];
  return checks.filter(([, formsView]) => formsView).map(([name]) => name);
};
