// src/theme/motion/motion.spec.ts
// 모션 토큰·순수 리졸버 — plan §5-1 T1. RN 렌더 없이 도는 순수 단위 테스트다.
//   값 자체를 다시 적는 테스트가 아니라 ① 감소 모션 분기 ② 모션 예산 불변식을 잠근다.
import {
  CELEBRATE_DELAY_MS,
  CELEBRATE_SCALE_FROM,
  CELEBRATE_SPRING,
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASE_OUT,
  MotionKind,
  PRESS_OUT_SPRING,
  PRESS_SCALE,
  resolveMotionDistance,
  resolveMotionDuration,
  resolvePressScale,
} from './motion';

describe('resolvePressScale', () => {
  it('감소 모션이 꺼져 있으면 등급별 스케일을 그대로 준다(sm 0.94 / md 0.96 / lg 0.98)', () => {
    expect(resolvePressScale({ size: 'sm', reduceMotion: false })).toBe(0.94);
    expect(resolvePressScale({ size: 'md', reduceMotion: false })).toBe(0.96);
    expect(resolvePressScale({ size: 'lg', reduceMotion: false })).toBe(0.98);
  });

  it('감소 모션이면 세 등급 모두 1이다(스케일 제거 — 불투명도 피드백만 남는다)', () => {
    expect(resolvePressScale({ size: 'sm', reduceMotion: true })).toBe(1);
    expect(resolvePressScale({ size: 'md', reduceMotion: true })).toBe(1);
    expect(resolvePressScale({ size: 'lg', reduceMotion: true })).toBe(1);
  });
});

describe('resolveMotionDistance', () => {
  it('감소 모션이 꺼져 있으면 거리를 그대로 준다', () => {
    expect(resolveMotionDistance({ distance: 40, reduceMotion: false })).toBe(40);
  });

  it('감소 모션이면 거리를 0으로 접는다(이동 제거)', () => {
    expect(resolveMotionDistance({ distance: 40, reduceMotion: true })).toBe(0);
  });

  it('거리 0은 항등이다', () => {
    expect(resolveMotionDistance({ distance: 0, reduceMotion: false })).toBe(0);
    expect(resolveMotionDistance({ distance: 0, reduceMotion: true })).toBe(0);
  });
});

describe('resolveMotionDuration', () => {
  it('감소 모션이 꺼져 있으면 지속시간을 그대로 준다', () => {
    expect(
      resolveMotionDuration({ durationMs: 260, kind: MotionKind.Move, reduceMotion: false }),
    ).toBe(260);
    expect(
      resolveMotionDuration({ durationMs: 200, kind: MotionKind.Fade, reduceMotion: false }),
    ).toBe(200);
  });

  it('감소 모션이면 move는 0으로 접는다(즉시 제자리)', () => {
    expect(
      resolveMotionDuration({ durationMs: 260, kind: MotionKind.Move, reduceMotion: true }),
    ).toBe(0);
  });

  it('감소 모션이어도 fade는 그대로 유지한다(크로스페이드는 감소 모션의 권장 대체)', () => {
    expect(
      resolveMotionDuration({ durationMs: 200, kind: MotionKind.Fade, reduceMotion: true }),
    ).toBe(200);
  });
});

describe('모션 예산 불변식', () => {
  it('celebrate를 뺀 모든 지속시간이 300ms 이하다(원칙 4 · fe-craft #4)', () => {
    const { celebrate, ...uiDurations } = MOTION_DURATION;
    Object.values(uiDurations).forEach((durationMs) => {
      expect(durationMs).toBeLessThanOrEqual(300);
    });
    // celebrate는 드문 1회성 축하 연출이라 예외로 허용한다(fe-craft §1.2 딜라이트 구간).
    expect(celebrate).toBeGreaterThan(300);
  });

  it('누름은 어떤 진입 모션보다 짧다(fe-craft #9 비대칭 타이밍 — 응답은 즉각)', () => {
    expect(MOTION_DURATION.pressIn).toBeLessThan(MOTION_DURATION.sheetEnter);
    expect(MOTION_DURATION.pressIn).toBeLessThan(MOTION_DURATION.swapEnter);
    expect(MOTION_DURATION.pressIn).toBeLessThan(MOTION_DURATION.toastEnter);
    expect(MOTION_DURATION.pressIn).toBeLessThan(MOTION_DURATION.photoFade);
  });

  it('토스트 퇴장은 진입보다 짧다(시스템 응답은 즉각)', () => {
    expect(MOTION_DURATION.toastExit).toBeLessThan(MOTION_DURATION.toastEnter);
    expect(MOTION_DISTANCE.toastExit).toBeLessThan(MOTION_DISTANCE.toastEnter);
  });

  it('눌림 스케일 등급은 작은 컨트롤일수록 깊고, 0.9 아래로 과장되지 않는다', () => {
    expect(PRESS_SCALE.sm).toBeLessThan(PRESS_SCALE.md);
    expect(PRESS_SCALE.md).toBeLessThan(PRESS_SCALE.lg);
    expect(PRESS_SCALE.sm).toBeGreaterThanOrEqual(0.9);
    expect(PRESS_SCALE.lg).toBeLessThan(1);
  });

  it('🎉 팝은 scale(0)이 아닌 지점에서 시작하고 짧게 지연된 뒤 터진다(fe-craft #5)', () => {
    expect(CELEBRATE_SCALE_FROM).toBeGreaterThan(0.5);
    expect(CELEBRATE_SCALE_FROM).toBeLessThan(1);
    expect(CELEBRATE_DELAY_MS).toBeGreaterThan(0);
    expect(CELEBRATE_DELAY_MS).toBeLessThan(MOTION_DURATION.celebrate);
  });

  it('스프링은 오버슈트 성격이 다르다(복귀는 옅게, 축하는 팝)', () => {
    expect(PRESS_OUT_SPRING.bounciness).toBeLessThan(CELEBRATE_SPRING.bounciness);
  });

  it('ease-out 커브는 제어점 4개다(Easing.bezier 인자로 그대로 펼친다)', () => {
    expect(MOTION_EASE_OUT).toHaveLength(4);
  });
});
