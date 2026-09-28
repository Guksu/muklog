// src/features/map/components/MapPermissionBanner/MapPermissionBanner.spec.tsx
// 위치 권한 거부 안내 배너 — 킷 원본 없음(MapStatusOverlay 스킨 + 킷 위시 행 [행동 버튼][닫기 X] 파생, ui-spec §2).
//   seam = props → 렌더(문구·버튼 라벨) · 콜백 횟수 · 접근성 prop(role/label/hint/liveRegion) · 터치 영역 · 스킨 토큰.
//   ⚠ 노출 조건·배치(절대 위치)는 부모(MapTabScreen) 소유 — 컴포넌트가 배치 스타일을 갖지 않음을 함께 잠근다.
//   비주얼 픽셀(높이 ≤88·줄바꿈)은 디바이스 스모크 D5·qa-visual. 여기선 그 계산의 입력값(치수·hitSlop)만 단언.
import React from 'react';
import { AccessibilityInfo, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { MapPermissionBanner, type MapPermissionBannerProps } from './MapPermissionBanner';

// ThemeProvider 기본은 light(MVP 고정) — 토큰 실값 비교에 themes.light 직접 참조.
const light = themes.light;

// 최소 터치 타깃(iOS HIG 44pt) — plan §4.8·UP3.
const MIN_TOUCH_TARGET = 44;

const COPY = {
  message: '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
  actionLabel: '설정 열기',
  actionHint: '기기 설정에서 위치 권한을 허용할 수 있어요',
  dismissLabel: '위치 안내 닫기',
} as const;

const renderBanner = (overrides: Partial<MapPermissionBannerProps> = {}) => {
  const onAction = jest.fn();
  const onDismiss = jest.fn();
  renderWithTheme(
    <MapPermissionBanner
      message={COPY.message}
      actionLabel={COPY.actionLabel}
      actionHint={COPY.actionHint}
      onAction={onAction}
      dismissLabel={COPY.dismissLabel}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onAction, onDismiss };
};

const flatten = ({ style }: { style: unknown }) =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle & TextStyle;

describe('MapPermissionBanner — 렌더·콜백(plan §3.5·UP2)', () => {
  it('안내 문구와 행동 버튼 라벨을 그대로 렌더한다(카피 단일 출처는 호출부)', () => {
    renderBanner();
    expect(screen.getByText(COPY.message)).toBeTruthy();
    expect(screen.getByText(COPY.actionLabel)).toBeTruthy();
  });

  it('행동 버튼 탭 → onAction만 1회(onDismiss 0)', () => {
    const { onAction, onDismiss } = renderBanner();
    fireEvent.press(screen.getByRole('button', { name: COPY.actionLabel }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('닫기 버튼 탭 → onDismiss만 1회(onAction 0)', () => {
    const { onAction, onDismiss } = renderBanner();
    fireEvent.press(screen.getByRole('button', { name: COPY.dismissLabel }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('닫기는 close 아이콘 단독 버튼이다(텍스트 글리프 ×·✕ 아님)', () => {
    renderBanner();
    expect(screen.getByTestId('icon-close')).toBeTruthy();
    expect(screen.queryByText('×')).toBeNull();
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('testID: 루트 기본 map-permission-banner, 행동 map-permission-action, 닫기 map-permission-dismiss', () => {
    renderBanner();
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
    expect(screen.getByTestId('map-permission-action')).toBeTruthy();
    expect(screen.getByTestId('map-permission-dismiss')).toBeTruthy();
  });

  it('testID prop이 주어지면 루트 식별자를 덮어쓴다', () => {
    renderBanner({ testID: 'custom-banner' });
    expect(screen.getByTestId('custom-banner')).toBeTruthy();
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();
  });

  it('안내 문구는 말줄임하지 않는다(numberOfLines 미지정 — 행동 이유가 잘리면 안 된다)', () => {
    renderBanner();
    expect(screen.getByText(COPY.message).props.numberOfLines).toBeUndefined();
  });

  // QA 반영 1회차(QV-1): RN iOS 기본 줄바꿈 전략은 'none'이라 한글을 음절 사이에서 끊는다
  //   (430pt "…볼 수 있어 / 요" 한 글자 과부 줄). 어절 단위로 끊어야 "…볼 수 / 있어요"가 된다.
  it('안내 문구는 iOS에서 어절 단위로 줄바꿈한다(lineBreakStrategyIOS hangul-word)', () => {
    renderBanner();
    expect(screen.getByText(COPY.message).props.lineBreakStrategyIOS).toBe('hangul-word');
  });
});

describe('MapPermissionBanner — 접근성(plan §4.8·UP3)', () => {
  it('행동 버튼: role button + 라벨 = actionLabel + 힌트 = actionHint', () => {
    renderBanner();
    const action = screen.getByRole('button', { name: COPY.actionLabel });
    expect(action.props.accessibilityLabel).toBe(COPY.actionLabel);
    expect(action.props.accessibilityHint).toBe(COPY.actionHint);
  });

  it('actionHint 미지정이면 힌트를 붙이지 않는다(선택 prop)', () => {
    renderBanner({ actionHint: undefined });
    const action = screen.getByRole('button', { name: COPY.actionLabel });
    expect(action.props.accessibilityHint).toBeUndefined();
  });

  it('닫기 버튼: role button + 라벨 = dismissLabel(아이콘 단독이라 필수)', () => {
    renderBanner();
    const dismiss = screen.getByRole('button', { name: COPY.dismissLabel });
    expect(dismiss.props.accessibilityLabel).toBe(COPY.dismissLabel);
  });

  it('루트는 polite 라이브 영역이고 accessible 그룹이 아니다(두 버튼이 각각 포커스돼야 한다)', () => {
    renderBanner();
    const root = screen.getByTestId('map-permission-banner');
    expect(root.props.accessibilityLiveRegion).toBe('polite');
    expect(root.props.accessible).not.toBe(true);
  });

  it('행동 버튼 실효 터치 높이(패딩 + 라벨 줄높이 + 세로 hitSlop) ≥ 44pt', () => {
    renderBanner();
    const action = screen.getByRole('button', { name: COPY.actionLabel });
    const box = flatten({ style: action.props.style });
    const label = flatten({ style: screen.getByText(COPY.actionLabel).props.style });
    const hitSlop = action.props.hitSlop as { top?: number; bottom?: number } | undefined;
    const effectiveHeight =
      Number(box.paddingVertical) * 2 +
      Number(label.lineHeight) +
      (hitSlop?.top ?? 0) +
      (hitSlop?.bottom ?? 0);
    expect(effectiveHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('행동 버튼 hitSlop은 가로로 번지지 않는다(바로 옆 닫기 버튼과 터치 영역 겹침 0)', () => {
    renderBanner();
    const hitSlop = screen.getByRole('button', { name: COPY.actionLabel }).props.hitSlop as {
      left?: number;
      right?: number;
    };
    expect(hitSlop.left ?? 0).toBe(0);
    expect(hitSlop.right ?? 0).toBe(0);
  });

  it('닫기 버튼은 치수 자체로 44×44pt 이상이다(hitSlop 없이)', () => {
    renderBanner();
    const dismiss = screen.getByRole('button', { name: COPY.dismissLabel });
    const box = flatten({ style: dismiss.props.style });
    expect(Number(box.width)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(Number(box.height)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(dismiss.props.hitSlop).toBeUndefined();
  });
});

describe('MapPermissionBanner — 스킨·레이아웃 책임(plan §4.3, ui-spec §2)', () => {
  it('스킨은 MapStatusOverlay 파생: surface 배경 · 헤어라인 보더 · radius.card · shadow.md', () => {
    renderBanner();
    const root = flatten({ style: screen.getByTestId('map-permission-banner').props.style });
    expect(root.backgroundColor).toBe(light.color.surface);
    expect(root.borderColor).toBe(light.color.hairline);
    expect(root.borderWidth).toBe(StyleSheet.hairlineWidth);
    expect(root.borderRadius).toBe(light.radius.card);
    expect(root.shadowOpacity).toBe(light.shadow.md.shadowOpacity);
    expect(root.shadowRadius).toBe(light.shadow.md.shadowRadius);
  });

  it('한 줄 배치: 문구 · 설정 열기 · 닫기가 가로로 놓인다(높이 ≤88 계산의 전제)', () => {
    renderBanner();
    const root = flatten({ style: screen.getByTestId('map-permission-banner').props.style });
    expect(root.flexDirection).toBe('row');
    expect(root.alignItems).toBe('center');
  });

  it('문구는 bodySm(14px) · fgWeak — 같은 지도 안내인 MapStatusOverlay와 같은 급', () => {
    renderBanner();
    const message = flatten({ style: screen.getByText(COPY.message).props.style });
    expect(message.fontSize).toBe(light.typography.bodySm.fontSize);
    expect(message.lineHeight).toBe(light.typography.bodySm.lineHeight);
    expect(message.color).toBe(light.color.fgWeak);
  });

  it('행동 버튼은 MapStatusOverlay "다시 시도"와 같은 Button soft(primaryWeak 배경 + accentStrong 라벨)', () => {
    renderBanner();
    const action = flatten({
      style: screen.getByRole('button', { name: COPY.actionLabel }).props.style,
    });
    const label = flatten({ style: screen.getByText(COPY.actionLabel).props.style });
    expect(action.backgroundColor).toBe(light.color.primaryWeak);
    expect(label.color).toBe(light.color.accentStrong);
  });

  it('자기 배치를 모른다 — 루트에 절대 배치·좌표 스타일이 없다(부모 래퍼 책임)', () => {
    renderBanner();
    const root = flatten({ style: screen.getByTestId('map-permission-banner').props.style });
    expect(root.position).toBeUndefined();
    expect(root.top).toBeUndefined();
    expect(root.bottom).toBeUndefined();
    expect(root.left).toBeUndefined();
    expect(root.right).toBeUndefined();
  });
});

describe('MapPermissionBanner — 눌림 피드백(MotionPressable 계약)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  it('감소 모션 OFF — 닫기 버튼에 눌림 모션(transform)이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderBanner();
    await waitFor(() =>
      expect(
        flatten({ style: screen.getByRole('button', { name: COPY.dismissLabel }).props.style })
          .transform,
      ).toBeDefined(),
    );
  });

  it('style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderBanner();
    expect(warn).not.toHaveBeenCalled();
  });
});
