// src/components/Stars/Stars.tsx
// 별점 표시/입력 컴포넌트 — mk-ui Stars(mk-ui.jsx:32) 재현 + 0.5 단위 확장 (plan §2 Stars, AC2/AC3).
//   표시: position ≤ value ⇒ 꽉 찬 별(starFill=킷 #FFB23E), position−0.5 ≤ value < position ⇒ 반 별,
//   그 외 빈 별(lineStrong=--line-strong). 0/null = 모두 빈 별(미평가).
//   반 별 근사: 킷 Stars는 이진 채움(star-fill/star)뿐이라, 빈 별 위에 좌측 절반만 클리핑한
//   채운 별을 오버레이해 근사한다(사유는 ui-spec.md). editable이면 별을 좌/우 반으로 나눠
//   좌측 탭→onChange(max(1, position−0.5)), 우측 탭→onChange(position). 계약 최소 1.0으로
//   클램프해 별1 좌/우 모두 1을 방출(리더 결정). 스타일은 토큰만(raw hex 0).
//   editable이면 별 위 수평 드래그로도 같은 값을 연속 입력한다(rating-drag, RN 내장 PanResponder).
//     드래그 매핑은 탭 영역 판정과 동일 기준(resolveRatingAtX) — 같은 픽셀이면 탭과 드래그가 같은 값.
import React, { useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Icon, IconName } from '../Icon';

// 별 5개 고정(1~5). map 콜백 인덱스는 외부 시그니처라 named-args 예외(컨벤션 §매개변수 예외).
const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

// ─── 지오메트리·데이터 계약 상수 ────────────────────────────────────────────
// 스타일(styles.row/starEditable)과 좌표→별점 매핑이 같은 숫자를 봐야 하므로 여기가 단일 출처다.
export const STAR_COUNT = STAR_POSITIONS.length;
/** row의 별 간 간격(px). styles.row.gap과 동일 출처. */
export const STAR_GAP = 2;
/** editable 별 셀의 내부 여백(px). styles.starEditable.padding과 동일 출처. */
export const STAR_CELL_PADDING = 2;
/** 데이터 계약 최소 별점(0/미평가로는 드래그로 돌아갈 수 없다). */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
/** 이 픽셀 이상 수평으로 움직여야 드래그로 인식(Sheet.tsx의 4px 임계와 동일 감각). */
export const DRAG_ACTIVATE_DX = 4;

const resolveCellWidth = ({ size }: { size: number }): number => size + 2 * STAR_CELL_PADDING;
const resolvePitch = ({ size }: { size: number }): number =>
  resolveCellWidth({ size }) + STAR_GAP;

/**
 * 별점 행(row) 로컬 x좌표를 별점으로 바꾼다. 탭 영역 판정과 완전히 같은 기준이라
 * 같은 픽셀에서 탭과 드래그가 항상 같은 값을 낸다.
 * @param x 행 왼쪽 끝을 0으로 하는 가로 좌표(px). 범위 밖이어도 안전하게 클램프한다.
 * @param size 별 한 변의 길이(px)
 * @returns 항상 0.5의 배수이고 RATING_MIN ≤ v ≤ RATING_MAX인 별점
 */
export const resolveRatingAtX = ({ x, size }: { x: number; size: number }): number => {
  const cellWidth = resolveCellWidth({ size });
  const pitch = cellWidth + STAR_GAP;
  const index = Math.min(STAR_COUNT - 1, Math.max(0, Math.floor(x / pitch)));
  const within = x - index * pitch;
  // 셀 좌반이면 반 별, 우반과 별 사이 gap이면 꽉 별(= 왼쪽 별을 채운 값).
  const raw = index + (within < cellWidth / 2 ? RATING_STEP : 1);
  return Math.min(RATING_MAX, Math.max(RATING_MIN, raw));
};

/**
 * editable 별의 탭 영역(좌/우 반, 별1은 셀 전체)이 시작하는 행 로컬 x좌표.
 * press-in 지점을 행 좌표계로 옮길 때 쓴다(locationX는 그 영역 기준이므로 여기에 더한다).
 * @param index 0-based 별 인덱스
 * @param isRightHalf 우측 반 영역이면 true (별1의 단일 Pressable은 false)
 * @param size 별 한 변의 길이(px)
 */
export const resolveStarOriginX = ({
  index,
  isRightHalf,
  size,
}: {
  index: number;
  isRightHalf: boolean;
  size: number;
}): number =>
  index * resolvePitch({ size }) + (isRightHalf ? resolveCellWidth({ size }) / 2 : 0);

// responder 이벤트의 터치 이력 — RN 공개 타입(GestureResponderEvent)에 없어 쓰는 필드만 좁혀 선언한다.
type TouchHistoryEvent = GestureResponderEvent & {
  touchHistory?: {
    numberActiveTouches: number;
    indexOfSingleActiveTouch: number;
    touchBank: ReadonlyArray<{ startPageX: number; startPageY: number } | undefined>;
  };
};

type PagePoint = { x: number; y: number };

/**
 * 이벤트가 가리키는 단일 활성 터치가 "시작된" 화면 좌표. 제스처 동일성 판정의 기준점이라,
 * press-in 때와 이동 때 같은 출처(touchBank)에서 읽어야 값이 정확히 일치한다.
 * @param evt responder/press 이벤트
 * @returns 활성 터치가 정확히 1개일 때 그 시작 좌표, 아니면 null(멀티터치·이력 없음)
 */
const resolveActiveTouchStart = ({ evt }: { evt: TouchHistoryEvent }): PagePoint | null => {
  const history = evt.touchHistory;
  if (!history || history.numberActiveTouches !== 1) return null;
  const touch = history.touchBank[history.indexOfSingleActiveTouch];
  if (!touch) return null;
  return { x: touch.startPageX, y: touch.startPageY };
};

// 한 별의 채움 상태 — 한정 집합이라 enum-style 상수(컨벤션 §도메인 식별 문자열).
const StarState = {
  Filled: 'filled',
  Half: 'half',
  Empty: 'empty',
} as const;
type StarState = (typeof StarState)[keyof typeof StarState];

export type StarsProps = {
  /** 별점(1~5, 0.5 단위 소수 허용 — 예: 3.5). 0/null/undefined = 미평가(모두 빈 별). */
  value?: number | null;
  /** 한 별의 한 변 길이(px). 기본 15(킷 mk-ui:32). */
  size?: number;
  /** true면 별 좌/우 반 탭으로 0.5 단위 점수를 입력받는다. */
  editable?: boolean;
  /** editable일 때 좌측 반 탭→max(1, position−0.5), 우측 반 탭→position 으로 호출. */
  onChange?: (value: number) => void;
};

export const Stars = ({ value, size = 15, editable = false, onChange }: StarsProps) => {
  const filled = value ?? 0;

  // PanResponder는 1회만 생성되므로 최신 props는 ref로 읽는다(Sheet.tsx 선례, useCallback 금지 컨벤션).
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // press-in 지점 — 행 로컬 x와 그 터치의 시작 화면 좌표. 드래그 이동량(dx)을 여기에 더해 별점을 계산하고,
  //   같은 좌표가 "이 제스처가 별 위에서 시작했는지"를 판정하는 신원 역할도 한다. null = 기준점 없음.
  const dragStartXRef = useRef(0);
  const dragStartPageRef = useRef<PagePoint | null>(null);
  // 직전 방출값 — 같은 값이 연속되면 방출하지 않아 불필요한 리렌더를 막는다.
  const lastEmittedRef = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      // 캡처 단계에서 자식 Pressable로부터 responder를 가져온다. 세로 우세면 양보 → ScrollView가 스크롤.
      onMoveShouldSetPanResponderCapture: (evt: TouchHistoryEvent) => {
        const start = dragStartPageRef.current;
        // press-in으로 기준점을 기록한 바로 그 터치가 아니면 잡지 않는다.
        //   row에는 Pressable이 덮지 않는 별 사이 gap(2px×4)이 있어 press-in 없이 시작한 터치도
        //   이 게이트를 통과할 수 있다. 그대로 두면 직전 제스처의 기준점으로 엉뚱한 값이 방출된다.
        const touchStart = resolveActiveTouchStart({ evt });
        if (!start || !touchStart || touchStart.x !== start.x || touchStart.y !== start.y) {
          return false;
        }
        const dx = evt.nativeEvent.pageX - start.x;
        const dy = evt.nativeEvent.pageY - start.y;
        return Math.abs(dx) > DRAG_ACTIVATE_DX && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderMove: (evt) => {
        const start = dragStartPageRef.current;
        if (!start) return;
        const dx = evt.nativeEvent.pageX - start.x;
        const next = resolveRatingAtX({
          x: dragStartXRef.current + dx,
          size: sizeRef.current,
        });
        if (next === lastEmittedRef.current) return;
        lastEmittedRef.current = next;
        onChangeRef.current?.(next);
      },
      // 드래그를 잡은 뒤에는 ScrollView에 responder를 넘기지 않는다(세로로 꺾어도 드래그 유지).
      onPanResponderTerminationRequest: () => false,
      // RN 기본값과 같은 값을 의도로 명시한다(Android 네이티브 스크롤 차단). panHandlers 프롭이 아니라
      //   onResponderGrant의 반환값으로 전달된다 — 추가 가드가 아니라 기본 동작의 고정이다.
      onShouldBlockNativeResponder: () => true,
      // 릴리스 값이 곧 확정값 — 추가 방출 없이 다음 제스처를 위해 상태만 비운다.
      onPanResponderRelease: () => {
        lastEmittedRef.current = null;
        dragStartPageRef.current = null;
      },
      onPanResponderTerminate: () => {
        lastEmittedRef.current = null;
        dragStartPageRef.current = null;
      },
    }),
  ).current;

  // 탭 영역의 press-in을 행 좌표계 기준점으로 기록만 한다(값 방출 없음 — 탭 확정은 onPress 경로 유지).
  const recordDragStart = ({
    index,
    isRightHalf,
    evt,
  }: {
    index: number;
    isRightHalf: boolean;
    evt: TouchHistoryEvent;
  }) => {
    dragStartXRef.current =
      resolveStarOriginX({ index, isRightHalf, size }) + evt.nativeEvent.locationX;
    // 기준점은 touchBank의 터치 시작 좌표를 우선 쓴다 — 캡처 게이트가 대조하는 값과 출처가 같아야
    //   부동소수·타이밍 차이로 신원 판정이 어긋나지 않는다(이력이 없으면 이벤트 좌표로 대체).
    dragStartPageRef.current = resolveActiveTouchStart({ evt }) ?? {
      x: evt.nativeEvent.pageX,
      y: evt.nativeEvent.pageY,
    };
  };

  const resolveState = ({ position }: { position: number }): StarState => {
    if (position <= filled) return StarState.Filled;
    if (position - 0.5 <= filled) return StarState.Half;
    return StarState.Empty;
  };

  const renderStar = ({ state }: { state: StarState }) => {
    if (state === StarState.Half) {
      return (
        <View style={{ width: size, height: size }}>
          <Icon name={IconName.Star} size={size} color="lineStrong" />
          <View style={[styles.halfClip, { width: size / 2, height: size }]}>
            <Icon name={IconName.StarFill} size={size} color="starFill" />
          </View>
        </View>
      );
    }
    const isFilled = state === StarState.Filled;
    return (
      <Icon
        name={isFilled ? IconName.StarFill : IconName.Star}
        size={size}
        color={isFilled ? 'starFill' : 'lineStrong'}
      />
    );
  };

  return (
    // editable일 때만 드래그 responder를 붙인다 — 표시 전용 사용처(카드/상세/지도)의 탭을 가로채지 않게.
    <View
      testID="stars-row"
      style={styles.row}
      {...(editable ? panResponder.panHandlers : {})}
    >
      {STAR_POSITIONS.map((position) => {
        const state = resolveState({ position });
        const testID = `star-${state}`;
        const index = position - 1;
        if (!editable) {
          return (
            <View key={position} testID={testID}>
              {renderStar({ state })}
            </View>
          );
        }
        // 좌측 반은 position−0.5, 단 데이터 계약 최소 1.0으로 클램프(별1 좌측=1, 리더 결정).
        const leftValue = Math.max(1, position - 0.5);
        // 별1은 클램프로 좌/우 방출값이 동일(1) → 반 분할 없이 단일 풀사이즈 Pressable(동일 라벨 인접 버튼 방지).
        if (leftValue === position) {
          return (
            <Pressable
              key={position}
              testID={testID}
              style={styles.starEditable}
              accessibilityRole="button"
              accessibilityLabel={`별점 ${position}점`}
              onPressIn={(evt) => recordDragStart({ index, isRightHalf: false, evt })}
              onPress={() => onChange?.(position)}
            >
              {renderStar({ state })}
            </Pressable>
          );
        }
        return (
          <View key={position} testID={testID} style={styles.starEditable}>
            {renderStar({ state })}
            <View style={styles.editOverlay}>
              <Pressable
                style={styles.editHalf}
                accessibilityRole="button"
                accessibilityLabel={`별점 ${leftValue}점`}
                onPressIn={(evt) => recordDragStart({ index, isRightHalf: false, evt })}
                onPress={() => onChange?.(leftValue)}
              />
              <Pressable
                style={styles.editHalf}
                accessibilityRole="button"
                accessibilityLabel={`별점 ${position}점`}
                onPressIn={(evt) => recordDragStart({ index, isRightHalf: true, evt })}
                onPress={() => onChange?.(position)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // gap·padding은 좌표→별점 매핑과 같은 상수를 참조한다(하드코딩 중복 0 — 값 변경 시 양쪽이 함께 움직임).
  row: { flexDirection: 'row', alignItems: 'center', gap: STAR_GAP },
  starEditable: { padding: STAR_CELL_PADDING },
  halfClip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  editOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  editHalf: { flex: 1 },
});
