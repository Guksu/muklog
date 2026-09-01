// src/components/Toast.spec.tsx
// 하단 플로팅 토스트(프리젠테이셔널) — 킷 .mk-toast(index.html:37-42). 렌더 분기·tone·자동 사라짐 타이머 검증.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, screen, waitFor } from '@testing-library/react-native';

import { MOTION_DISTANCE, MOTION_DURATION } from '@/theme';
import { renderWithTheme } from '@/test/renderWithTheme';

import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(<Toast visible={false} message="담았어요" />);
    expect(screen.queryByText('담았어요')).toBeNull();
  });

  it('visible=true면 메시지를 표시한다', () => {
    renderWithTheme(<Toast visible message="위시리스트에 담았어요 📍" />);
    expect(screen.getByText('위시리스트에 담았어요 📍')).toBeTruthy();
  });

  it('tone="positive"면 ✓ 체크를 앞에 표시한다(킷 .mk-toast.pos)', () => {
    renderWithTheme(<Toast visible tone="positive" message="담았어요" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('tone="neutral"(기본)이면 ✓를 표시하지 않는다', () => {
    renderWithTheme(<Toast visible message="삭제했어요" />);
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('durationMs 경과 시 onHide를 호출한다(자동 사라짐, 킷 2200ms)', () => {
    const onHide = jest.fn();
    renderWithTheme(<Toast visible message="담았어요" durationMs={2200} onHide={onHide} />);
    expect(onHide).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2200));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('durationMs 이전에는 onHide를 호출하지 않는다', () => {
    const onHide = jest.fn();
    renderWithTheme(<Toast visible message="담았어요" durationMs={2200} onHide={onHide} />);
    act(() => jest.advanceTimersByTime(2199));
    expect(onHide).not.toHaveBeenCalled();
  });

  // 퇴장 애니메이션(plan §3.7 / P8) — 수명은 Animated 완료 콜백이 아니라 명시적 타이머가 잡는다.
  //   덕분에 애니메이션이 중단돼도 반드시 정리되고, 테스트가 프레임 루프에 의존하지 않는다.
  it('visible=false로 내려도 곧바로 사라지지 않는다(퇴장 연출 구간)', () => {
    const { rerender } = renderWithTheme(<Toast visible message="담았어요" />);
    rerender(<Toast visible={false} message="담았어요" />);
    expect(screen.getByText('담았어요')).toBeTruthy();
  });

  it('퇴장 시간이 지나면 사라진다', () => {
    const { rerender } = renderWithTheme(<Toast visible message="담았어요" />);
    rerender(<Toast visible={false} message="담았어요" />);
    act(() => jest.advanceTimersByTime(MOTION_DURATION.toastExit));
    expect(screen.queryByText('담았어요')).toBeNull();
  });

  it('퇴장 중 새 토스트가 오면 새 메시지가 남는다(재타게팅 — E16)', () => {
    const { rerender } = renderWithTheme(<Toast visible message="담았어요" />);
    rerender(<Toast visible={false} message="담았어요" />);
    act(() => jest.advanceTimersByTime(MOTION_DURATION.toastExit / 2));
    rerender(<Toast visible message="저장했어요" />);
    act(() => jest.advanceTimersByTime(MOTION_DURATION.toastExit * 2));
    expect(screen.getByText('저장했어요')).toBeTruthy();
  });

  it('언마운트하면 남는 타이머가 없다(누수 0)', () => {
    const view = renderWithTheme(<Toast visible message="담았어요" onHide={jest.fn()} />);
    view.rerender(<Toast visible={false} message="담았어요" onHide={jest.fn()} />);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

// 감소 모션(plan §3.7 / qa-visual F3) — 다른 모듈과 같은 관찰 가능한 계약으로 고정한다.
//   구현은 거리 리졸버 경유이므로 "이동 거리가 0으로 접혔는지"를 단언한다(리터럴로 되돌리면 빨개진다).
describe('Toast — 감소 모션', () => {
  afterEach(() => jest.restoreAllMocks());

  const enterTranslateY = () =>
    (
      StyleSheet.flatten(screen.getByTestId('toast-pill').props.style) as {
        transform: { translateY: number }[];
      }
    ).transform[0].translateY;

  it('감소 모션이면 진입 이동이 0으로 접힌다(페이드만 남는다 — fe-craft #8)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    renderWithTheme(<Toast visible message="담았어요" />);
    await waitFor(() => expect(enterTranslateY()).toBe(0));
    const style = StyleSheet.flatten(screen.getByTestId('toast-pill').props.style) as Record<
      string,
      unknown
    >;
    expect(style.opacity).toBeDefined();
  });

  it('감소 모션이 꺼져 있으면 킷 실값(14px)만큼 아래에서 올라온다', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(false));
    renderWithTheme(<Toast visible message="담았어요" />);
    expect(enterTranslateY()).toBe(MOTION_DISTANCE.toastEnter);
  });
});
