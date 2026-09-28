// src/features/map/components/MapResearchButton/MapResearchButton.spec.tsx
// "이 지역에서 검색" 재검색 pill — 킷 원본 없음(패턴 파생: MkButton sm 골격 + MapLocateButton 떠있는 레이어 스킨).
//   비주얼·배치(pill 높이/그림자/상단 중앙)는 디바이스 스모크·qa-visual. 여기선 렌더·카피·onPress·접근성만 단언.
//   ⚠ 노출 조건(researchState가 Hidden인지)은 부모(MapTabScreen)가 소유 — 컴포넌트는 "어떤 모양인가"(state)만 받고
//     "보일지 말지"(visible)는 받지 않음을 함께 잠근다(map-nearby-feedback).
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { themes } from '@/theme';
import { renderWithTheme } from '@/test/renderWithTheme';

import { MAP_RESEARCH_COPY, MapResearchButton, MapResearchButtonState } from './MapResearchButton';

// ThemeProvider 기본은 light(MVP 고정) — 토큰 실값 비교에 themes.light 직접 참조(MapPermissionBanner.spec 선례).
const light = themes.light;

describe('MapResearchButton', () => {
  it('"이 지역에서 검색" 라벨을 렌더한다(카피 단일 출처)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByText('이 지역에서 검색')).toBeTruthy();
  });

  it('버튼 role과 카피와 같은 접근성 라벨을 노출한다', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    const button = screen.getByLabelText('이 지역에서 검색');
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('search 아이콘을 렌더한다', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByTestId('icon-search')).toBeTruthy();
  });

  it('탭하면 onPress 콜백을 1회 호출한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapResearchButton onPress={handlePress} />);
    fireEvent.press(screen.getByLabelText('이 지역에서 검색'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('testID를 그대로 전달한다(부모 조건 렌더 검증용)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(screen.getByTestId('map-research-button')).toBeTruthy();
  });

  it('자기 노출 조건을 모른다 — 렌더되면 항상 보인다(visible prop 없음)', () => {
    // 부모가 researchState(Hidden이면 미렌더)로 조건 렌더하는 계약. 컴포넌트에 표시 여부가 새면
    // 노출 규칙이 두 곳(훅·컴포넌트)으로 갈라진다 — state는 모양(Idle/Searching/Failed)만 고르고 Hidden 값이 없다.
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(screen.getByTestId('map-research-button')).toBeTruthy();
    expect(screen.queryByLabelText('이 지역에서 검색')).toBeTruthy();
  });
});

// ── 프레스 치환 B2(motion-press-final D3 / plan §5-1 T14·T15·T18) ──────────────────────
//   seam = 접근성 라벨로 조회한 노드의 (a) onPress 횟수 (b) hitSlop prop (c) transform 키 유무.
describe('MapResearchButton — 눌림 피드백 부착(motion-press-final B2, U30)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flattenPill = () =>
    StyleSheet.flatten(screen.getByLabelText('이 지역에서 검색').props.style) as Record<
      string,
      unknown
    >;

  it('T14: hitSlop이 렌더 노드에 그대로 전달된다(최소 터치 타깃 45pt 보존)', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    expect(screen.getByLabelText('이 지역에서 검색').props.hitSlop).toEqual({
      top: 5,
      bottom: 5,
      left: 8,
      right: 8,
    });
  });

  it('T15-a: 감소 모션 OFF — 눌림 모션(transform)이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    await waitFor(() => expect(flattenPill().transform).toBeDefined());
  });

  it('T15-b: 감소 모션 ON — transform 없이 불투명도 피드백만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(<MapResearchButton onPress={() => {}} />);
    await waitFor(() => expect(flattenPill().opacity).toBeDefined());
    expect(flattenPill().transform).toBeUndefined();
  });

  it('T18: pressIn→pressOut→press를 3회 반복해도 onPress가 정확히 3회 발화한다', () => {
    const handlePress = jest.fn();
    renderWithTheme(<MapResearchButton onPress={handlePress} />);
    const pill = screen.getByLabelText('이 지역에서 검색');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent(pill, 'pressIn');
      fireEvent(pill, 'pressOut');
      fireEvent.press(pill);
    }
    expect(handlePress).toHaveBeenCalledTimes(3);
  });

  it('D3-f: style에 정적 opacity를 넘기지 않는다 — MotionPressable 경고 0건', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithTheme(<MapResearchButton onPress={() => {}} testID="map-research-button" />);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ── 상태별 비주얼(map-nearby-feedback, UX 백로그 U10 ①②) ──────────────────────────────
//   seam = props(state·onPress·testID) → 렌더된 문구·스피너·아이콘, onPress 횟수, 접근성 prop, 토큰 색.
//   상태 판단(훅 researchState → state 매핑)과 노출(Hidden이면 미렌더)은 부모 몫이라 여기서 다루지 않는다.
describe('MapResearchButton — 상태별 비주얼(map-nearby-feedback, U10)', () => {
  const FAILED_ACCESSIBILITY_LABEL = '주변 음식점을 불러오지 못했어요, 다시 시도';
  const ALL_STATES = [
    MapResearchButtonState.Idle,
    MapResearchButtonState.Searching,
    MapResearchButtonState.Failed,
  ];
  const LABEL_BY_STATE = {
    [MapResearchButtonState.Idle]: '이 지역에서 검색',
    [MapResearchButtonState.Searching]: '검색하는 중이에요',
    [MapResearchButtonState.Failed]: FAILED_ACCESSIBILITY_LABEL,
  } as const;

  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  it('C5: 카피 단일 출처 값이 계약과 같다', () => {
    expect(MAP_RESEARCH_COPY).toEqual({
      idle: '이 지역에서 검색',
      searching: '검색하는 중이에요',
      failedMessage: '주변 음식점을 불러오지 못했어요',
      failedAction: '다시 시도',
    });
    expect(MapResearchButtonState).toEqual({
      Idle: 'idle',
      Searching: 'searching',
      Failed: 'failed',
    });
  });

  it('C1: state 미지정은 Idle과 같다 — 검색 아이콘·라벨, 스피너 없음, busy 아님', () => {
    const { rerender } = renderWithTheme(<MapResearchButton onPress={() => {}} />);
    const assertIdle = () => {
      expect(screen.getByText(MAP_RESEARCH_COPY.idle)).toBeTruthy();
      expect(screen.getByTestId('icon-search')).toBeTruthy();
      expect(screen.queryByTestId('map-research-spinner')).toBeNull();
      const pill = screen.getByLabelText(MAP_RESEARCH_COPY.idle);
      expect(pill.props.accessibilityState?.busy).toBeFalsy();
      expect(pill.props.accessibilityState?.disabled).toBeFalsy();
    };
    assertIdle();
    rerender(<MapResearchButton onPress={() => {}} state={MapResearchButtonState.Idle} />);
    assertIdle();
  });

  it('C2: Searching — 스피너 + "검색하는 중이에요", 검색 아이콘 없음', () => {
    renderWithTheme(
      <MapResearchButton onPress={() => {}} state={MapResearchButtonState.Searching} />,
    );
    expect(screen.getByText(MAP_RESEARCH_COPY.searching)).toBeTruthy();
    expect(screen.getByTestId('map-research-spinner')).toBeTruthy();
    expect(screen.queryByTestId('icon-search')).toBeNull();
    expect(screen.queryByText(MAP_RESEARCH_COPY.idle)).toBeNull();
  });

  it('C2: Searching — 탭을 무시하고 busy·disabled를 알린다(이름 = 보이는 문구)', () => {
    const handlePress = jest.fn();
    renderWithTheme(
      <MapResearchButton onPress={handlePress} state={MapResearchButtonState.Searching} />,
    );
    const pill = screen.getByLabelText(MAP_RESEARCH_COPY.searching);
    for (let attempt = 0; attempt < 3; attempt += 1) fireEvent.press(pill);
    expect(handlePress).not.toHaveBeenCalled();
    expect(pill.props.accessibilityRole).toBe('button');
    expect(pill.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
  });

  it('C2: Searching — 스피너는 라벨과 같은 accentStrong이고 아이콘과 같은 17pt 자리에 들어가 pill 높이가 그대로다', () => {
    renderWithTheme(
      <MapResearchButton onPress={() => {}} state={MapResearchButtonState.Searching} />,
    );
    const spinner = screen.getByTestId('map-research-spinner');
    expect(spinner.props.color).toBe(light.color.accentStrong);
    const slot = StyleSheet.flatten(screen.getByTestId('map-research-spinner-slot').props.style);
    // Idle 검색 아이콘(size 17)과 같은 상자 — 기본 스피너(20)를 그대로 두면 pill이 35 → 38pt로 커진다.
    expect(slot).toEqual(expect.objectContaining({ width: 17, height: 17 }));
  });

  it('C2: Searching — 흐리게 하지 않는다(떠 있는 흰 면이 지도에 비쳐 보이지 않게)', () => {
    renderWithTheme(
      <MapResearchButton
        onPress={() => {}}
        state={MapResearchButtonState.Searching}
        testID="map-research-button"
      />,
    );
    const pill = StyleSheet.flatten(screen.getByTestId('map-research-button').props.style);
    expect(pill.opacity ?? 1).toBe(1);
  });

  it('C3: Failed — 문구 · 다시 시도를 한 텍스트 흐름으로 렌더하고 아이콘·스피너가 없다', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} state={MapResearchButtonState.Failed} />);
    // 한 Text 안의 문구 · 구분점 · 행동 — 줄바꿈이 필요해도 한 덩어리로 흐른다(한 줄 폭 계산은 ui-spec).
    expect(screen.getByText('주변 음식점을 불러오지 못했어요 · 다시 시도')).toBeTruthy();
    expect(screen.getByText(MAP_RESEARCH_COPY.failedMessage)).toBeTruthy();
    expect(screen.getByText(MAP_RESEARCH_COPY.failedAction)).toBeTruthy();
    expect(screen.queryByTestId('icon-search')).toBeNull();
    expect(screen.queryByTestId('map-research-spinner')).toBeNull();
  });

  it('C3: Failed — 탭 1회 = onPress 1회, 접근성 라벨은 쉼표로 이은 문장, busy·disabled 아님', () => {
    const handlePress = jest.fn();
    renderWithTheme(
      <MapResearchButton onPress={handlePress} state={MapResearchButtonState.Failed} />,
    );
    const pill = screen.getByLabelText(FAILED_ACCESSIBILITY_LABEL);
    fireEvent.press(pill);
    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(pill.props.accessibilityRole).toBe('button');
    expect(pill.props.accessibilityState?.busy).toBeFalsy();
    expect(pill.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('C3: Failed — 문구는 지도 안내 급(fgWeak·Medium), 행동은 버튼 급(accentStrong·Bold), 둘 다 14/17', () => {
    renderWithTheme(<MapResearchButton onPress={() => {}} state={MapResearchButtonState.Failed} />);
    const message = StyleSheet.flatten(
      screen.getByText(MAP_RESEARCH_COPY.failedMessage).props.style,
    );
    const action = StyleSheet.flatten(screen.getByText(MAP_RESEARCH_COPY.failedAction).props.style);
    expect(message).toEqual(
      expect.objectContaining({
        color: light.color.fgWeak,
        fontFamily: light.typography.bodySm.fontFamily,
        fontSize: 14,
        lineHeight: 17,
      }),
    );
    expect(action).toEqual(
      expect.objectContaining({
        color: light.color.accentStrong,
        fontFamily: light.typography.button.fontFamily,
        fontSize: 14,
        lineHeight: 17,
      }),
    );
  });

  it('C4: 세 상태 모두 testID·role·hitSlop(최소 터치 45pt)과 떠 있는 레이어 스킨을 유지한다', () => {
    ALL_STATES.forEach((state) => {
      const { unmount } = renderWithTheme(
        <MapResearchButton onPress={() => {}} state={state} testID="map-research-button" />,
      );
      const pill = screen.getByTestId('map-research-button');
      expect(pill.props.accessibilityLabel).toBe(LABEL_BY_STATE[state]);
      expect(pill.props.accessibilityRole).toBe('button');
      expect(pill.props.hitSlop).toEqual({ top: 5, bottom: 5, left: 8, right: 8 });
      const flat = StyleSheet.flatten(pill.props.style);
      expect(flat).toEqual(
        expect.objectContaining({
          backgroundColor: light.color.surface,
          borderRadius: light.radius.full,
          paddingVertical: 9,
          paddingHorizontal: 14,
          shadowOpacity: light.shadow.fab.shadowOpacity,
        }),
      );
      unmount();
    });
  });

  it('C4: 눌림 모션은 Idle·Failed에만 붙고 Searching(탭 무시)에는 붙지 않는다', async () => {
    mockReduceMotion({ enabled: false });
    const flattenPill = () =>
      StyleSheet.flatten(screen.getByTestId('map-research-button').props.style) as Record<
        string,
        unknown
      >;
    const { rerender } = renderWithTheme(
      <MapResearchButton
        onPress={() => {}}
        state={MapResearchButtonState.Failed}
        testID="map-research-button"
      />,
    );
    await waitFor(() => expect(flattenPill().transform).toBeDefined());
    rerender(
      <MapResearchButton
        onPress={() => {}}
        state={MapResearchButtonState.Searching}
        testID="map-research-button"
      />,
    );
    expect(flattenPill().transform).toBeUndefined();
  });

  it('C6: 배치 스타일이 없다 — 절대배치·좌표는 부모 몫(세 상태)', () => {
    ALL_STATES.forEach((state) => {
      const { unmount } = renderWithTheme(
        <MapResearchButton onPress={() => {}} state={state} testID="map-research-button" />,
      );
      const flat = StyleSheet.flatten(screen.getByTestId('map-research-button').props.style);
      ['position', 'top', 'bottom', 'left', 'right'].forEach((key) => {
        expect(flat).not.toHaveProperty(key);
      });
      unmount();
    });
  });
});

// ── 탭 → 검색 중 → 실패 흐름의 눌림 복귀(map-nearby-feedback qa-visual QV-1) ─────────────────────
//   화면에서는 pill 탭의 onPress 안에서 research()가 동기로 검색 중을 켠다 → 복귀 스프링이 시작된 틱에 disabled가 된다.
//   그 뒤 실패(다시 누를 수 있는 상태)로 돌아온 pill이 눌린 모양(0.92 축소 · 감소 모션이면 0.85 흐림)으로 굳으면
//   "다시 시도"가 비활성처럼 보인다. 여기선 그 흐름을 부모 대역(PressToSearch)으로 재현해 정착한 스타일만 읽는다.
describe('MapResearchButton — 검색 중을 거친 실패 pill의 눌림 복귀(QV-1)', () => {
  const flattenPill = () =>
    StyleSheet.flatten(screen.getByTestId('map-research-button').props.style) as Record<
      string,
      unknown
    >;

  // 부모 대역: 탭한 이벤트 안에서 동기로 검색 중이 되고(화면의 research() 첫 상태 변경), failed가 오면 실패로 바뀐다.
  const PressToSearch = ({ failed }: { failed: boolean }) => {
    const [searching, setSearching] = React.useState(false);
    const beforeResult = searching ? MapResearchButtonState.Searching : MapResearchButtonState.Idle;
    return (
      <MapResearchButton
        testID="map-research-button"
        state={failed ? MapResearchButtonState.Failed : beforeResult}
        onPress={() => setSearching(true)}
      />
    );
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // [이름, 감소 모션, 눌렸을 때 transform·opacity, 실패로 돌아온 뒤 transform] — 불투명도는 두 모드 모두 1로 돌아와야 한다.
  it.each([
    ['감소 모션 OFF — 실패 pill이 축소 없이 scale 1', false, [{ scale: 0.92 }], 1, [{ scale: 1 }]],
    ['감소 모션 ON — 실패 pill이 흐림 없이 opacity 1', true, undefined, 0.85, undefined],
  ] as const)('%s', async (_label, reduceMotion, pressedTransform, pressedOpacity, restTransform) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(reduceMotion));
    const { rerender } = renderWithTheme(<PressToSearch failed={false} />);
    await waitFor(() => expect(flattenPill().transform === undefined).toBe(reduceMotion));

    const pill = screen.getByTestId('map-research-button');
    fireEvent(pill, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // 전제: 누름이 실제로 눌린 모양까지 갔다(공허한 green 방지).
    expect(flattenPill().transform).toEqual(pressedTransform);
    expect(flattenPill().opacity).toBeCloseTo(pressedOpacity, 5);

    // 손을 떼는 이벤트 안에서 곧바로 검색 중(disabled) — 복귀 스프링이 시작된 틱이다.
    fireEvent(pill, 'pressOut');
    fireEvent.press(pill);
    expect(screen.getByTestId('map-research-spinner')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    rerender(<PressToSearch failed />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(MAP_RESEARCH_COPY.failedAction)).toBeTruthy();
    expect(flattenPill().transform).toEqual(restTransform);
    expect(flattenPill().opacity).toBeCloseTo(1, 5);
  });
});
