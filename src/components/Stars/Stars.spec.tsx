// src/components/Stars/Stars.spec.tsx
// 별점 표시/입력 컴포넌트 — value만큼 채운 별, editable 시 탭→onChange, 0/null=빈 별 (plan §6.2 / §5 T7, AC4).
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import {
  Stars,
  resolveRatingAtX,
  resolveStarOriginX,
  DRAG_ACTIVATE_DX,
  RATING_MAX,
  RATING_MIN,
  STAR_CELL_PADDING,
  STAR_COUNT,
  STAR_GAP,
} from './Stars';

describe('Stars', () => {
  it('항상 별 5개를 렌더한다', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId(/^star-/)).toHaveLength(5);
  });

  it('value=3이면 3개 채우고 2개 비운다', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
  });

  it('value=0이면 모두 빈 별이다 (AC4: 미평가)', () => {
    renderWithTheme(<Stars value={0} />);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(5);
    expect(screen.queryByTestId('star-filled')).toBeNull();
  });

  it('value=null이면 모두 빈 별로 안전 처리한다', () => {
    renderWithTheme(<Stars value={null} />);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(5);
  });

  it('editable=false면 탭해도 onChange가 없다(비입력)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={2} onChange={onChange} />);
    // 비편집 시 별은 버튼이 아니므로 누를 대상이 없음 → onChange 미호출 보장
    expect(screen.queryByLabelText('별점 3점')).toBeNull();
  });

  it('editable=true면 n번째 별 탭 시 onChange(n)을 호출한다 (입력)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={2} editable onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('채운 별은 킷 starFill(#FFB23E)로 칠한다 (A6)', () => {
    renderWithTheme(<Stars value={3} />);
    const filledIcons = screen.getAllByTestId('icon-star-fill');
    expect(filledIcons[0].props.color).toBe('#FFB23E');
  });

  it('value=3.5면 꽉 3 + 반 1 + 빈 1을 렌더한다 (AC2)', () => {
    renderWithTheme(<Stars value={3.5} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-half')).toHaveLength(1);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1);
    expect(screen.getAllByTestId(/^star-/)).toHaveLength(5);
  });

  it('정수 value=3은 반 별 없이 꽉 3 + 빈 2 (AC2 회귀)', () => {
    renderWithTheme(<Stars value={3} />);
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('star-empty')).toHaveLength(2);
    expect(screen.queryByTestId('star-half')).toBeNull();
  });

  it('반 별은 좌측 절반에 채운 별을 겹쳐 근사한다 (AC2)', () => {
    renderWithTheme(<Stars value={3.5} />);
    // 반 별 위치엔 빈 별 위에 채운 별 오버레이가 겹쳐진다 → icon-star-fill 총 4개(꽉 3 + 반 1).
    expect(screen.getAllByTestId('icon-star-fill')).toHaveLength(4);
  });

  it('editable에서 4번째 별 좌측 탭 → onChange(3.5), 우측 탭 → onChange(4) (AC3)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={0} editable onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('별점 3.5점'));
    expect(onChange).toHaveBeenCalledWith(3.5);
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('editable에서 별1은 단일 탭 영역이고 탭 시 onChange(1)을 호출한다 (클램프 결정)', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={0} editable onChange={onChange} />);
    // 별1은 클램프로 좌/우 방출값이 동일(1) → 반 분할 없이 단일 Pressable(라벨 유일).
    expect(screen.getAllByLabelText('별점 1점')).toHaveLength(1);
    fireEvent.press(screen.getByLabelText('별점 1점'));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).not.toHaveBeenCalledWith(0.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 드래그 입력 (sprint-20260812-rating-drag)
// ─────────────────────────────────────────────────────────────────────────────

// 에디터 기준 지오메트리(size=32) — cellWidth 36, pitch 38, 행 전체 폭 188.
const EDITOR_SIZE = 32;
const CELL_WIDTH = EDITOR_SIZE + 2 * STAR_CELL_PADDING;
const PITCH = CELL_WIDTH + STAR_GAP;

describe('지오메트리 상수 (T1)', () => {
  it('상수가 스타일과 같은 값을 쓴다', () => {
    expect(STAR_COUNT).toBe(5);
    expect(STAR_GAP).toBe(2);
    expect(STAR_CELL_PADDING).toBe(2);
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(5);
  });

  it('렌더된 row의 gap이 STAR_GAP과 일치한다(하드코딩 중복 0)', () => {
    renderWithTheme(<Stars value={3} />);
    const row = StyleSheet.flatten(screen.getByTestId('stars-row').props.style);
    expect(row.gap).toBe(STAR_GAP);
  });

  it('editable 별 셀의 padding이 STAR_CELL_PADDING과 일치한다', () => {
    renderWithTheme(<Stars value={0} editable size={EDITOR_SIZE} />);
    const cell = StyleSheet.flatten(screen.getAllByTestId('star-empty')[0].props.style);
    expect(cell.padding).toBe(STAR_CELL_PADDING);
  });
});

describe('resolveRatingAtX (T2)', () => {
  // U1 — plan §3-3 검증 표 11행.
  it.each([
    [0, 1],
    [17, 1],
    [20, 1],
    [38, 1.5],
    [55, 1.5],
    [56, 2],
    [74, 2],
    [76, 2.5],
    [187, 5],
    [1000, 5],
    [-50, 1],
  ])('x=%p → %p (검증 표)', (x, expected) => {
    expect(resolveRatingAtX({ x, size: EDITOR_SIZE })).toBe(expected);
  });

  // U2 — 각 별의 좌측 끝(= 탭 좌반 시작)은 k + 0.5.
  it.each([1, 2, 3, 4])('x=pitch*%p → 좌반 시작값', (k) => {
    expect(resolveRatingAtX({ x: PITCH * k, size: EDITOR_SIZE })).toBe(k + 0.5);
  });

  // U3 — 셀 중앙(우반 시작)은 index + 1.
  it.each([0, 1, 2, 3, 4])('index=%p 우반 시작 → index+1', (index) => {
    const x = index * PITCH + CELL_WIDTH / 2;
    expect(resolveRatingAtX({ x, size: EDITOR_SIZE })).toBe(index + 1);
  });

  // U4 — 별 사이 gap 구간은 왼쪽 별을 꽉 채운 값.
  it.each([0, 1, 2, 3])('index=%p 뒤 gap 구간 → 왼쪽 별 꽉', (index) => {
    const x = index * PITCH + CELL_WIDTH + 1;
    expect(resolveRatingAtX({ x, size: EDITOR_SIZE })).toBe(index + 1);
  });

  // U5 — 극단 오버런에서 예외 없이 클램프.
  it('극단 오버런도 예외 없이 클램프한다', () => {
    expect(resolveRatingAtX({ x: -1000, size: EDITOR_SIZE })).toBe(RATING_MIN);
    expect(resolveRatingAtX({ x: 1e6, size: EDITOR_SIZE })).toBe(RATING_MAX);
  });

  // U6 — 불변식: 0.5 배수 · 범위 · 단조 비감소.
  it('임의 x 100개에서 0.5 배수·1~5 범위·단조 비감소를 지킨다', () => {
    let previous = 0;
    for (let step = 0; step < 100; step += 1) {
      const x = -20 + step * 2.3;
      const value = resolveRatingAtX({ x, size: EDITOR_SIZE });
      expect(Number.isInteger(value * 2)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(RATING_MIN);
      expect(value).toBeLessThanOrEqual(RATING_MAX);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  // U7 — size 독립성: 기본 15에서도 같은 상대 규칙.
  it('size=15에서도 동일한 상대 규칙을 따른다', () => {
    const size = 15;
    const cellWidth = size + 2 * STAR_CELL_PADDING; // 19
    const pitch = cellWidth + STAR_GAP; // 21
    expect(resolveRatingAtX({ x: 0, size })).toBe(1);
    expect(resolveRatingAtX({ x: pitch, size })).toBe(1.5);
    expect(resolveRatingAtX({ x: pitch + cellWidth / 2, size })).toBe(2);
    expect(resolveRatingAtX({ x: pitch + cellWidth + 1, size })).toBe(2);
    expect(resolveRatingAtX({ x: pitch * 5, size })).toBe(5);
  });
});

describe('resolveStarOriginX (T3)', () => {
  it.each([
    [0, false, 0],
    [0, true, 18],
    [1, false, 38],
    [1, true, 56],
    [4, true, 170],
  ])('index=%p isRightHalf=%p → %p', (index, isRightHalf, expected) => {
    expect(resolveStarOriginX({ index, isRightHalf, size: EDITOR_SIZE })).toBe(expected);
  });

  // U8 — 교차 불변식: 각 탭 영역의 시작점 x는 그 영역의 탭 방출값과 같은 별점을 준다.
  it('모든 탭 영역에서 드래그 매핑과 탭 방출값이 일치한다', () => {
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const position = index + 1;
      const tapValues = { left: Math.max(RATING_MIN, position - 0.5), right: position };
      const leftX = resolveStarOriginX({ index, isRightHalf: false, size: EDITOR_SIZE }) + 1;
      const rightX = resolveStarOriginX({ index, isRightHalf: true, size: EDITOR_SIZE }) + 1;
      expect(resolveRatingAtX({ x: leftX, size: EDITOR_SIZE })).toBe(tapValues.left);
      expect(resolveRatingAtX({ x: rightX, size: EDITOR_SIZE })).toBe(tapValues.right);
    }
  });
});

// PanResponder는 touchHistory.mostRecentTimeStamp가 직전과 달라야 이벤트를 처리하고(onResponderMove와
// onMoveShouldSetResponderCapture 양쪽에 같은 early-return 가드가 있다), numberActiveTouches=1이면
// touchBank[indexOfSingleActiveTouch]를 읽으므로 실제 형태로 채운다.
// startPageX/Y는 "이 터치가 시작된 지점" — 컴포넌트가 제스처 신원 판정에 쓰므로 이동 이벤트에선 명시한다.
let touchTimeStamp = 0;
const responderEvent = ({
  pageX,
  pageY = 0,
  locationX = 0,
  startPageX = pageX,
  startPageY = pageY,
}: {
  pageX: number;
  pageY?: number;
  locationX?: number;
  startPageX?: number;
  startPageY?: number;
}) => {
  touchTimeStamp += 1;
  return {
    nativeEvent: {
      pageX,
      pageY,
      locationX,
      locationY: 0,
      identifier: 0,
      timestamp: touchTimeStamp,
      touches: [],
      changedTouches: [],
    },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: touchTimeStamp,
      touchBank: [
        {
          touchActive: true,
          startPageX,
          startPageY,
          startTimeStamp: touchTimeStamp,
          currentPageX: pageX,
          currentPageY: pageY,
          currentTimeStamp: touchTimeStamp,
          previousPageX: pageX,
          previousPageY: pageY,
          previousTimeStamp: touchTimeStamp,
        },
      ],
    },
  };
};

describe('Stars — 드래그 입력 (T4·T5)', () => {
  const renderEditable = () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={0} editable size={EDITOR_SIZE} onChange={onChange} />);
    return { onChange };
  };

  // 별1(단일 Pressable) 위 press-in 지점. 기준점 x0 = originX(0) + locationX = 5.
  const START_PAGE_X = 100;
  const START_LOCATION_X = 5;

  const pressInStarOne = () => {
    fireEvent(
      screen.getByLabelText('별점 1점'),
      'pressIn',
      responderEvent({ pageX: START_PAGE_X, locationX: START_LOCATION_X }),
    );
  };

  // RNTL의 fireEvent는 onStartShouldSetResponder가 false인 View의 responder 이벤트를 "비활성"으로 보고
  // 건너뛴다(제스처 전용 View의 라이브러리 한계). 그래서 row에 실제로 붙은 panHandlers 프롭을 직접 호출한다.
  // startPageX는 press-in한 그 터치가 계속 이어지고 있음을 뜻한다(제스처 신원).
  const dragTo = ({ pageX }: { pageX: number }) => {
    screen
      .getByTestId('stars-row')
      .props.onResponderMove(responderEvent({ pageX, startPageX: START_PAGE_X }));
  };

  // 캡처 게이트를 직접 호출한다. 기본은 press-in한 터치가 이어지는 상황.
  const shouldCapture = ({
    pageX,
    pageY,
    startPageX = START_PAGE_X,
    startPageY = 0,
  }: {
    pageX: number;
    pageY: number;
    startPageX?: number;
    startPageY?: number;
  }): boolean =>
    screen
      .getByTestId('stars-row')
      .props.onMoveShouldSetResponderCapture(
        responderEvent({ pageX, pageY, startPageX, startPageY }),
      );

  it('T4: pressIn만으로는 onChange를 호출하지 않는다(값 방출 없음)', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('D1: 별1에서 오른쪽으로 드래그하면 0.5 단위 값을 방출한다', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    dragTo({ pageX: 176 }); // dx=76 → x=81 → index 2, within 5 → 2.5
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('D2: 같은 위치로 연속 드래그해도 중복 방출하지 않는다', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    dragTo({ pageX: 176 });
    dragTo({ pageX: 176 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('D3: 오른쪽으로 크게 넘겨도 5로 클램프한다', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    dragTo({ pageX: 1100 });
    expect(onChange).toHaveBeenCalledWith(RATING_MAX);
  });

  it('D4: 왼쪽으로 크게 넘겨도 1로 클램프한다(0·0.5 방출 금지)', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    dragTo({ pageX: 176 });
    dragTo({ pageX: -900 });
    expect(onChange).toHaveBeenLastCalledWith(RATING_MIN);
    expect(onChange).not.toHaveBeenCalledWith(0.5);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it('D5: editable=false면 row에 responder 핸들러가 붙지 않는다', () => {
    const onChange = jest.fn();
    renderWithTheme(<Stars value={3} size={EDITOR_SIZE} onChange={onChange} />);
    const row = screen.getByTestId('stars-row');
    expect(row.props.onResponderMove).toBeUndefined();
    expect(row.props.onMoveShouldSetResponderCapture).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('D6: 임계 미달 이동은 responder를 탈취하지 않는다', () => {
    renderEditable();
    pressInStarOne();
    expect(shouldCapture({ pageX: START_PAGE_X + 2, pageY: 40 })).toBe(false);
  });

  it('D6-b: 임계를 넘어도 세로가 우세하면 탈취하지 않는다(스크롤 양보)', () => {
    renderEditable();
    pressInStarOne();
    // dx=20 > 4(임계 통과)이지만 dy=60이 더 크다 → 세로 스크롤 의도.
    expect(shouldCapture({ pageX: START_PAGE_X + 20, pageY: 60 })).toBe(false);
  });

  it('D7: 임계 초과 수평 이동은 responder를 탈취한다', () => {
    renderEditable();
    pressInStarOne();
    expect(shouldCapture({ pageX: START_PAGE_X + DRAG_ACTIVATE_DX + 26, pageY: 5 })).toBe(true);
  });

  it('L2-P1: press-in 없이 시작한 제스처는 responder를 탈취하지 않는다', () => {
    const { onChange } = renderEditable();
    // 별 사이 gap(어떤 Pressable도 덮지 않는 2px×4)에서 시작한 터치 — onPressIn을 받지 못한다.
    expect(shouldCapture({ pageX: 200, pageY: 150, startPageX: 150, startPageY: 150 })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('L2-P2: 직전 탭의 기준점이 새 제스처로 새지 않는다', () => {
    const { onChange } = renderEditable();
    fireEvent(
      screen.getByLabelText('별점 5점'),
      'pressIn',
      responderEvent({ pageX: 500, locationX: 10 }),
    );
    fireEvent.press(screen.getByLabelText('별점 5점'));
    onChange.mockClear();
    // 별 위 press-in 없이 시작한 다른 터치 → 직전 기준점(500)으로 값이 방출되면 안 된다.
    expect(shouldCapture({ pageX: 474, pageY: 0, startPageX: 470, startPageY: 0 })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('드래그 도중 responder를 뺏기지 않는다(termination 거부)', () => {
    renderEditable();
    const row = screen.getByTestId('stars-row');
    expect(row.props.onResponderTerminationRequest(responderEvent({ pageX: 0 }))).toBe(false);
  });

  it('grant 시 Android 네이티브 responder를 차단한다(onShouldBlockNativeResponder=true)', () => {
    renderEditable();
    const row = screen.getByTestId('stars-row');
    // RN은 이 값을 panHandlers 프롭이 아니라 onResponderGrant의 반환값으로 전달한다.
    expect(row.props.onShouldBlockNativeResponder).toBeUndefined();
    expect(row.props.onResponderGrant(responderEvent({ pageX: START_PAGE_X }))).toBe(true);
  });

  it('릴리스 후 다시 같은 값으로 드래그하면 재방출한다(dedup 상태 초기화)', () => {
    const { onChange } = renderEditable();
    pressInStarOne();
    dragTo({ pageX: 176 });
    screen
      .getByTestId('stars-row')
      .props.onResponderRelease(responderEvent({ pageX: 176, startPageX: START_PAGE_X }));
    pressInStarOne();
    dragTo({ pageX: 176 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('AC8: 신규 stars-row testID가 star- 개수 단언을 깨지 않는다', () => {
    renderWithTheme(<Stars value={3} editable size={EDITOR_SIZE} />);
    expect(screen.getAllByTestId(/^star-/)).toHaveLength(STAR_COUNT);
  });
});
