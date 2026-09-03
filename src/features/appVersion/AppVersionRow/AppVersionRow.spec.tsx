// src/features/appVersion/AppVersionRow/AppVersionRow.spec.tsx
// Profile 앱 버전 행(app-update-actions T3) — 상태별 렌더 프리젠테이션.
//   버전 문자열·업데이트 상태는 props(값 배선=developer). 여기선 상태별 렌더 분기·액션 콜백만 본다.
//   role/testID 우선(정확 문구는 ui-spec 확정 후 검증).
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { AppVersionRow } from './AppVersionRow';

const AVAILABLE_STATUS = {
  kind: 'available',
  storeUrl: 'https://apps.apple.com/app/id6782955594',
} as const;

describe('AppVersionRow', () => {
  it('status 미지정(기본 checking) — "앱 버전 {version}"만 렌더한다(후방호환)', () => {
    renderWithTheme(<AppVersionRow version="1.0.0" />);
    expect(screen.getByText('앱 버전 1.0.0')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('다른 버전 문자열도 그대로 표시한다', () => {
    renderWithTheme(<AppVersionRow version="2.3.1" status={{ kind: 'checking' }} />);
    expect(screen.getByText('앱 버전 2.3.1')).toBeTruthy();
  });

  it('checking — 버전만·업데이트 액션 없음', () => {
    renderWithTheme(<AppVersionRow version="1.2.0" status={{ kind: 'checking' }} />);
    expect(screen.getByText('앱 버전 1.2.0')).toBeTruthy();
    expect(screen.queryByTestId('app-version-update')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('unknown — 버전만·상태 주장 없음(fail-open)', () => {
    renderWithTheme(<AppVersionRow version="1.2.0" status={{ kind: 'unknown' }} />);
    expect(screen.getByText('앱 버전 1.2.0')).toBeTruthy();
    expect(screen.queryByTestId('app-version-update')).toBeNull();
    expect(screen.queryByText('최신 버전이에요')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('available + storeUrl 있음 — 업데이트 액션(role button) 노출', () => {
    renderWithTheme(
      <AppVersionRow
        version="1.2.0"
        status={{ kind: 'available', storeUrl: 'https://apps.apple.com/app/id6782955594' }}
        onUpdatePress={() => {}}
      />,
    );
    expect(screen.getByText('앱 버전 1.2.0')).toBeTruthy();
    expect(screen.getByTestId('app-version-update')).toBeTruthy();
    expect(screen.getByText('업데이트하기')).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('available + storeUrl 있음 — 액션 탭 시 onUpdatePress 1회 호출', () => {
    const onUpdatePress = jest.fn();
    renderWithTheme(
      <AppVersionRow
        version="1.2.0"
        status={{ kind: 'available', storeUrl: 'https://apps.apple.com/app/id6782955594' }}
        onUpdatePress={onUpdatePress}
      />,
    );
    fireEvent.press(screen.getByTestId('app-version-update'));
    expect(onUpdatePress).toHaveBeenCalledTimes(1);
  });

  it('available + storeUrl null — 열 스토어 없음 → 버전만·액션 없음(Android 미출시 엣지)', () => {
    renderWithTheme(
      <AppVersionRow
        version="1.2.0"
        status={{ kind: 'available', storeUrl: null }}
        onUpdatePress={() => {}}
      />,
    );
    expect(screen.getByText('앱 버전 1.2.0')).toBeTruthy();
    expect(screen.queryByTestId('app-version-update')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('latest — "최신 버전이에요" passive 라벨·액션 없음', () => {
    renderWithTheme(<AppVersionRow version="1.2.0" status={{ kind: 'latest' }} />);
    expect(screen.getByText('앱 버전 1.2.0')).toBeTruthy();
    expect(screen.getByText('최신 버전이에요')).toBeTruthy();
    expect(screen.queryByTestId('app-version-update')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ── 프레스 치환 A1(motion-press-final D1 / plan §5-1 T9·T10·T18) ────────────────────────
//   seam = testID로 조회한 노드의 (a) onPress 횟수 (b) flatten style의 transform 키 유무.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §5-2 — 실값은 motion.spec가 잠갔다).
describe('AppVersionRow — 업데이트 액션 눌림 피드백(motion-press-final A1, U30)', () => {
  // 감소 모션 OFF/ON 고정 — transform 단언은 OS 설정에 의존하면 안 된다(MotionPressable.spec 선례).
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flattenAction = () =>
    StyleSheet.flatten(screen.getByTestId('app-version-update').props.style) as Record<
      string,
      unknown
    >;

  const renderAvailableRow = ({ onUpdatePress }: { onUpdatePress?: () => void } = {}) => {
    renderWithTheme(
      <AppVersionRow version="1.2.0" status={AVAILABLE_STATUS} onUpdatePress={onUpdatePress} />,
    );
  };

  it('T9: 감소 모션 OFF — 업데이트 액션에 눌림 모션(transform)이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderAvailableRow();
    await waitFor(() => expect(flattenAction().transform).toBeDefined());
  });

  it('T10: 감소 모션 ON — transform 없이 불투명도 피드백만 남는다(fe-craft #8)', async () => {
    mockReduceMotion({ enabled: true });
    renderAvailableRow();
    await waitFor(() => expect(flattenAction().opacity).toBeDefined());
    expect(flattenAction().transform).toBeUndefined();
  });

  it('T18: pressIn→pressOut→press를 3회 반복해도 onUpdatePress가 정확히 3회 발화한다', () => {
    const onUpdatePress = jest.fn();
    renderAvailableRow({ onUpdatePress });
    const action = screen.getByTestId('app-version-update');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent(action, 'pressIn');
      fireEvent(action, 'pressOut');
      fireEvent.press(action);
    }
    expect(onUpdatePress).toHaveBeenCalledTimes(3);
  });

  it('D1-f: style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderAvailableRow();
    expect(warn).not.toHaveBeenCalled();
  });
});
