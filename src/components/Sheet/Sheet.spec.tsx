// src/components/Sheet/Sheet.spec.tsx
// 공용 하단 시트 — 기존(visible 토글·title/children·딤 탭·패널 탭) + 드래그 dismiss(sheet-drag-rework).
//   순수 유틸(U1~U3)은 단위로, 제스처 배선(G1~G3·D1~D10)은 RNGH 공식 테스트 유틸로 실제 이벤트를 흘려 검증한다.
//   실제 터치 협상(ScrollView·Pressable 경합, Modal 안 네이티브 제스처 루트)은 단위 대상이 아니다
//   → dev-notes 디바이스 스모크 S1~S18.
import { readFileSync } from 'fs';
import { join } from 'path';

import React from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text } from 'react-native';
import { State, type NativeGesture, type PanGesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MOTION_DISTANCE, MOTION_DURATION } from '@/theme';
import { renderWithTheme } from '@/test/renderWithTheme';

import {
  resolveBackdropOpacity,
  Sheet,
  SHEET_ENTER_DURATION,
  SHEET_ENTER_TRANSLATE,
  SHEET_BACKDROP_FADE_DISTANCE,
  SHEET_BACKDROP_OPACITY,
  SHEET_BACKDROP_OPACITY_MIN,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_DURATION,
  SHEET_DISMISS_TRANSLATE,
  SHEET_DISMISS_VELOCITY,
  SHEET_DRAG_ACTIVATE_DY,
  SHEET_DRAG_FAIL_UP_DY,
  SHEET_DRAG_GESTURE_TEST_ID,
  SHEET_FLICK_MIN_DISTANCE,
  SHEET_SCROLL_GESTURE_OUT_OF_SHEET_WARNING,
  SHEET_SNAP_BACK_SPRING,
  SHEET_VELOCITY_MS_PER_SECOND,
  shouldDismissSheet,
  shouldStartSheetDrag,
  useSheetScrollGesture,
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

describe('shouldStartSheetDrag — 드래그 추종 게이트 (U1-b)', () => {
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

  it('RNGH 전용 상수도 계약값이다(위로 끌기 양보 거리·속도 단위 환산)', () => {
    expect(SHEET_DRAG_FAIL_UP_DY).toBe(8);
    expect(SHEET_VELOCITY_MS_PER_SECOND).toBe(1000);
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

// 소스 문자열 고정 — 렌더 결과로는 관측되지 않지만 실기기 동작을 좌우하는 구조 규약들.
//   (JS 레이어의 responder 협상 대신 네이티브 제스처를 쓴다는 결정 자체가 이 스프린트의 본체다.)
const sheetSourceWithoutComments = () =>
  readFileSync(join(__dirname, 'Sheet.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

describe('Sheet — 제스처 수단·구조 규약 (G1~G3)', () => {
  it('G1 — 드래그를 PanResponder(JS responder 협상)로 처리하지 않는다', () => {
    // 실기기에서 전 시트가 끌리지 않았던 구현이 정확히 이것이다(sheet-drag-rework 원인 분석).
    const source = sheetSourceWithoutComments();
    expect(source).not.toMatch(/PanResponder/);
    expect(source).not.toMatch(/panHandlers/);
  });

  it('G2 — Modal 내용물을 GestureHandlerRootView로 다시 감싼다(Android Modal 함정)', () => {
    // Android에서 Modal은 별도 네이티브 윈도우라 앱 루트의 제스처 컨텍스트가 닿지 않는다.
    // 이게 빠지면 제스처가 조용히 무동작한다 — 렌더 트리로는 드러나지 않아 소스로 고정한다.
    const source = sheetSourceWithoutComments();
    expect(source).toMatch(/<Modal[\s\S]*?<GestureHandlerRootView[\s\S]*?<\/Modal>/);
  });

  it('G3 — 딤 outputRange와 추종 게이트가 유틸을 참조한다(값 이중화 방지)', () => {
    const source = sheetSourceWithoutComments();
    expect(source).toMatch(/outputRange:\s*\[[^\]]*resolveBackdropOpacity\(/);
    expect(source).toMatch(/shouldStartSheetDrag\(\s*\{/);
  });
});

// ⚠️ 여기 프로브는 훅을 **Sheet children 위치**에 둔다 = 훅이 동작하는 위치다.
//    그래서 S1은 **훅 단위 계약만** 증명하고, 실제 소비처가 그 위치에서 호출하는지는 **대신하지 못한다**
//    (sheet-drag-rework QA L1: LogPickerSheet가 Sheet의 부모에서 호출해 관계가 조용히 안 맺어졌는데 S1은 green이었다).
//    소비처 배선의 방어선은 `LogPickerSheet.spec.tsx`의 `Gesture.Native` 스파이 단언이다 — 둘 다 있어야 한다.
describe('useSheetScrollGesture — 본문 스크롤 우선권 (S1~S2)', () => {
  const renderScrollProbe = ({ inSheet }: { inSheet: boolean }) => {
    const captured: { gesture: NativeGesture | null } = { gesture: null };
    const ScrollProbe = () => {
      captured.gesture = useSheetScrollGesture();
      return <Text>본문</Text>;
    };
    renderWithTheme(
      inSheet ? (
        <Sheet visible onClose={() => {}}>
          <ScrollProbe />
        </Sheet>
      ) : (
        <ScrollProbe />
      ),
    );
    return captured;
  };

  it('S1 — 시트 안 스크롤 제스처는 시트 드래그를 블록한다(스크롤 우선)', () => {
    const captured = renderScrollProbe({ inSheet: true });
    const blocked = captured.gesture?.config.blocksHandlers as
      | { current?: { config: { testId?: string } } }[]
      | undefined;

    expect(blocked).toHaveLength(1);
    // 블록 대상이 이 시트의 드래그 제스처여야 한다(다른 제스처를 묶으면 스크롤이 죽는다).
    expect(blocked?.[0].current?.config.testId).toBe(SHEET_DRAG_GESTURE_TEST_ID);
  });

  it('S2 — 시트 밖(부모 위치) 호출은 관계를 못 맺고 경고한다(조용한 실패 방지)', () => {
    // 이게 조용히 지나가면 소비처가 Sheet의 부모에서 훅을 불러도 아무도 모른다(QA L1이 실제로 그랬다).
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const captured = renderScrollProbe({ inSheet: false });

    expect(captured.gesture?.config.blocksHandlers).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(SHEET_SCROLL_GESTURE_OUT_OF_SHEET_WARNING);
    warn.mockRestore();
  });
});

describe('Sheet — 패널 드래그 dismiss (D1~D10)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

  const dragGesture = () => getByGestureTestId(SHEET_DRAG_GESTURE_TEST_ID);

  /**
   * 실제 제스처 이벤트 스트림을 흘려보낸다(RNGH 공식 테스트 유틸 — DeviceEventEmitter 경유로 실 배선을 통과).
   *   ⚠️ RNGH의 pan 기본 페이로드는 `translationX: 100`·`velocityX: 3`이다(가로 우세 이벤트).
   *      세로 드래그를 표현하려면 가로 성분을 매번 0으로 눌러야 한다 — 그 기본값을 여기서 한 번에 덮는다.
   * @param events BEGAN/ACTIVE/END 부분 이벤트 목록. 누락된 상태 전이는 RNGH가 채운다.
   */
  const fireDrag = (
    events: Partial<{
      state: (typeof State)[keyof typeof State];
      translationX: number;
      translationY: number;
      velocityX: number;
      velocityY: number;
    }>[],
  ) => {
    const verticalEvents = events.map((event) => ({
      translationX: 0,
      velocityX: 0,
      velocityY: 0,
      ...event,
    }));
    act(() => {
      fireGestureHandler<PanGesture>(dragGesture(), verticalEvents);
    });
  };

  const runAnimations = ({ ms = SHEET_DISMISS_DURATION + 50 }: { ms?: number } = {}) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  it('D1 — 패널에 드래그 제스처가 붙고, 활성화 조건이 계약 상수에서 온다', () => {
    renderSheet();
    const gesture = dragGesture();
    // 아래로 SHEET_DRAG_ACTIVATE_DY 초과에서만 활성화(위 방향 활성화 값은 두지 않는다).
    expect(gesture.config.activeOffsetYEnd).toBe(SHEET_DRAG_ACTIVATE_DY);
    expect(gesture.config.activeOffsetYStart).toBeUndefined();
    // 위로 먼저 끌면 실패해 자식(리스트 스크롤 등)에게 넘어간다.
    expect(gesture.config.failOffsetYStart).toBe(-SHEET_DRAG_FAIL_UP_DY);
    // reanimated 미설치 환경 — 콜백은 JS 스레드에서 돈다.
    expect(gesture.config.runOnJS).toBe(true);
  });

  it('D2 — 핸들 영역은 별도 제스처를 갖지 않는다(패널 전체가 드래그 영역)', () => {
    renderSheet();
    const handle = screen.getByTestId('sheet-handle');
    expect(handle.props.onMoveShouldSetResponder).toBeUndefined();
    expect(handle.props.onResponderMove).toBeUndefined();
    expect(panel().props.onResponderMove).toBeUndefined();
  });

  it('D3 — 손가락을 따라 내려온다', () => {
    renderSheet();
    expect(panelTranslateY()).toBe(0);

    fireDrag([{ state: State.ACTIVE, translationY: 30 }, { state: State.ACTIVE, translationY: 60 }]);
    expect(panelTranslateY()).toBe(60);
  });

  it('D4 — 시작점 위로는 솟지 않는다(0 클램프)', () => {
    renderSheet();
    fireDrag([
      { state: State.ACTIVE, translationY: 60 },
      { state: State.ACTIVE, translationY: 10 },
      { state: State.ACTIVE, translationY: -100 },
    ]);
    expect(panelTranslateY()).toBe(0);
  });

  it('D5 — 가로 우세 제스처는 패널을 따라오게 하지 않는다', () => {
    renderSheet();
    fireDrag([{ state: State.ACTIVE, translationY: 10, translationX: 40 }]);
    expect(panelTranslateY()).toBe(0);
  });

  it('D6 — 딤이 드래그를 따라 옅어진다', () => {
    renderSheet();
    expect(backdropOpacity()).toBeCloseTo(SHEET_BACKDROP_OPACITY, 10);

    // 페이드 구간은 닫힘 거리(80)보다 멀다 — 릴리스하면 시트가 닫혀 다음 드래그를 못 본다.
    //   각 구간을 CANCELLED로 끝내 닫힘 없이 두 지점을 이어서 관측한다.
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_BACKDROP_FADE_DISTANCE / 2 },
      { state: State.CANCELLED, translationY: SHEET_BACKDROP_FADE_DISTANCE / 2 },
    ]);
    expect(backdropOpacity()).toBeCloseTo(
      resolveBackdropOpacity({ dy: SHEET_BACKDROP_FADE_DISTANCE / 2 }),
      10,
    );

    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_BACKDROP_FADE_DISTANCE },
      { state: State.CANCELLED, translationY: SHEET_BACKDROP_FADE_DISTANCE },
    ]);
    expect(backdropOpacity()).toBeCloseTo(SHEET_BACKDROP_OPACITY_MIN, 10);
  });

  it('D7 — 임계 미달로 놓으면 제자리로 스냅백한다', () => {
    const { onClose } = renderSheet();
    fireDrag([
      { state: State.ACTIVE, translationY: 30 },
      { state: State.END, translationY: 30, velocityY: 0 },
    ]);
    runAnimations({ ms: 2000 });

    expect(panelTranslateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('D8 — 강제 종료(CANCELLED)되면 제자리로 돌아온다', () => {
    const { onClose } = renderSheet();
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_DISMISS_DISTANCE + 20 },
      { state: State.CANCELLED, translationY: SHEET_DISMISS_DISTANCE + 20 },
    ]);
    runAnimations({ ms: 2000 });

    expect(panelTranslateY()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('D9 — 거리 임계를 넘겨 놓으면 애니메이션 완료 후 onClose가 정확히 1회', () => {
    const { onClose } = renderSheet();
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_DISMISS_DISTANCE + 20 },
      { state: State.END, translationY: SHEET_DISMISS_DISTANCE + 20, velocityY: 0 },
    ]);
    expect(onClose).not.toHaveBeenCalled(); // 아직 닫히는 중

    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);

    runAnimations({ ms: 2000 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D10 — 플릭 속도는 px/s로 들어와 px/ms 계약으로 환산된다', () => {
    // RNGH velocityY 단위는 px/s, 판정 계약(SHEET_DISMISS_VELOCITY)은 px/ms다.
    // 환산이 빠지면 0.51(px/s)로도 닫히거나(과민) 510(px/s)에도 안 닫힌다(무반응).
    const flickDistance = SHEET_FLICK_MIN_DISTANCE + 16;
    const { onClose } = renderSheet();

    // px/s 값이 임계 미만(0.6 px/s = 0.0006 px/ms) — 닫히면 안 된다.
    fireDrag([
      { state: State.ACTIVE, translationY: flickDistance },
      { state: State.END, translationY: flickDistance, velocityY: SHEET_DISMISS_VELOCITY + 0.1 },
    ]);
    runAnimations({ ms: 2000 });
    expect(onClose).not.toHaveBeenCalled();

    // 같은 거리에 임계를 넘는 px/s 속도 — 닫힌다.
    fireDrag([
      { state: State.ACTIVE, translationY: flickDistance },
      {
        state: State.END,
        translationY: flickDistance,
        velocityY: (SHEET_DISMISS_VELOCITY + 0.1) * SHEET_VELOCITY_MS_PER_SECOND,
      },
    ]);
    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D11 — 닫히는 동안 재드래그·딤 탭을 무시한다(onClose 총 1회)', () => {
    const { onClose } = renderSheet();
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_DISMISS_DISTANCE + 20 },
      { state: State.END, translationY: SHEET_DISMISS_DISTANCE + 20, velocityY: 0 },
    ]);

    const closingOffset = panelTranslateY();
    fireDrag([{ state: State.ACTIVE, translationY: 60 }]);
    expect(panelTranslateY()).toBe(closingOffset); // 닫히는 패널을 다시 잡지 못한다

    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // D12 — 중단된 닫힘은 onClose를 내보내지 않는다.
  //   RN은 애니메이션이 중단될 때도 완료 콜백을 부른다(`AnimatedValue.setValue()` → `_animation.stop()`
  //   → `TimingAnimation.stop()`이 `{finished: false}`로 발화). 재오픈이 닫힘을 끊으면 방금 연 시트가
  //   즉시 "닫으라"는 통보를 받게 되므로 `finished`를 확인해야 한다.
  it('D12 — 닫히는 도중 재오픈되면 중단된 닫힘이 onClose를 내보내지 않는다', () => {
    const onClose = jest.fn();
    const { rerender } = renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_DISMISS_DISTANCE + 20 },
      { state: State.END, translationY: SHEET_DISMISS_DISTANCE + 20, velocityY: 0 },
    ]);
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
    fireDrag([
      { state: State.ACTIVE, translationY: SHEET_DISMISS_DISTANCE + 20 },
      { state: State.END, translationY: SHEET_DISMISS_DISTANCE + 20, velocityY: 0 },
    ]);
    runAnimations();
    expect(onClose).toHaveBeenCalledTimes(1); // 중단분은 안 세고, 이번 닫힘만 1회
  });

  it('D13 — 다시 열면 오프셋이 0으로 리셋된다', () => {
    const onClose = jest.fn();
    const { rerender } = renderWithTheme(
      <Sheet visible onClose={onClose} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    fireDrag([{ state: State.ACTIVE, translationY: 60 }]);
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

// 진입 애니메이션(U27, plan §3.4 / P5) — 드래그 오프셋(transform[0])과 분리된 두 번째 translateY로 얹는다.
//   Animated 궤적은 검증하지 않는다(plan §5-2) — "진입 전/정착 후"의 관찰 가능한 두 상태와
//   진입이 콘텐츠 마운트를 지연시키지 않는다는 계약만 잠근다.
describe('Sheet 진입 애니메이션 (E1~E4)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const enterOffset = () =>
    (StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style).transform as
      { translateY: number }[])[1].translateY;

  const dragOffset = () =>
    (StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style).transform as
      { translateY: number }[])[0].translateY;

  it('E1 — visible=true면 진입 연출과 무관하게 children이 즉시 마운트된다', () => {
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.getByText('액션')).toBeTruthy();
    expect(screen.getByText('무엇을 할까요?')).toBeTruthy();
  });

  it('E2 — 진입 직후 패널이 SHEET_ENTER_TRANSLATE만큼 아래에 있고, 정착하면 0이 된다', () => {
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(enterOffset()).toBe(SHEET_ENTER_TRANSLATE);
    act(() => jest.advanceTimersByTime(SHEET_ENTER_DURATION + 50));
    expect(enterOffset()).toBe(0);
  });

  it('E3 — 진입 오프셋은 드래그 오프셋을 침범하지 않는다(드래그 계약 불변)', () => {
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(dragOffset()).toBe(0);
  });

  it('E4 — 진입 상수는 모션 토큰에서 온다(리터럴 단일 출처)', () => {
    expect(SHEET_ENTER_TRANSLATE).toBe(MOTION_DISTANCE.sheetEnter);
    expect(SHEET_ENTER_DURATION).toBe(MOTION_DURATION.sheetEnter);
  });
});

describe('Sheet 진입 애니메이션 — 감소 모션 (E5)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('E5 — 감소 모션이면 진입 이동이 사라진다(딤·패널 페이드는 유지)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    await waitFor(() => {
      const transform = StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style)
        .transform as { translateY: number }[];
      expect(transform[1].translateY).toBe(0);
    });
  });
});

// 감소 모션 토글(plan E3 / qa-visual F1) — "다음 상호작용부터 반영"이 계약이다.
//   열린 시트가 되감기면(진입 재생) 감소 모션 사용자에게 모션을 한 번 더 보여주는 셈이라 fe-craft #1·#8에 어긋난다.
describe('Sheet 진입 애니메이션 — 감소 모션 토글 (E6~E7)', () => {
  let reduceMotionListener: ((enabled: boolean) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotionListener = null;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(false));
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation((_eventName: string, handler: unknown) => {
        reduceMotionListener = handler as (enabled: boolean) => void;
        return { remove: jest.fn() } as never;
      });
  });
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const enterLayerOpacity = () =>
    (StyleSheet.flatten(screen.getByTestId('sheet-enter-layer').props.style) as { opacity: number })
      .opacity;

  it('E6 — 열린 시트에서 감소 모션이 켜져도 진입을 다시 재생하지 않는다', () => {
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    act(() => jest.advanceTimersByTime(SHEET_ENTER_DURATION + 50));
    expect(enterLayerOpacity()).toBe(1);

    act(() => reduceMotionListener?.(true));
    // 되감김(깜빡임) 없이 정착 상태 그대로여야 한다.
    expect(enterLayerOpacity()).toBe(1);
  });

  it('E7 — 닫았다 다시 열면 진입을 정상적으로 재생한다(가드가 재오픈을 막지 않는다)', () => {
    const { rerender } = renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    act(() => jest.advanceTimersByTime(SHEET_ENTER_DURATION + 50));
    rerender(
      <Sheet visible={false} onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    rerender(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(enterLayerOpacity()).toBe(0); // 진입 시작점
    act(() => jest.advanceTimersByTime(SHEET_ENTER_DURATION + 50));
    expect(enterLayerOpacity()).toBe(1);
  });
});

// 딤이 상태바까지 덮는지는 네이티브 Dialog 윈도우 동작이라 렌더 결과로 관측되지 않는다
//   → OS와 맺는 계약인 Modal props에 못 박는다(dim-full-cover plan §6 S1).
describe('Sheet — 딤 전체 화면 커버 (dim-full-cover)', () => {
  // TC-A1
  it('A1 — Modal이 statusBarTranslucent를 켠다(딤이 상태바까지 확장)', () => {
    renderWithTheme(
      <Sheet visible onClose={jest.fn()} title="무엇을 할까요?">
        <Text>액션</Text>
      </Sheet>,
    );
    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
  });
});
