// src/theme/motion/motion.ts
// 모션 토큰 + 감소 모션 리졸버(순수) — plan §3.1 (motion-pass-1).
//   왜 tokens.ts가 아니라 별도 모듈인가: 모션 값은 테마(light/dark)에 무관하고,
//   tokens.ts를 건드리면 전 화면이 회귀 사정권에 들어온다. spacing·radius처럼 @/theme 배럴에서 재수출한다.
//   Easing은 토큰이 아니라 소비처에서 만든다(이 파일은 순수 숫자만 담아 RN 렌더 없이 테스트된다).
//
// 판단값 출처
//   · fe-skills `press-feedback`(누름 60ms 즉각 / 복귀 220ms 스프링 커브, scale 0.94·0.96·0.98, 0.9 이하 과장 금지)
//   · fe-skills `enter-exit`(슬라이드 거리 16px, 감소 모션에서 이동 제거·페이드 유지)
//   · fe-skills `like-pop`(원샷 팝 400ms, 축소된 지점에서 시작해 오버슈트 후 정착)
//   · fe-craft references/animation.md #3(ease-out)·#4(UI 300ms)·#8(감소 모션은 완화)·#9(비대칭)
//   · ux-principles 원칙 4(목적 있는 모션 150~300ms)

/** 모션 지속시간(ms) — celebrate를 뺀 전부가 원칙 4(150~300ms)·fe-craft #4(UI 300ms 이하) 안. */
export const MOTION_DURATION = {
  /** 누름 — 즉각(fe-craft #9 비대칭: 응답은 즉시). fe-skills press-feedback 60ms. */
  pressIn: 60,
  /** 시트 진입. 킷 mkSlideUp 260(Sheet.tsx 기존 주석 근거) [킷 대조 필요]. */
  sheetEnter: 260,
  /** 에디터↔장소검색 전환(백로그 U54: 150~250ms). */
  swapEnter: 200,
  /** 사진 로드 페이드인. */
  photoFade: 200,
  /** 토스트 진입. 킷 mkToast .26s(기존 ENTER_MS 유지). */
  toastEnter: 260,
  /** 토스트 퇴장 — 진입보다 짧게(퇴장은 시스템 응답). */
  toastExit: 160,
  /** 🎉 팝 — 드묾·최초 1회라 fe-craft §1.2 딜라이트 허용 구간(300ms 초과는 의도적 예외). */
  celebrate: 420,
} as const;

/** 진입 모션의 이동 거리(px). 감소 모션에서 0으로 접히는 값들. */
export const MOTION_DISTANCE = {
  /** 시트가 아래에서 올라오는 거리. 백로그 U27 개선안 실값 [킷 대조 필요]. */
  sheetEnter: 40,
  /** 가로 슬라이드(전진 +16 → 0 / 복귀 -16 → 0). fe-skills enter-exit 기본 거리. */
  swapEnter: 16,
  /** 토스트 진입 translateY 14→0(킷 mkToast 실값). */
  toastEnter: 14,
  /** 토스트 퇴장 — 짧게 내려앉는다. */
  toastExit: 6,
} as const;

/**
 * 눌림 스케일 등급 — fe-skills press-feedback 판단값(작은 컨트롤일수록 더 깊게).
 *
 * sm·md·lg는 "크기" 축이다. `fab`만 **크기가 아니라 레이어** 축의 예외다 —
 * 킷이 지도 위에 떠 있는 두 컨트롤(현재위치 FAB `mk-home:295` · 재검색 pill `mk-home:368`)의
 * `onMouseDown`에 `transform: scale(.92)`를 **직접 지정**했다. 값이 크기에서 유도되지 않으므로
 * 크기 등급에 억지로 접지 않고 별도 등급으로 담는다(축 혼선을 여기 주석으로 잠근다).
 * 두 컨트롤은 이미 `shadow.fab` 토큰을 공유해 코드베이스에 같은 어휘가 있다(tokens.ts:194-198).
 * 새 소비처를 `fab`에 넣기 전에 "지도·콘텐츠 위에 떠 있는 레이어인가"를 먼저 확인할 것.
 */
export const PRESS_SCALE = { fab: 0.92, sm: 0.94, md: 0.96, lg: 0.98 } as const;
export type PressScaleSize = keyof typeof PRESS_SCALE;

/**
 * 눌림 불투명도 표준 dim.
 *   default — 소비처가 `pressedOpacity`를 주지 않을 때의 기본 dim.
 *   reduceMotionFloor — 감소 모션 ON에서 **보장하는 최소 피드백**. 소비처가 스케일만으로 피드백을
 *     주는 경우(`pressedOpacity: 1`) 감소 모션에서는 스케일이 제거되어 반응이 0이 되기 때문이다.
 *     fe-craft #8("감소 모션은 제거가 아니라 완화 — opacity·색은 유지, 이동만 제거") ·
 *     fe-skills press-feedback(reduced-motion에서 `transform: none` + 밝기 변화만 남긴다) ·
 *     ux-principles 원칙 3(즉각 피드백). 웹 정본의 `filter: brightness(.92)`는 RN에 없어
 *     가장 가까운 근사인 불투명도로 옮겼고, 값은 이미 앱 전체가 쓰는 표준 dim에 맞춰 어휘를 하나로 둔다.
 */
export const PRESSED_OPACITY = { default: 0.85, reduceMotionFloor: 0.85 } as const;

/** 눌렀다 뗄 때 스프링 — 목표 체감 ≈220ms, 아주 옅은 오버슈트(킷 플레이풀 성격과 응집). */
export const PRESS_OUT_SPRING = { bounciness: 6, speed: 12 } as const;
/** 🎉 팝 스프링 — 오버슈트가 곧 "팝". */
export const CELEBRATE_SPRING = { bounciness: 10, speed: 12 } as const;
/** 🎉 시작 스케일(scale(0) 금지 — fe-craft #5). */
export const CELEBRATE_SCALE_FROM = 0.7;
/** 🎉 화면이 자리잡은 뒤 터지도록 주는 지연(ms). */
export const CELEBRATE_DELAY_MS = 80;
/** ease-out 커브 제어점 — 소비처에서 Easing.bezier(...MOTION_EASE_OUT)로 만든다(fe-craft #3). */
export const MOTION_EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** 모션의 성격 — 'move'는 감소 모션에서 제거하고, 'fade'는 유지한다. */
export const MotionKind = { Move: 'move', Fade: 'fade' } as const;
export type MotionKind = (typeof MotionKind)[keyof typeof MotionKind];

/**
 * 눌림 스케일 목표값을 구한다.
 * @param size 눌림 등급(fab 떠 있는 오버레이 / sm 아이콘·아바타 / md 버튼·칩 / lg 카드·행)
 * @param reduceMotion 기기 감소 모션 설정
 * @returns 스케일 목표값. 감소 모션이면 1(스케일 없음 — 불투명도 피드백만 남는다)
 */
export const resolvePressScale = ({
  size,
  reduceMotion,
}: {
  size: PressScaleSize;
  reduceMotion: boolean;
}): number => (reduceMotion ? 1 : PRESS_SCALE[size]);

/**
 * 눌렸을 때 도달할 불투명도를 구한다.
 *   감소 모션에서는 스케일이 1로 접혀 사라지므로(resolvePressScale), 불투명도가 유일한 피드백 수단이 된다.
 *   그래서 감소 모션에서만 바닥값을 적용한다 — 소비처가 킷대로 `1`(스케일만)을 줘도 반응이 0이 되지 않는다.
 *   평상 경로(감소 모션 OFF)는 소비처 값을 1픽셀도 바꾸지 않는다(킷 값 정확 재현).
 * @param pressedOpacity 소비처가 지정한 눌림 불투명도
 * @param reduceMotion 기기 감소 모션 설정
 * @returns 실제로 적용할 눌림 불투명도. 감소 모션이면 바닥값 이하로만(더 진한 소비처 값은 그대로 존중)
 */
export const resolvePressedOpacity = ({
  pressedOpacity,
  reduceMotion,
}: {
  pressedOpacity: number;
  reduceMotion: boolean;
}): number =>
  reduceMotion ? Math.min(pressedOpacity, PRESSED_OPACITY.reduceMotionFloor) : pressedOpacity;

/**
 * 감소 모션을 반영한 이동 거리를 구한다(이동은 감소 모션에서 완전히 제거 — fe-craft #8).
 * @param distance 원래 이동 거리(px)
 * @param reduceMotion 기기 감소 모션 설정
 * @returns 실제로 적용할 거리(px). 감소 모션이면 0
 */
export const resolveMotionDistance = ({
  distance,
  reduceMotion,
}: {
  distance: number;
  reduceMotion: boolean;
}): number => (reduceMotion ? 0 : distance);

/**
 * 감소 모션을 반영한 지속시간을 구한다.
 *   move(이동)는 0으로 접어 즉시 제자리에 놓고, fade(불투명도)는 그대로 둔다 —
 *   iOS/Android의 감소 모션은 "이동을 크로스페이드로 대체"이지 "모든 전이 제거"가 아니다(fe-craft #8).
 * @param durationMs 원래 지속시간(ms)
 * @param kind 모션 성격('move' | 'fade')
 * @param reduceMotion 기기 감소 모션 설정
 * @returns 실제로 적용할 지속시간(ms)
 */
export const resolveMotionDuration = ({
  durationMs,
  kind,
  reduceMotion,
}: {
  durationMs: number;
  kind: MotionKind;
  reduceMotion: boolean;
}): number => (reduceMotion && kind === MotionKind.Move ? 0 : durationMs);
