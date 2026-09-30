// src/test/findAccessibleAncestors/findAccessibleAncestors.ts
// 테스트 전용 — "접근성 요소는 자식을 가린다"는 iOS 규칙을 렌더 트리에서 판정한다.
//   iOS는 접근성 요소(isAccessibilityElement)인 뷰의 하위 뷰를 화면 읽기 기능(VoiceOver)에 노출하지 않는다.
//   RN은 accessible=true인 뷰를 접근성 요소로 만들고, 라벨이 없으면 자식 라벨을 이어붙여 하나로 읽는다
//   (RCTView.m RCTRecursiveAccessibilityLabel) — Pressable은 accessible 기본값이 true다.
//   RNTL 쿼리(getByRole·getByLabelText)는 이 가림을 흉내 내지 않아 조상이 접근성 요소여도 자식이 조회된다
//   → 쿼리 성공만으로는 "개별 조작 가능"을 증명하지 못하므로 조상 사슬을 직접 걷는다.
//
// 판정하지 않는 것(한계):
//   · 호스트 Text 조상 — iOS에서 Text는 기본이 접근성 요소지만 jest의 Text 목은 그 기본값을 넣지 않는다.
//     글 안의 링크처럼 Text가 조작 요소를 감싸는 구조에는 이 헬퍼를 쓰지 않는다.
//   · 숨김 속성(accessibilityElementsHidden·importantForAccessibility·aria-hidden·display none)
//     — 숨김은 RNTL 기본 쿼리가 제외하므로 getByRole·getByTestId로 확인한다.
//   · Android 규칙 — TalkBack은 접근성 조상이 있어도 포커스 가능한 자식을 따로 잡는다.
//     Android 쪽은 래퍼의 focusable(클릭 대상 여부)을 따로 단언한다.

/** 렌더 트리 노드에서 이 헬퍼가 읽는 최소 형태(react-test-renderer의 ReactTestInstance와 구조 호환). */
export type AccessibilityTreeNode = {
  type: unknown;
  props: Record<string, unknown>;
  parent: AccessibilityTreeNode | null;
};

/**
 * 요소의 조상 가운데 접근성 요소(accessible=true인 호스트 뷰)의 이름표를 가까운 순서로 모은다.
 *   빈 배열이어야 그 요소를 iOS 화면 읽기 기능에서 개별로 조작할 수 있다.
 *   노드가 아니라 이름표(문자열)를 돌려주는 이유: testID 없는 조상이 undefined가 되어 단언을 빠져나가지 않게 하고
 *   (toEqual은 배열 안의 undefined를 무시한다), 실패 메시지에 원인이 바로 보이게 하기 위해서다.
 * @param element 검사할 요소(getByTestId 등으로 얻은 호스트 요소)
 * @returns 조상 이름표 배열(가까운 조상부터). testID가 있으면 testID, 없으면 호스트 타입 이름(예: 'View')
 */
export const findAccessibleAncestors = ({
  element,
}: {
  element: AccessibilityTreeNode;
}): string[] => {
  const labels: string[] = [];
  let current = element.parent;
  while (current !== null) {
    // 네이티브 뷰가 되는 것은 호스트 요소(type이 문자열)뿐이다 — 합성 컴포넌트의 props는 판정에서 뺀다.
    if (typeof current.type === 'string' && current.props.accessible === true) {
      const { testID } = current.props;
      labels.push(typeof testID === 'string' && testID.length > 0 ? testID : current.type);
    }
    current = current.parent;
  }
  return labels;
};
