// src/components/MotionPressable/MotionPressable.spec.tsx
// 프레스 피드백 공용 래퍼 — plan §5-1 T3. **호출자 관점 계약만** 검증한다.
//   Animated.Value의 중간 값·스프링 궤적은 테스트하지 않는다(plan §5-2) — 감소 모션 분기와 props 통과만 잠근다.
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MotionPressable, MOTION_PRESSABLE_STATIC_OPACITY_WARNING } from './MotionPressable';

const flattenStyle = ({ testID }: { testID: string }) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(Promise.resolve(enabled));
};

describe('MotionPressable', () => {
  afterEach(() => jest.restoreAllMocks());

  it('pressIn → pressOut 후 onPress가 정확히 1회 발화한다', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <MotionPressable testID="mp" onPress={onPress}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    const target = screen.getByTestId('mp');
    fireEvent(target, 'pressIn');
    fireEvent(target, 'pressOut');
    fireEvent.press(target);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('접근성·식별 props를 그대로 통과시킨다', () => {
    renderWithTheme(
      <MotionPressable
        testID="mp"
        accessibilityRole="button"
        accessibilityLabel="로그 만들기"
        accessibilityState={{ disabled: false, busy: false }}
        hitSlop={8}
      >
        <Text>+</Text>
      </MotionPressable>,
    );
    const target = screen.getByTestId('mp');
    expect(target.props.accessibilityLabel).toBe('로그 만들기');
    expect(target.props.accessible).toBe(true);
    expect(screen.getByLabelText('로그 만들기')).toBeTruthy();
  });

  it('disabled면 onPress가 발화하지 않고 눌림 스타일도 붙지 않는다', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <MotionPressable testID="mp" disabled onPress={onPress} style={{ opacity: 0.45 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    const target = screen.getByTestId('mp');
    fireEvent(target, 'pressIn');
    fireEvent.press(target);
    expect(onPress).not.toHaveBeenCalled();
    // 소비처가 비활성 표시로 준 opacity가 모션 스타일에 덮이지 않는다(비주얼 회귀 0).
    expect(flattenStyle({ testID: 'mp' }).opacity).toBe(0.45);
    expect(flattenStyle({ testID: 'mp' }).transform).toBeUndefined();
  });

  it('감소 모션이 켜져 있으면 transform 없이 불투명도 피드백만 남는다(fe-craft #8)', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(
      <MotionPressable testID="mp" onPress={jest.fn()}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    await waitFor(() => expect(flattenStyle({ testID: 'mp' }).transform).toBeUndefined());
    expect(flattenStyle({ testID: 'mp' }).opacity).toBeDefined();
  });

  it('감소 모션이 꺼져 있으면 transform(scale)이 적용된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(
      <MotionPressable testID="mp" onPress={jest.fn()}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    await waitFor(() => expect(flattenStyle({ testID: 'mp' }).transform).toBeDefined());
  });

  it('소비처 style을 유지한다(레이아웃·토큰 스타일 보존)', () => {
    renderWithTheme(
      <MotionPressable testID="mp" style={{ backgroundColor: 'rgb(51, 102, 255)', padding: 12 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    const flat = flattenStyle({ testID: 'mp' });
    expect(flat.backgroundColor).toBe('rgb(51, 102, 255)');
    expect(flat.padding).toBe(12);
  });

  it('소비처가 넘긴 onPressIn/onPressOut도 함께 호출한다', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    renderWithTheme(
      <MotionPressable testID="mp" onPressIn={onPressIn} onPressOut={onPressOut}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    const target = screen.getByTestId('mp');
    fireEvent(target, 'pressIn');
    fireEvent(target, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('연타해도 예외 없이 매번 onPress가 발화한다(E5 재타게팅)', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <MotionPressable testID="mp" onPress={onPress}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    const target = screen.getByTestId('mp');
    [1, 2, 3].forEach(() => {
      fireEvent(target, 'pressIn');
      fireEvent(target, 'pressOut');
      fireEvent.press(target);
    });
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('래핑 뷰를 추가하지 않는다 — children 바깥에 여분의 View가 없다', () => {
    renderWithTheme(
      <MotionPressable testID="mp">
        <View testID="child" />
      </MotionPressable>,
    );
    // 눌림 대상 자신이 children의 직접 부모다(레이아웃·safe-area 회귀 0 조건).
    // children은 문자열 노드 또는 엘리먼트다 — 직접 자식의 testID만 모아 본다.
    const directChildIds = screen
      .getByTestId('mp')
      .children.map((child: unknown) =>
        typeof child === 'string' ? child : (child as { props?: { testID?: string } }).props?.testID,
      );
    expect(directChildIds).toContain('child');
  });
});

// 스타일 합성 계약(qa-visual F2) — motionStyle이 배열 마지막이라 소비처가 style로 준 정적 opacity는 무시된다.
//   조용히 깨지지 않도록 개발 중에 드러낸다(Sheet의 useSheetScrollGesture 경고 선례와 같은 방식).
describe('MotionPressable — 정적 opacity 오용 경고', () => {
  afterEach(() => jest.restoreAllMocks());

  it('style로 dim(opacity<1)을 넘기면 개발 중 경고한다', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderWithTheme(
      <MotionPressable testID="mp" onPress={jest.fn()} style={{ opacity: 0.5 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    expect(warnSpy).toHaveBeenCalledWith(MOTION_PRESSABLE_STATIC_OPACITY_WARNING);
  });

  it('평상 불투명도가 1이거나 opacity를 넘기지 않으면 경고하지 않는다', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderWithTheme(
      <MotionPressable testID="mp" onPress={jest.fn()} style={{ opacity: 1, padding: 12 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    renderWithTheme(
      <MotionPressable testID="mp2" onPress={jest.fn()} style={{ padding: 12 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('disabled면 소비처 opacity가 실제로 쓰이므로 경고하지 않는다', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderWithTheme(
      <MotionPressable testID="mp" disabled onPress={jest.fn()} style={{ opacity: 0.45 }}>
        <Text>저장</Text>
      </MotionPressable>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
