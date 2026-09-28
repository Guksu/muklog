// src/components/MotionPressable/MotionPressable.spec.tsx
// 프레스 피드백 공용 래퍼 — plan §5-1 T3. **호출자 관점 계약만** 검증한다.
//   Animated.Value의 중간 값·스프링 궤적은 테스트하지 않는다(plan §5-2) — 감소 모션 분기와 props 통과만 잠근다.
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { PRESS_SCALE, PRESSED_OPACITY } from '@/theme';

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

// 감소 모션 최소 피드백 바닥값(plan §5-1 T5·T6, P3) — 감소 모션에서는 스케일이 제거되므로
//   불투명도가 유일한 피드백 수단이 된다. 킷대로 `pressedOpacity={1}`을 준 소비처(지도 오버레이 2종)가
//   감소 모션 사용자에게 "아무 반응 없음"이 되지 않는지를 잠근다.
//   읽는 것은 **눌림이 정착한 뒤의 스타일 값 하나**다 — 보간 중간값·스프링 궤적은 읽지 않는다(plan §5-2).
describe('MotionPressable — 감소 모션 눌림 피드백 바닥값', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const renderPressed = async ({
    reduceMotion,
    pressedOpacity,
  }: {
    reduceMotion: boolean;
    pressedOpacity: number;
  }) => {
    mockReduceMotion({ enabled: reduceMotion });
    renderWithTheme(
      <MotionPressable testID="mp" pressSize="fab" pressedOpacity={pressedOpacity}>
        <Text>내 위치로 이동</Text>
      </MotionPressable>,
    );
    // 감소 모션 조회는 비동기다 — 분기가 반영된 뒤에 눌러야 한다.
    await waitFor(() =>
      expect(flattenStyle({ testID: 'mp' }).transform === undefined).toBe(reduceMotion),
    );
    fireEvent(screen.getByTestId('mp'), 'pressIn');
    // 누름 60ms가 끝나 값이 정착한 뒤의 스타일만 본다(중간 프레임 아님).
    act(() => {
      jest.advanceTimersByTime(200);
    });
    return flattenStyle({ testID: 'mp' });
  };

  it('감소 모션 ON + pressedOpacity 1이어도 눌림 피드백이 남는다(바닥값 적용 — T5)', async () => {
    const pressedStyle = await renderPressed({ reduceMotion: true, pressedOpacity: 1 });
    expect(pressedStyle.transform).toBeUndefined();
    expect(pressedStyle.opacity).toBeCloseTo(PRESSED_OPACITY.reduceMotionFloor, 5);
  });

  it('감소 모션 ON이어도 바닥값보다 진한 소비처 값은 그대로다(기존 소비처 동작 불변)', async () => {
    const pressedStyle = await renderPressed({ reduceMotion: true, pressedOpacity: 0.6 });
    expect(pressedStyle.opacity).toBeCloseTo(0.6, 5);
  });

  it('감소 모션 OFF에서는 pressedOpacity 1이 그대로다 — 스케일만(킷 값 정확 — T6)', async () => {
    const pressedStyle = await renderPressed({ reduceMotion: false, pressedOpacity: 1 });
    expect(pressedStyle.opacity).toBeCloseTo(1, 5);
    expect(pressedStyle.transform).toBeDefined();
  });

  it('감소 모션 OFF에서 기존 소비처 값(0.6)도 그대로다', async () => {
    const pressedStyle = await renderPressed({ reduceMotion: false, pressedOpacity: 0.6 });
    expect(pressedStyle.opacity).toBeCloseTo(0.6, 5);
  });
});

// 비활성 전환이 끊은 복귀(map-nearby-feedback qa-visual QV-1) — 손을 뗀 이벤트 안에서 소비처가 곧바로 disabled로 바꾸면
//   (재검색 pill: 탭 → 검색 중) 눌림 스타일이 떨어지며 RN이 progress의 복귀 스프링을 멈춘다(detach → stopAnimation).
//   다시 활성화될 때 멈춘 눌림 값이 그대로 그려지면 "눌린 채 굳은" 버튼이 된다. 눌림 표시는 지금 누르고 있을 때만 —
//   웹 :active처럼(fe-skills press-feedback), 중단된 모션은 평상에서 다시 출발한다(fe-craft #6·#8).
//   읽는 것은 **정착한 스타일 값**뿐이다(스프링 궤적은 읽지 않는다 — plan §5-2 규율 승계).
describe('MotionPressable — 눌림 중 비활성 전환 뒤 평상 복귀', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const renderFabPill = ({ disabled }: { disabled: boolean }) => (
    <MotionPressable testID="mp" pressSize="fab" pressedOpacity={1} disabled={disabled}>
      <Text>이 지역에서 검색</Text>
    </MotionPressable>
  );

  /** 누름이 정착한 뒤 손을 떼고, 같은 틱에 disabled → 한참 뒤 다시 활성화했을 때의 스타일을 돌려준다. */
  const pressReleaseDisableEnable = async ({ reduceMotion }: { reduceMotion: boolean }) => {
    mockReduceMotion({ enabled: reduceMotion });
    const { rerender } = renderWithTheme(renderFabPill({ disabled: false }));
    await waitFor(() =>
      expect(flattenStyle({ testID: 'mp' }).transform === undefined).toBe(reduceMotion),
    );
    fireEvent(screen.getByTestId('mp'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    const pressedStyle = flattenStyle({ testID: 'mp' });
    // 복귀 스프링이 시작된 바로 그 틱에 비활성으로 바뀐다(시간을 흘리지 않는다).
    fireEvent(screen.getByTestId('mp'), 'pressOut');
    rerender(renderFabPill({ disabled: true }));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    rerender(renderFabPill({ disabled: false }));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    return { pressedStyle, restStyle: flattenStyle({ testID: 'mp' }) };
  };

  it('감소 모션 OFF — 다시 활성화되면 축소(fab 0.92)가 남지 않고 scale 1이다', async () => {
    const { pressedStyle, restStyle } = await pressReleaseDisableEnable({ reduceMotion: false });
    // 전제: 누름이 실제로 축소까지 갔다(공허한 green 방지).
    expect(pressedStyle.transform).toEqual([{ scale: PRESS_SCALE.fab }]);
    expect(restStyle.transform).toEqual([{ scale: 1 }]);
    expect(restStyle.opacity).toBeCloseTo(1, 5);
  });

  it('감소 모션 ON — 다시 활성화되면 흐림(바닥값 0.85)이 남지 않고 opacity 1이다', async () => {
    const { pressedStyle, restStyle } = await pressReleaseDisableEnable({ reduceMotion: true });
    expect(pressedStyle.opacity).toBeCloseTo(PRESSED_OPACITY.reduceMotionFloor, 5);
    expect(restStyle.transform).toBeUndefined();
    expect(restStyle.opacity).toBeCloseTo(1, 5);
  });
});
