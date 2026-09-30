// src/navigation/screens/CodeInput/CodeInput.spec.tsx
// 6셀 코드 입력 — 셀 렌더·정규화(normalizeInviteCodeInput) 위임·글자별 셀 채움 (plan §6.5 / §5 T6, AC10·C6).
//   code-input-a11y: 화면 읽기 기능에 "초대코드" 입력란 하나로 노출(셀 6개는 숨김), 셀 탭 포커스 유지.
import React from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { fireEvent, isHiddenFromAccessibility, screen, within } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
import { renderWithTheme } from '@/test/renderWithTheme';

import { CodeInput } from './CodeInput';

const CELL_COUNT = 6;
const INPUT_LABEL = '초대코드';
const INCLUDE_HIDDEN = { includeHiddenElements: true };
const CODE_STATES = ['', 'AB', 'ABCDEF'];
// 따로 지정하지 않아도 화면 읽기 항목이 될 수 있는 호스트(근사). TextInput은 두 플랫폼 모두 accessible 기본값이 참이다.
//   Text는 iOS에서 기본값이 참이고, Android에서는 누를 수 없으면 거짓이지만 글자가 있으면 TalkBack이 읽는다.
const DEFAULT_ACCESSIBLE_HOSTS = ['Text', 'TextInput'];

/** 판정에 쓰는 렌더 트리 노드의 최소 형태(react-test-renderer ReactTestInstance와 구조 호환). */
type TreeNode = {
  type: unknown;
  props: Record<string, unknown>;
  parent: TreeNode | null;
  findAll: (predicate: (node: TreeNode) => boolean) => TreeNode[];
};

// 노드 이름 — testID가 없으면 호스트 타입 이름을 쓴다(이름표 없는 래퍼가 끼어들어도 단언에서 드러나게). map 콜백으로 쓴다.
const nameOf = (node: TreeNode) => {
  const testId = node.props.testID;
  return typeof testId === 'string' && testId.length > 0 ? testId : String(node.type);
};

/** 스타일을 한 객체로 펼친다(배열·undefined 포함). */
const flattenStyle = ({ node }: { node: TreeNode }) =>
  StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {};

/**
 * 노드 자신이나 조상 가운데 조건에 맞는 것이 있는지 본다(숨김은 조상에서 상속된다).
 * @param node 시작 노드
 * @param test 노드 하나를 판정하는 함수
 * @returns 하나라도 맞으면 true
 */
const selfOrAncestorMatches = ({ node, test }: { node: TreeNode; test: (candidate: TreeNode) => boolean }) => {
  let current: TreeNode | null = node;
  while (current !== null) {
    if (test(current)) return true;
    current = current.parent;
  }
  return false;
};

// 두 플랫폼 공통으로 가리는 것: aria-hidden(View가 양쪽 속성으로 바꿔 준다)과 display:none.
const isHiddenOnBoth = (node: TreeNode) =>
  node.props['aria-hidden'] === true || flattenStyle({ node }).display === 'none';

// iOS에서 화면 읽기 항목인 호스트인지(근사) — findAll 조건 함수로 쓴다.
//   접근성 요소(accessible 참이거나 기본이 참인 Text·TextInput)이고, 자신·조상이 accessibilityElementsHidden으로 숨기지 않은 것.
//   importantForAccessibility는 iOS가 처리하지 않으므로 보지 않는다.
const isIosItem = (node: TreeNode) =>
  typeof node.type === 'string' &&
  (node.props.accessible === true || DEFAULT_ACCESSIBLE_HOSTS.includes(node.type)) &&
  node.props.accessible !== false &&
  !selfOrAncestorMatches({
    node,
    test: (candidate) => candidate.props.accessibilityElementsHidden === true || isHiddenOnBoth(candidate),
  });

// Android(TalkBack)에서 항목인 호스트인지(근사) — findAll 조건 함수로 쓴다.
//   accessible·focusable 중 하나가 참이거나 기본 후보(Text·TextInput)이고, accessible false로 끄지 않았고(focusable 참이면 여전히 항목),
//   자신이 importantForAccessibility 'no'가 아니며, 자신·조상이 'no-hide-descendants'로 숨기지 않은 것.
//   accessibilityElementsHidden은 Android가 처리하지 않으므로 보지 않는다.
const isAndroidItem = (node: TreeNode) =>
  typeof node.type === 'string' &&
  (node.props.accessible === true || node.props.focusable === true || DEFAULT_ACCESSIBLE_HOSTS.includes(node.type)) &&
  !(node.props.accessible === false && node.props.focusable !== true) &&
  node.props.importantForAccessibility !== 'no' &&
  !selfOrAncestorMatches({
    node,
    test: (candidate) => candidate.props.importantForAccessibility === 'no-hide-descendants' || isHiddenOnBoth(candidate),
  });

/**
 * 입력란과 셀을 함께 품는 가장 가까운 호스트 조상 — CodeInput이 그리는 영역의 뿌리를 찾는다.
 *   입력란만 감싸는 래퍼가 끼어들어도 셀까지 검사 범위에 남도록 "셀을 품는가"로 고른다.
 * @returns CodeInput 루트 호스트 요소
 */
const findCodeInputRoot = (): TreeNode => {
  let current = (screen.getByTestId('code-hidden-input') as TreeNode).parent;
  while (current !== null) {
    const hasCell = current.findAll((node) => node.props.testID === 'code-cell-0').length > 0;
    if (typeof current.type === 'string' && hasCell) return current;
    current = current.parent;
  }
  throw new Error('입력란과 셀을 함께 품는 호스트 조상이 없다');
};

/**
 * 요소부터 루트까지의 호스트 가운데 display:none이 없으면 참이다.
 *   RNTL은 display:none도 "숨김"으로 봐서, 숨김 요소까지 조회하는 단언만으로는 글자가 화면에서 사라지는 퇴행을 못 잡는다.
 * @param element 시작 요소
 * @param root 멈출 루트(포함)
 * @returns 루트까지 가려지지 않고 그려지면 true
 */
const isDisplayedWithin = ({ element, root }: { element: TreeNode; root: TreeNode }) => {
  let current: TreeNode | null = element;
  while (current !== null) {
    if (typeof current.type === 'string' && flattenStyle({ node: current }).display === 'none') return false;
    if (current === root) return true;
    current = current.parent;
  }
  return false;
};

/**
 * 입력란의 부모부터 루트까지 호스트 조상의 투명도 값을 모은다(값을 준 조상만).
 * @param root 멈출 루트(포함)
 * @returns 투명도 배열(가까운 조상부터)
 */
const collectAncestorOpacities = ({ root }: { root: TreeNode }) => {
  const opacities: number[] = [];
  let current = (screen.getByTestId('code-hidden-input') as TreeNode).parent;
  while (current !== null) {
    const { opacity } = flattenStyle({ node: current });
    if (typeof current.type === 'string' && typeof opacity === 'number') opacities.push(opacity);
    if (current === root) break;
    current = current.parent;
  }
  return opacities;
};

describe('CodeInput', () => {
  // 셀은 화면 읽기 기능에서 숨겨져 있으므로(code-input-a11y) 셀 자체를 확인할 때는 숨김 요소까지 조회한다.
  it('6개의 코드 셀을 렌더한다', () => {
    renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('code-cell-0', INCLUDE_HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('code-cell-5', INCLUDE_HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('code-cell-6', INCLUDE_HIDDEN)).toBeNull();
  });

  it('입력값을 normalizeInviteCodeInput로 정규화해 onChangeText에 전달한다 (AC10·C6)', () => {
    const onChangeText = jest.fn();
    renderWithTheme(<CodeInput value="" onChangeText={onChangeText} />);
    // "abc 12" → 소문자 대문자화 + 공백/혼동문자(0,1) 제거. 0,1은 charset 외라 무시.
    fireEvent.changeText(screen.getByTestId('code-hidden-input'), 'abc 1z');
    expect(onChangeText).toHaveBeenCalledWith('ABCZ');
  });

  it('혼동문자(0/O/1/I)는 정규화로 제거된다 (AC10)', () => {
    const onChangeText = jest.fn();
    renderWithTheme(<CodeInput value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByTestId('code-hidden-input'), '0O1I');
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('value의 글자를 각 셀에 표시한다', () => {
    renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
    expect(screen.getByText('A', INCLUDE_HIDDEN)).toBeTruthy();
    expect(screen.getByText('B', INCLUDE_HIDDEN)).toBeTruthy();
  });

  it('입력한 글자는 제자리 셀에 보인다 — 셀은 화면 읽기에서만 숨고 화면에서는 사라지지 않는다', () => {
    renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
    const root = findCodeInputRoot();
    const glyphs = [
      within(screen.getByTestId('code-cell-0', INCLUDE_HIDDEN)).getByText('A', INCLUDE_HIDDEN),
      within(screen.getByTestId('code-cell-1', INCLUDE_HIDDEN)).getByText('B', INCLUDE_HIDDEN),
    ];
    // 글자 자신부터 셀·행·루트까지 display:none이 없어야 한다.
    glyphs.forEach((glyph) => {
      expect(isDisplayedWithin({ element: glyph as TreeNode, root })).toBe(true);
    });
  });

  describe('화면 읽기 기능 노출 (code-input-a11y)', () => {
    // 요소끼리 toBe로 비교하면 실패 시 렌더 트리 전체를 출력해 매우 느려진다 — testID 문자열로 비교한다.
    //   RNTL getByLabelText는 aria-label도 맞춰 주지만 RN 0.76 TextInput은 aria-label을 네이티브로 넘기지 않는다 — prop 이름까지 잠근다.
    it('숨김 입력란이 "초대코드" 이름으로 조회된다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      expect(screen.getByLabelText(INPUT_LABEL).props.testID).toBe('code-hidden-input');
      expect(screen.getByTestId('code-hidden-input').props.accessibilityLabel).toBe(INPUT_LABEL);
    });

    it('입력란 자신은 접근성 요소다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      expect(screen.getByTestId('code-hidden-input').props.accessible).not.toBe(false);
    });

    // 핵심 인수조건 — 값이 비었을 때만이 아니라 입력 중·완성 상태에서도 항목이 하나로 유지되는지 플랫폼 규칙별로 본다.
    //   두 플랫폼은 숨김 속성을 서로 다르게 읽으므로(iOS는 accessibilityElementsHidden, Android는 importantForAccessibility) 따로 판정한다.
    it.each(CODE_STATES)('iOS 기준: 값이 %j일 때 코드 영역의 화면 읽기 항목은 입력란 하나뿐이다', (value) => {
      renderWithTheme(<CodeInput value={value} onChangeText={() => {}} />);
      expect(findCodeInputRoot().findAll(isIosItem).map(nameOf)).toStrictEqual(['code-hidden-input']);
    });

    it.each(CODE_STATES)('Android 기준: 값이 %j일 때 코드 영역의 화면 읽기 항목은 입력란 하나뿐이다', (value) => {
      renderWithTheme(<CodeInput value={value} onChangeText={() => {}} />);
      expect(findCodeInputRoot().findAll(isAndroidItem).map(nameOf)).toStrictEqual(['code-hidden-input']);
    });

    // iOS 조상 사슬은 공용 헬퍼로 확인한다(docs/testing-strategy.md "접근성 단언"). Android 쪽 래퍼는 위 Android 기준 판정이 focusable까지 본다.
    it('입력란을 감싸는 접근성 요소가 없다 — iOS가 입력란을 가려 하나로 합치지 않는다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      expect(findAccessibleAncestors({ element: screen.getByTestId('code-hidden-input') })).toStrictEqual([]);
    });

    it('입력란 자체는 접근성에서 숨기지 않는다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      expect(isHiddenFromAccessibility(screen.getByTestId('code-hidden-input'))).toBe(false);
    });

    it('입력한 코드는 입력란의 값으로 전달된다 — 화면 읽기 기능은 셀 대신 이 값을 읽는다', () => {
      renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
      expect(screen.getByLabelText(INPUT_LABEL).props.value).toBe('AB');
    });

    it('셀 6개는 화면 읽기 기능에서 숨긴다 — 글자가 따로따로 읽히지 않는다', () => {
      renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
      Array.from({ length: CELL_COUNT }).forEach((_, index) => {
        const cell = screen.getByTestId(`code-cell-${index}`, INCLUDE_HIDDEN);
        expect(isHiddenFromAccessibility(cell)).toBe(true);
      });
      expect(screen.queryByText('A')).toBeNull();
      expect(screen.queryByText('B')).toBeNull();
    });

    // 셀마다 두는 이유는 CodeInput.tsx 주석(행에 두면 새 아키텍처·Android에서 행이 새 네이티브 뷰가 된다).
    it('셀마다 iOS·Android 숨김 속성을 모두 가진다', () => {
      renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
      Array.from({ length: CELL_COUNT }).forEach((_, index) => {
        const cell = screen.getByTestId(`code-cell-${index}`, INCLUDE_HIDDEN);
        expect(cell.props.accessibilityElementsHidden).toBe(true);
        expect(cell.props.importantForAccessibility).toBe('no-hide-descendants');
      });
    });

    // 투명도는 0보다 크고 0.01보다 작아야 한다. 둘 다 jest가 흉내 내지 못하는 기기 규칙이라 값 자체를 잠근다.
    //   0이면: 화면 읽기 기능이 입력란을 뺀다(iOS 시뮬레이터 실측 — 입력란이 트리에서 사라짐). 입력란의 조상이 투명도 0이어도 같다.
    //   0.01보다 크면: 새 아키텍처 iOS의 터치 판정(alpha < 0.01이면 제외)에 입력란이 들어가 셀 사이 틈·가장자리 탭을 직접 받는다
    //   (커서가 글자 사이로 옮겨져 다음 글자가 중간에 끼어들 수 있다). 정확히 0.01은 float 반올림으로 겨우 빠지는 경계라 쓰지 않는다.
    it('숨김 입력란의 투명도는 0보다 크고 0.01보다 작으며, 입력란을 감싼 조상에도 투명도 0이 없다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      const { opacity } = flattenStyle({ node: screen.getByTestId('code-hidden-input') });
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(0.01);
      const ancestorOpacities = collectAncestorOpacities({ root: findCodeInputRoot() });
      expect(ancestorOpacities.filter((value) => value <= 0)).toStrictEqual([]);
    });

    it('숨김 입력란은 글자와 커서를 그리지 않는다 — 킷 비주얼(셀만 보임) 유지', () => {
      renderWithTheme(<CodeInput value="AB" onChangeText={() => {}} />);
      const input = screen.getByTestId('code-hidden-input');
      expect(flattenStyle({ node: input }).color).toBe('transparent');
      expect(input.props.caretHidden).toBe(true);
    });
  });

  describe('셀 탭 포커스 (기존 동작 유지)', () => {
    // TextInput은 jest에서 목 컴포넌트라 focus가 네이티브로 가지 않는다 — ref 메서드 호출로 "포커스 요청"을 관찰한다.
    let focusSpy: jest.SpyInstance;
    beforeEach(() => {
      focusSpy = jest.spyOn(TextInput.prototype, 'focus');
    });
    afterEach(() => {
      focusSpy.mockRestore();
    });

    it('셀 영역을 탭하면 숨김 입력란에 포커스를 요청한다', () => {
      renderWithTheme(<CodeInput value="" onChangeText={() => {}} />);
      focusSpy.mockClear();
      fireEvent.press(screen.getByTestId('code-cell-3', INCLUDE_HIDDEN));
      expect(focusSpy).toHaveBeenCalledTimes(1);
    });
  });
});
