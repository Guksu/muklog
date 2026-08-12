// src/components/Sheet/Sheet.spec.tsx
// 공용 하단 시트 — 기존(visible 토글·title/children·딤 탭·패널 탭) + 드래그 dismiss(sheet-drag-dismiss).
//   순수 유틸(U1~U3)은 단위로, panHandlers 배선(D1~D8)은 실제 노드 props를 통해 검증한다.
//   실제 터치 협상(ScrollView·Pressable 경합)은 단위 대상이 아니다 → dev-notes 스모크 S1~S16.
import { readFileSync } from 'fs';
import { join } from 'path';

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import {
  resolveBackdropOpacity,
  Sheet,
  SHEET_BACKDROP_FADE_DISTANCE,
  SHEET_BACKDROP_OPACITY,
  SHEET_BACKDROP_OPACITY_MIN,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_DURATION,
  SHEET_DISMISS_TRANSLATE,
  SHEET_DISMISS_VELOCITY,
  SHEET_DRAG_ACTIVATE_DY,
  SHEET_FLICK_MIN_DISTANCE,
  SHEET_SNAP_BACK_SPRING,
  shouldDismissSheet,
  shouldStartSheetDrag,
} from './Sheet';

describe('shouldDismissSheet — 드래그 릴리스 닫기 판정 (U1)', () => {
  it.each([
    ['거리 초과', { dy: 81, vy: 0 }, true],
    ['거리 경계(같음)는 닫지 않는다', { dy: 80, vy: 0 }, false],
    ['플릭 성립(거리 24 초과 + 속도 초과)', { dy: 40, vy: 0.6 }, true],
    ['플릭 최소거리 미달', { dy: 10, vy: 0.6 }, false],
    ['플릭 거리 경계(같음)', { dy: 24, vy: 0.6 }, false],
    ['플릭 거리 경계 초과', { dy: 25, vy: 0.6 }, true],
    ['속도 경계(같음)', { dy: 40, vy: 0.5 }, false],
    ['속도 경계 초과', { dy: 40, vy: 0.51 }, true],
    ['위로 끈 상태는 아무리 빨라도 닫지 않는다', { dy: -100, vy: 5 }, false],
    ['제자리', { dy: 0, vy: 0 }, false],
    ['아래로 충분히 끌었다 위로 튕김(거리 조건 단독 성립)', { dy: 100, vy: -2 }, true],
  ])('%s → %p', (_label, gesture, expected) => {
    expect(shouldDismissSheet(gesture)).toBe(expected);
  });

  // U1-j — 불변식: 위로 끌었거나 제자리면(dy<=0) 속도와 무관하게 절대 닫지 않는다(B1).
  //   판정식의 어느 절이 이 행동을 만드는지와 무관하게 행동 자체를 고정한다
  //   (`dy > 0` 절은 현재 두 분기의 거리 조건에 가려 dead지만, 이 불변식은 항상 load-bearing이다 — plan §6 E11).
  it('dy<=0 · vy 전 구간 조합 100개에서 한 번도 닫지 않는다', () => {
    const steps = 10;
    for (let dyStep = 0; dyStep < steps; dyStep += 1) {
      for (let vyStep = 0; vyStep < steps; vyStep += 1) {
        const dy = -300 + dyStep * (300 / (steps - 1)); // -300 … 0
        const vy = -5 + vyStep * (10 / (steps - 1)); //    -5 … +5
        expect(shouldDismissSheet({ dy, vy })).toBe(false);
      }
    }
  });

  it('임계는 상수에서 온다(리터럴 재기입이 아님)', () => {
    expect(shouldDismissSheet({ dy: SHEET_DISMISS_DISTANCE + 1, vy: 0 })).toBe(true);
    expect(shouldDismissSheet({ dy: SHEET_DISMISS_DISTANCE, vy: 0 })).toBe(false);
    expect(
      shouldDismissSheet({ dy: SHEET_FLICK_MIN_DISTANCE + 1, vy: SHEET_DISMISS_VELOCITY + 0.01 }),
    ).toBe(true);
    expect(
      shouldDismissSheet({ dy: SHEET_FLICK_MIN_DISTANCE, vy: SHEET_DISMISS_VELOCITY + 0.01 }),
    ).toBe(false);
  });
});

describe('shouldStartSheetDrag — 드래그 활성화 게이트 (U1-b)', () => {
  it.each([
    ['아래로 임계 초과 + 세로 우세', { dy: 10, dx: 2 }, true],
    ['이동량 임계 미달', { dy: 2, dx: 0 }, false],
    ['가로 우세', { dy: 10, dx: 40 }, false],
    ['위로', { dy: -20, dx: 0 }, false],
    ['임계 경계(같음)', { dy: SHEET_DRAG_ACTIVATE_DY, dx: 0 }, false],
    ['축 경합(같음)은 세로 우세가 아니다', { dy: 10, dx: 10 }, false],
  ])('%s → %p', (_label, gesture, expected) => {
    expect(shouldStartSheetDrag(gesture)).toBe(expected);
  });
});

describe('resolveBackdropOpacity — 드래그 추종 딤 페이드 (U2)', () => {
  it('정지 상태는 킷 딤 값 그대로다', () => {
    expect(resolveBackdropOpacity({ dy: 0 })).toBe(SHEET_BACKDROP_OPACITY);
  });

  it('페이드 구간 중간은 선형 보간이다', () => {
    // 0.32 → 0.10의 중간. 부동소수라 근사 비교(값 자체는 0.21).
    expect(resolveBackdropOpacity({ dy: SHEET_BACKDROP_FADE_DISTANCE / 2 })).toBeCloseTo(0.21, 10);
  });

  it('페이드 거리 끝은 최소값이다', () => {
    expect(resolveBackdropOpacity({ dy: SHEET_BACKDROP_FADE_DISTANCE })).toBe(
      SHEET_BACKDROP_OPACITY_MIN,
    );
  });

  it('양 끝을 클램프한다', () => {
    expect(resolveBackdropOpacity({ dy: 9999 })).toBe(SHEET_BACKDROP_OPACITY_MIN);
    expect(resolveBackdropOpacity({ dy: -50 })).toBe(SHEET_BACKDROP_OPACITY);
  });

  it('단조 비증가다(내릴수록 옅어지기만 한다)', () => {
    let previous = resolveBackdropOpacity({ dy: -10 });
    for (let dy = 0; dy <= 300; dy += 7) {
      const current = resolveBackdropOpacity({ dy });
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('인터랙션 파라미터 상수 (U3)', () => {
  it('plan §3-B의 값과 일치한다', () => {
    expect(SHEET_DRAG_ACTIVATE_DY).toBe(4);
    expect(SHEET_DISMISS_DISTANCE).toBe(80);
    expect(SHEET_DISMISS_VELOCITY).toBe(0.5);
    expect(SHEET_FLICK_MIN_DISTANCE).toBe(24);
    expect(SHEET_DISMISS_TRANSLATE).toBe(700);
    expect(SHEET_DISMISS_DURATION).toBe(200);
    expect(SHEET_SNAP_BACK_SPRING).toEqual({ bounciness: 0, speed: 14 });
    expect(SHEET_BACKDROP_OPACITY).toBe(0.32);
    expect(SHEET_BACKDROP_OPACITY_MIN).toBe(0.1);
    expect(SHEET_BACKDROP_FADE_DISTANCE).toBe(240);
  });

  // U3-b — B1(위로 끈 상태 dismiss 차단)을 실제로 만드는 값이 이것이다.
  //   0으로 낮추면 판정식의 `dy > 0` 절이 유일한 방어선이 되므로, 그 시점을 red로 알린다.
  it('플릭 최소거리는 0보다 크다(위로 끈 상태 dismiss를 막는 실질 방어선)', () => {
    expect(SHEET_FLICK_MIN_DISTANCE).toBeGreaterThan(0);
  });
});

describe('Sheet', () => {
  it('visible=false면 children을 렌더하지 않는다', () => {
    renderWithTheme(
      <Sheet visible={false} onClose={() => {}} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.queryByText('무엇을 할까요?')).toBeNull();
    expect(screen.queryByText('액션')).toBeNull();
  });

  it('visible=true면 title과 children을 렌더한다', () => {
    renderWithTheme(
      <Sheet visible onClose={() => {}} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.getByText('무엇을 할까요?')).toBeTruthy();
    expect(screen.getByText('액션')).toBeTruthy();
  });

  it('딤 배경(backdrop) 탭 시 onClose를 호출한다', () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('패널 내부 탭은 onClose를 호출하지 않는다', () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId('sheet-panel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('딤 배경은 닫기 접근성 경로를 유지한다', () => {
    renderWithTheme(
      <Sheet visible onClose={() => {}}>
        <Text>액션</Text>
      </Sheet>,
    );
    const backdrop = screen.getByTestId('sheet-backdrop');
    expect(backdrop.props.accessibilityRole).toBe('button');
    expect(backdrop.props.accessibilityLabel).toBe('닫기');
  });
});

// PanResponder는 gestureState를 "직전 좌표 → 현재 좌표" 델타로 누적하고, 이벤트마다
// touchHistory.mostRecentTimeStamp가 증가해야 early-return 가드(PanResponder.js:513-519)를 통과한다.
// numberActiveTouches=1이면 TouchHistoryMath가 touchBank[indexOfSingleActiveTouch]를 역참조하므로
// 실제 형태로 채운다(rating-drag dev-notes §4의 노하우 재사용).
let touchTimeStamp = 0;

/**
 * 합성 responder 이동 이벤트를 만든다.
 * @param dy 이번 이벤트의 세로 이동량(px, 아래로 +) — gestureState.dy에 누적된다
 * @param dx 이번 이벤트의 가로 이동량(px)
 * @param dt 타임스탬프 증가폭(ms) — 속도는 이동량/dt로 계산된다(vy = dy/dt)
 */
const moveEvent = ({ dy, dx = 0, dt = 1 }: { dy: number; dx?: number; dt?: number }) => {
  touchTimeStamp += dt;
  return {
    nativeEvent: {
      pageX: dx,
      pageY: dy,
      locationX: 0,
      locationY: 0,
      identifier: 0,
      timestamp: touchTimeStamp,
      touches: [{}],
      changedTouches: [{}],
    },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: touchTimeStamp,
      touchBank: [
        {
          touchActive: true,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: dx,
          currentPageY: dy,
          currentTimeStamp: touchTimeStamp,
          previousPageX: 0,
          previousPageY: 0,
          previousTimeStamp: touchTimeStamp - dt,
        },
      ],
    },
  };
};

describe('Sheet — 패널 드래그 dismiss (D1~D8)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    touchTimeStamp = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderSheet = ({ onClose = jest.fn() }: { onClose?: jest.Mock } = {}) => {
    const view = renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    return { onClose, rerender: view.rerender };
  };

  const panel = () => screen.getByTestId('sheet-panel');

  const panelTranslateY = () =>
    StyleSheet.flatten(panel().props.style).transform[0].translateY as number;

  const backdropOpacity = () =>
    StyleSheet.flatten(screen.getByTestId('sheet-backdrop').props.style).opacity as number;

  /** 실제 배선으로 드래그 획득을 시도한다. 캡처 단계가 gestureState를 갱신하므로 먼저 호출한다. */
  const askToStartDrag = ({ dy, dx = 0 }: { dy: number; dx?: number }) => {
    const event = moveEvent({ dy, dx });
    const capturedByPanel = panel().props.onMoveShouldSetResponderCapture(event) as boolean;
    const grantedToPanel = panel().props.onMoveShouldSetResponder(event) as boolean;
    return { capturedByPanel, grantedToPanel };
  };

  const dragBy = ({ dy, dt = 1 }: { dy: number; dt?: number }) => {
    act(() => {
      panel().props.onResponderMove(moveEvent({ dy, dt }));
    });
  };

  const release = () => {
    act(() => {
      panel().props.onResponderRelease(moveEvent({ dy: 0 }));
    });
  };

  const runAnimations = ({ ms = SHEET_DISMISS_DURATION + 50 }: { ms?: number } = {}) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  it('D1 — panHandlers가 핸들이 아니라 패널에 붙는다', () => {
    renderSheet();
    expect(typeof panel().props.onMoveShouldSetResponder).toBe('function');
    expect(typeof panel().props.onResponderMove).toBe('function');
    expect(typeof panel().props.onResponderRelease).toBe('function');

    const handle = screen.getByTestId('sheet-handle');
    expect(handle.props.onMoveShouldSetResponder).toBeUndefined();
    expect(handle.props.onResponderMove).toBeUndefined();
    expect(handle.props.onResponderRelease).toBeUndefined();
  });

  it.each([
    ['아래로 충분히 + 세로 우세', { dy: 10, dx: 2 }, true],
    ['임계 미달', { dy: 2, dx: 0 }, false],
    ['가로 우세', { dy: 10, dx: 40 }, false],
    ['위로', { dy: -20, dx: 0 }, false],
  ])('D2 — 활성화 게이트: %s → %p', (_label, gesture, expected) => {
    renderSheet();
    expect(askToStartDrag(gesture).grantedToPanel).toBe(expected);
  });

  it('D3 — 캡처 단계로는 절대 가져가지 않는다(자식 ScrollView 우선)', () => {
    renderSheet();
    // 비캡처 게이트는 통과하는 제스처인데도 캡처 단계는 false여야 한다.
    const { capturedByPanel, grantedToPanel } = askToStartDrag({ dy: 60 });
    expect(capturedByPanel).toBe(false);
    expect(grantedToPanel).toBe(true);
  });

  it('D3-b — 소스에 캡처 계열 config 키가 없다', () => {
    // panHandlers는 config와 무관하게 onMoveShouldSetResponderCapture 래퍼를 항상 만든다.
    // 따라서 "캡처 미사용"은 노드 props로 증명할 수 없고, config 키 부재로 고정한다.
    // 주석 안의 서술이 오탐을 만들지 않도록 주석을 제거한 뒤 검사한다.
    const source = readFileSync(join(__dirname, 'Sheet.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');
    expect(source).not.toMatch(/onMoveShouldSetPanResponderCapture/);
    expect(source).not.toMatch(/onStartShouldSetPanResponderCapture/);
  });

  // O1·O2 — 값·판정의 단일출처는 "같은 값을 두 번 쓰지 않는다"는 구조 규약이라 동작으로는 관측되지 않는다
  //   (딤 outputRange를 리터럴 [0.32, 0.1]로 되돌리거나 게이트에 판정식을 인라인해도 현재 값이 같아 전부 green).
  //   상수가 바뀌는 미래의 리팩터에서만 어긋나므로, D3-b와 같은 방식으로 참조 자체를 고정한다.
  it('O1·O2 — 딤 outputRange와 활성화 게이트가 유틸을 참조한다(값 이중화 방지)', () => {
    const source = readFileSync(join(__dirname, 'Sheet.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');
    expect(source).toMatch(/outputRange:\s*\[[^\]]*resolveBackdropOpacity\(/);
    expect(source).toMatch(/shouldStartSheetDrag\(\s*\{/);
  });

  it('D4 — 손가락을 따라 내려오고, 위로는 솟지 않는다', () => {
    renderSheet();
    expect(panelTranslateY()).toBe(0);

    dragBy({ dy: 60 });
    expect(panelTranslateY()).toBe(60);

    dragBy({ dy: -50 });
    expect(panelTranslateY()).toBe(10); // 손가락을 되돌리면 따라 올라오되 시작점까지만

    dragBy({ dy: -100 });
    expect(panelTranslateY()).toBe(0); // 시작점 위로는 솟지 않는다(0 클램프)
  });

  it('D4-b — 딤이 드래그를 따라 옅어진다', () => {
    renderSheet();
    expect(backdropOpacity()).toBeCloseTo(SHEET_BACKDROP_OPACITY, 10);

    dragBy({ dy: SHEET_BACKDROP_FADE_DISTANCE / 2 });
    expect(backdropOpacity()).toBeCloseTo(resolveBackdropOpacity({ dy: 120 }), 10);

    dragBy({ dy: SHEET_BACKDROP_FADE_DISTANCE });
    expect(backdropOpacity()).toBeCloseTo(SHEET_BACKDROP_OPACITY_MIN, 10);
  });

  it('D5 — 획득한 드래그는 양보하지 않고, 강제 종료되면 제자리로 돌아온다', () => {
    renderSheet();
    expect(panel().props.onResponderTerminationRequest(moveEvent({ dy: 0 }))).toBe(false);

    dragBy({ dy: 60 });
    expect(panelTranslateY()).toBe(60);

    act(() => {
      panel().props.onResponderTerminate(moveEvent({ dy: 0 }));
    });
    runAnimations({ ms: 2000 });
    expect(panelTranslateY()).toBe(0);
  });

  it('D5-b — 임계 미달로 놓으면 제자리로 스냅백한다', () => {
    const { onClose } = renderSheet();
    dragBy({ dy: 30, dt: 100 }); // vy = 0.3 → 속도 미달
    release();
    runAnimations({ ms: 2000 });

    expect(panelTranslateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('D6 — 거리 임계를 넘겨 놓으면 애니메이션 완료 후 onClose가 정확히 1회', () => {
    const { onClose } = renderSheet();
    dragBy({ dy: SHEET_DISMISS_DISTANCE + 20, dt: 100 });
    release();
    expect(onClose).not.toHaveBeenCalled(); // 아직 닫히는 중

    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);

    runAnimations({ ms: 2000 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D6-b — 플릭(짧지만 빠르게)으로도 닫힌다', () => {
    const { onClose } = renderSheet();
    dragBy({ dy: SHEET_FLICK_MIN_DISTANCE + 16, dt: 10 }); // vy = 4.0
    release();
    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D7 — 닫히는 동안 재터치·딤 탭을 무시한다(onClose 총 1회)', () => {
    const { onClose } = renderSheet();
    dragBy({ dy: SHEET_DISMISS_DISTANCE + 20, dt: 100 });
    release();

    expect(askToStartDrag({ dy: 60 }).grantedToPanel).toBe(false);
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // D9 — 중단된 닫힘은 onClose를 내보내지 않는다.
  //   RN은 애니메이션이 중단될 때도 완료 콜백을 부른다(`AnimatedValue.setValue()` → `_animation.stop()`
  //   → `TimingAnimation.stop()`이 `{finished: false}`로 발화). 재오픈이 닫힘을 끊으면 방금 연 시트가
  //   즉시 "닫으라"는 통보를 받게 되므로 `finished`를 확인해야 한다.
  it('D9 — 닫히는 도중 재오픈되면 중단된 닫힘이 onClose를 내보내지 않는다', () => {
    const onClose = jest.fn();
    const { rerender } = renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    dragBy({ dy: SHEET_DISMISS_DISTANCE + 20, dt: 100 });
    release();
    runAnimations({ ms: 50 }); // 닫힘 애니메이션 진행 중(200ms 중 50ms)

    rerender(
      <Sheet visible={false} onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    rerender(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );

    expect(onClose).not.toHaveBeenCalled();
    runAnimations({ ms: 2000 });
    expect(onClose).not.toHaveBeenCalled();
    expect(panelTranslateY()).toBe(0); // 재오픈된 시트는 제자리에 있다

    // 중단 경로에서 closingRef가 풀렸는지 — 재오픈된 시트는 다시 드래그로 닫을 수 있어야 한다.
    expect(askToStartDrag({ dy: 60 }).grantedToPanel).toBe(true);
    dragBy({ dy: SHEET_DISMISS_DISTANCE + 20 });
    release();
    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1); // 중단분은 안 세고, 이번 닫힘만 1회
  });

  it('D8 — 다시 열면 오프셋이 0으로 리셋된다', () => {
    const onClose = jest.fn();
    const { rerender } = renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    dragBy({ dy: 60 });
    expect(panelTranslateY()).toBe(60);

    // 부모가 onClose를 무시해 시트가 안 닫힌 채 닫힘→재오픈된 상황.
    rerender(
      <Sheet visible={false} onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    rerender(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(panelTranslateY()).toBe(0);
  });
});
