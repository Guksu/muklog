// src/test/listViewFormingProps/listViewFormingProps.spec.tsx
// 헬퍼 자체 검증 — 이 헬퍼가 빈 배열만 돌려주면 소비처의 새 아키텍처 가드(버튼을 감싼 View가 네이티브 뷰가 아니어서
//   위아래로 넓힌 터치 영역이 잘리지 않음)가 전부 껍데기가 된다.
//   규칙 표는 RN 0.76.9 설치 소스의 조건을 한 줄씩 옮긴 것이다(근거 줄은 헬퍼 파일 머리 주석). 경계값(0·투명·auto·빈 문자열)을 같이 본다.
//   실제 렌더(jest의 View·Pressable) 몇 건으로 스타일 배열·Pressable 호스트·부모 조건을 실물 props로 확인한다.
//   빈 배열 단언은 toStrictEqual로 한다(docs/testing-strategy.md — 접근성 단언 절).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { listViewFormingProps, type ViewFormingTreeNode } from './listViewFormingProps';

const noop = () => undefined;

/** 규칙 표용 — 부모 없는 호스트 View 노드를 만든다. */
const viewNode = ({ props }: { props: Record<string, unknown> }): ViewFormingTreeNode => ({
  type: 'View',
  props,
  parent: null,
});

const formingPropsOf = ({ props }: { props: Record<string, unknown> }) =>
  listViewFormingProps({ node: viewNode({ props }) });

describe('listViewFormingProps — 레이아웃 전용 View는 빈 배열', () => {
  it('레이아웃 속성(flex·gap·정렬·폭·여백)만 있는 실제 View는 빈 배열이다 — 스타일 배열도 합쳐 본다', () => {
    render(
      <View
        accessibilityLabel="대상"
        style={[
          { flex: 1, flexDirection: 'row' },
          { gap: 6, alignItems: 'stretch', alignSelf: 'center', width: 316, maxWidth: '100%', marginTop: 12 },
          { paddingVertical: 20, paddingHorizontal: 16 },
        ]}
      />,
    );
    expect(listViewFormingProps({ node: screen.getByLabelText('대상') })).toStrictEqual([]);
  });

  // 경계값 — 값이 있어도 네이티브 기본값과 같거나 보이지 않으면 뷰를 만들지 않는다.
  it.each([
    ['투명 배경(transparent)', { style: { backgroundColor: 'transparent' } }],
    ['알파 0 배경(rgba)', { style: { backgroundColor: 'rgba(0, 0, 0, 0)' } }],
    ['알파 0 배경(#RRGGBBAA)', { style: { backgroundColor: '#FFFFFF00' } }],
    ['투명 그림자 색', { style: { shadowColor: 'transparent' } }],
    ['opacity 1', { style: { opacity: 1 } }],
    ['빈 transform', { style: { transform: [] } }],
    ["position='static'인 zIndex", { style: { zIndex: 1, position: 'static' } }],
    ["overflow='visible'", { style: { overflow: 'visible' } }],
    ["pointerEvents='box-none'(속성)", { pointerEvents: 'box-none' }],
    ["pointerEvents='auto'(스타일)", { style: { pointerEvents: 'auto' } }],
    ["importantForAccessibility='auto'", { importantForAccessibility: 'auto' }],
    ["cursor='auto'", { style: { cursor: 'auto' } }],
    ["experimental_mixBlendMode='normal'", { style: { experimental_mixBlendMode: 'normal' } }],
    ["isolation='auto'", { style: { isolation: 'auto' } }],
    ['elevation 0', { style: { elevation: 0 } }],
    ['빈 testID', { testID: '' }],
    ['빈 nativeID', { nativeID: '' }],
    ['accessible={false}', { accessible: false }],
    ['collapsable={true}', { collapsable: true }],
    ['focusable={false}', { focusable: false }],
    ['tabIndex -1', { tabIndex: -1 }],
    ['aria-hidden={false}', { 'aria-hidden': false }],
    ['테두리 없이 radius·색만', { style: { borderRadius: 16, borderColor: '#000000' } }],
    ['접근성 이름·역할만(accessible 없이)', { accessibilityLabel: '이름', accessibilityRole: 'button' }],
    ['onLayout(이벤트 비트가 아니다)', { onLayout: noop }],
    ['핸들러 자리의 false(조건부 핸들러가 꺼진 경우)', { onTouchStart: false }],
    ['hitSlop', { hitSlop: { top: 5, bottom: 5 } }],
  ])('%s는 네이티브 뷰를 만들지 않는다', (_label, props) => {
    expect(formingPropsOf({ props })).toStrictEqual([]);
  });
});

describe('listViewFormingProps — 네이티브 뷰를 만드는 조건 (RN 0.76.9 ViewShadowNode.cpp:51-73)', () => {
  // 쌓임 맥락(formsStackingContext, ViewShadowNode.cpp:51-67) — 네이티브 뷰도 만든다.
  it.each([
    ['collapsable={false}', { collapsable: false }, ['collapsable']],
    ["pointerEvents='none'(속성)", { pointerEvents: 'none' }, ['pointerEvents']],
    ["pointerEvents='none'(스타일)", { style: { pointerEvents: 'none' } }, ['style.pointerEvents']],
    ['nativeID', { nativeID: 'row' }, ['nativeID']],
    ['id(View.js가 nativeID로 바꾼다)', { id: 'row' }, ['id']],
    ['accessible', { accessible: true }, ['accessible']],
    ['opacity 0.5', { style: { opacity: 0.5 } }, ['style.opacity']],
    ['opacity 0', { style: { opacity: 0 } }, ['style.opacity']],
    ['항등이어도 비어 있지 않은 transform', { style: { transform: [{ scale: 1 }] } }, ['style.transform']],
    ['zIndex(RN 기본 position은 relative)', { style: { zIndex: 1 } }, ['style.zIndex']],
    ["display='none'", { style: { display: 'none' } }, ['style.display']],
    ["overflow='hidden'", { style: { overflow: 'hidden' } }, ['style.overflow']],
    ["overflow='scroll'", { style: { overflow: 'scroll' } }, ['style.overflow']],
    ['onStartShouldSetResponder', { onStartShouldSetResponder: noop }, ['onStartShouldSetResponder']],
    ['onResponderGrant', { onResponderGrant: noop }, ['onResponderGrant']],
    ['onTouchStart', { onTouchStart: noop }, ['onTouchStart']],
    ['onPointerEnter', { onPointerEnter: noop }, ['onPointerEnter']],
    ['onClick', { onClick: noop }, ['onClick']],
    ['그림자 색', { style: { shadowColor: '#000000' } }, ['style.shadowColor']],
    ['accessibilityElementsHidden', { accessibilityElementsHidden: true }, ['accessibilityElementsHidden']],
    ['aria-hidden(View.js가 accessibilityElementsHidden·importantForAccessibility로 바꾼다)', { 'aria-hidden': true }, ['aria-hidden']],
    ['accessibilityViewIsModal', { accessibilityViewIsModal: true }, ['accessibilityViewIsModal']],
    ["importantForAccessibility='no-hide-descendants'", { importantForAccessibility: 'no-hide-descendants' }, ['importantForAccessibility']],
    ['removeClippedSubviews', { removeClippedSubviews: true }, ['removeClippedSubviews']],
    ["cursor='pointer'", { style: { cursor: 'pointer' } }, ['style.cursor']],
    ['filter', { style: { filter: [{ brightness: 0.5 }] } }, ['style.filter']],
    ["experimental_mixBlendMode='multiply'", { style: { experimental_mixBlendMode: 'multiply' } }, ['style.experimental_mixBlendMode']],
    ["isolation='isolate'", { style: { isolation: 'isolate' } }, ['style.isolation']],
    ['elevation(Android)', { style: { elevation: 2 } }, ['style.elevation']],
  ])('%s', (_label, props, expected) => {
    expect(formingPropsOf({ props })).toStrictEqual(expected);
  });

  // 네이티브 뷰만 만드는 조건(ViewShadowNode.cpp:69-73).
  it.each([
    ['배경색', { style: { backgroundColor: '#FFFFFF' } }, ['style.backgroundColor']],
    ['testID', { testID: 'row' }, ['testID']],
    ['boxShadow', { style: { boxShadow: '0 1px 2px black' } }, ['style.boxShadow']],
    ['experimental_backgroundImage', { style: { experimental_backgroundImage: 'linear-gradient(red, blue)' } }, ['style.experimental_backgroundImage']],
    // Android만 더하는 조건(platform/android HostPlatformViewTraitsInitializer.h:19-25).
    ['nativeBackgroundAndroid', { nativeBackgroundAndroid: { type: 'RippleAndroid' } }, ['nativeBackgroundAndroid']],
    ['nativeForegroundAndroid', { nativeForegroundAndroid: { type: 'RippleAndroid' } }, ['nativeForegroundAndroid']],
    ['focusable', { focusable: true }, ['focusable']],
    ['tabIndex 0(View.js가 focusable로 바꾼다)', { tabIndex: 0 }, ['tabIndex']],
    ['hasTVPreferredFocus', { hasTVPreferredFocus: true }, ['hasTVPreferredFocus']],
    ['needsOffscreenAlphaCompositing', { needsOffscreenAlphaCompositing: true }, ['needsOffscreenAlphaCompositing']],
    ['renderToHardwareTextureAndroid', { renderToHardwareTextureAndroid: true }, ['renderToHardwareTextureAndroid']],
  ])('%s', (_label, props, expected) => {
    expect(formingPropsOf({ props })).toStrictEqual(expected);
  });

  // 테두리는 두께가 "정의되기만" 해도 뷰가 된다 — 0도 정의된 값이다(ViewShadowNode.cpp:42-49 hasBorder · isDefined). QA 2차 R1.
  it.each([
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStartWidth',
    'borderEndWidth',
  ])('%s: 0이어도 네이티브 뷰를 만든다', (key) => {
    expect(formingPropsOf({ props: { style: { [key]: 0 } } })).toStrictEqual([`style.${key}`]);
  });

  it('여러 조건이 겹치면 모두 돌려준다', () => {
    expect(formingPropsOf({ props: { testID: 'row', style: { backgroundColor: '#FFFFFF', borderWidth: 1 } } })).toStrictEqual([
      'style.backgroundColor',
      'style.borderWidth',
      'testID',
    ]);
  });
});

describe('listViewFormingProps — 실제 렌더 트리', () => {
  it('스타일 배열 안의 borderWidth 0도 잡는다 (QA 2차 R1 — 이전 근사는 > 0만 봤다)', () => {
    render(<View accessibilityLabel="대상" style={[{ gap: 6 }, { borderWidth: 0 }]} />);
    expect(listViewFormingProps({ node: screen.getByLabelText('대상') })).toStrictEqual(['style.borderWidth']);
  });

  it('Pressable의 호스트는 접근성 요소·응답자 핸들러 때문에 네이티브 뷰다', () => {
    render(<Pressable accessibilityLabel="대상" onPress={noop} />);
    expect(listViewFormingProps({ node: screen.getByLabelText('대상') })).toEqual(
      expect.arrayContaining(['accessible', 'onStartShouldSetResponder', 'onResponderGrant']),
    );
  });

  // 부모가 collapsableChildren={false}면 그 자식은 평탄화되지 않는다(Differentiator.cpp:235-239).
  it('가장 가까운 호스트 부모가 collapsableChildren={false}면 자식도 네이티브 뷰다', () => {
    render(
      <View collapsableChildren={false}>
        <View accessibilityLabel="대상" />
      </View>,
    );
    expect(listViewFormingProps({ node: screen.getByLabelText('대상') })).toStrictEqual(['parent.collapsableChildren']);
  });

  it('View가 아닌 호스트(Text 등)는 그 자체로 네이티브 뷰라 호스트 이름으로 보고한다', () => {
    render(<Text accessibilityLabel="대상">글</Text>);
    expect(listViewFormingProps({ node: screen.getByLabelText('대상') })).toStrictEqual(['host:Text']);
  });

  it('호스트가 아닌 노드(합성 컴포넌트)를 넘기면 오류를 던진다 — 판정 없이 빈 배열로 빠져나가지 않게', () => {
    render(<View accessibilityLabel="대상" />);
    expect(() => listViewFormingProps({ node: screen.UNSAFE_getByType(View) })).toThrow('호스트');
  });
});
