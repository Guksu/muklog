// src/components/SwapTransition/SwapTransition.spec.tsx
// 한 화면 안의 뷰 교체 전환 — plan §5-1 T4. 렌더 결과·입력 가능 여부만 본다(Animated 궤적은 §5-2로 제외).
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MotionPressable } from '../MotionPressable';
import { SwapDirection, SwapTransition, SWAP_TRANSITION_TEST_ID } from './SwapTransition';

const rootStyle = () =>
  StyleSheet.flatten(screen.getByTestId(SWAP_TRANSITION_TEST_ID).props.style) as Record<
    string,
    unknown
  >;

describe('SwapTransition', () => {
  afterEach(() => jest.restoreAllMocks());

  it('최초 마운트에서는 애니메이션하지 않는다(불투명도 1로 시작 — 스택 전환 위 이중 모션 방지)', () => {
    renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    expect(screen.getByText('폼')).toBeTruthy();
    expect(rootStyle().opacity).toBe(1);
  });

  it('swapKey가 바뀌면 새 children이 즉시 조회된다', () => {
    const { rerender } = renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    rerender(
      <SwapTransition swapKey="search" direction={SwapDirection.Forward}>
        <Text>장소 검색</Text>
      </SwapTransition>,
    );
    expect(screen.getByText('장소 검색')).toBeTruthy();
    expect(screen.queryByText('폼')).toBeNull();
  });

  it('전환 직후에도 새 children의 탭이 동작한다(전환이 입력을 막지 않는다)', () => {
    const onPress = jest.fn();
    const { rerender } = renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    rerender(
      <SwapTransition swapKey="search" direction={SwapDirection.Forward}>
        <MotionPressable testID="result-row" onPress={onPress}>
          <Text>맛있는 국수집</Text>
        </MotionPressable>
      </SwapTransition>,
    );
    fireEvent.press(screen.getByTestId('result-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('같은 swapKey로 다시 렌더하면 진입을 재생하지 않는다', () => {
    const { rerender } = renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    rerender(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    expect(screen.getByText('폼')).toBeTruthy();
    expect(rootStyle().opacity).toBe(1);
  });

  it('방향에 따라 진입 위치가 갈린다(forward=오른쪽에서 / back=왼쪽에서)', () => {
    const { rerender } = renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    rerender(
      <SwapTransition swapKey="search" direction={SwapDirection.Forward}>
        <Text>장소 검색</Text>
      </SwapTransition>,
    );
    const forwardX = (rootStyle().transform as { translateX: number }[])[0].translateX;
    expect(forwardX).toBeGreaterThan(0);

    rerender(
      <SwapTransition swapKey="form" direction={SwapDirection.Back}>
        <Text>폼</Text>
      </SwapTransition>,
    );
    const backX = (rootStyle().transform as { translateX: number }[])[0].translateX;
    expect(backX).toBeLessThan(0);
  });

  it('감소 모션이면 가로 이동 없이 페이드만 남는다(fe-craft #8)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    const { rerender } = renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    await waitFor(() => expect(rootStyle().transform).toBeUndefined());
    rerender(
      <SwapTransition swapKey="search" direction={SwapDirection.Forward}>
        <Text>장소 검색</Text>
      </SwapTransition>,
    );
    expect(rootStyle().transform).toBeUndefined();
    expect(rootStyle().opacity).toBeDefined();
  });

  it('래퍼가 부모 레이아웃을 바꾸지 않는다(flex:1 채움)', () => {
    renderWithTheme(
      <SwapTransition swapKey="form">
        <Text>폼</Text>
      </SwapTransition>,
    );
    expect(rootStyle().flex).toBe(1);
  });
});
