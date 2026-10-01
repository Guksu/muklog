// src/components/InviteCodeCard/InviteCodeCard.spec.tsx
// 초대코드 카드 — 표현 전용 계약(invite-share plan §4.4·R8, AC10).
//   "공유"(주)·"복사"(보조) 두 버튼은 콜백만 부른다. 클립보드·공유 시트·토스트·타이머는 부모 몫(useInviteShare).
//   킷 mk-home:290-303(복사 하나)에서의 이탈(U72, 사용자 승인 2026-09-30)과 배치 근거는 ui-spec §2.
//   터치 영역(QA QV-1): 두 sm 버튼의 실효 터치 높이 ≥ 44pt, 위아래로 붙은 두 버튼의 터치 영역이 겹치지 않음.
//     렌더 픽셀이 아니라 그 계산의 입력값(패딩·줄높이·hitSlop·버튼 열 간격)을 본다(선례 MapPermissionBanner.spec).
//     버튼 열이 네이티브 뷰가 아닌지는 공용 판정 src/test/listViewFormingProps(RN 0.76.9 규칙 전체 — 리더 지시 2회차, QA 2차 R1)로 본다.
import React from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
import { listViewFormingProps } from '@/test/listViewFormingProps';
import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
import * as Clipboard from 'expo-clipboard';

import { IconName } from '../Icon';
import { InviteCodeCard } from './InviteCodeCard';

// 접근성 이름은 테스트 seam으로 고정한다(plan §4.4). 보이는 글자는 ui-spec §2에서 확정.
const SHARE_LABEL = '초대 메시지 공유';
const COPY_LABEL = '초대코드 복사';

const setStringAsync = Clipboard.setStringAsync as jest.Mock;

// 최소 터치 타깃(iOS HIG 44pt) — 선례 MapPermissionBanner.spec.
const MIN_TOUCH_TARGET = 44;

/** hitSlop에서 읽는 네 방향(없으면 0으로 본다). */
type Insets = { top?: number; bottom?: number; left?: number; right?: number };

/** 판정에 쓰는 렌더 트리 노드의 최소 형태(react-test-renderer ReactTestInstance와 구조 호환 — JoinLogScreen.spec 관례). */
type TreeNode = {
  type: unknown;
  props: Record<string, unknown>;
  parent: TreeNode | null;
  findAll: (predicate: (node: TreeNode) => boolean) => TreeNode[];
};

const flatten = ({ style }: { style: unknown }) =>
  (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle & TextStyle;

/**
 * 버튼의 실효 터치 높이 — 세로 패딩 × 2 + 라벨 줄높이 + 세로 hitSlop(위·아래).
 * @param label 버튼 접근성 이름
 * @param title 버튼에 보이는 글자
 * @returns 실효 터치 높이(pt)
 */
const readEffectiveTouchHeight = ({ label, title }: { label: string; title: string }): number => {
  const button = screen.getByRole('button', { name: label });
  const box = flatten({ style: button.props.style });
  const text = flatten({ style: within(button).getByText(title).props.style });
  const hitSlop = button.props.hitSlop as Insets | undefined;
  return Number(box.paddingVertical) * 2 + Number(text.lineHeight) + (hitSlop?.top ?? 0) + (hitSlop?.bottom ?? 0);
};

/** 공유·복사를 함께 품는 가장 가까운 호스트 조상(버튼 열). */
const findButtonColumn = (): TreeNode => {
  let current = (screen.getByRole('button', { name: SHARE_LABEL }) as TreeNode).parent;
  while (current !== null) {
    const holdsCopy =
      current.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLabel === COPY_LABEL)
        .length > 0;
    if (typeof current.type === 'string' && holdsCopy) return current;
    current = current.parent;
  }
  throw new Error('공유·복사를 함께 품는 호스트 조상이 없다');
};

/**
 * 버튼 열의 세로 간격을 읽는다.
 * @returns 버튼 열 간격(pt)
 */
const readButtonColumnGap = (): number => {
  const column = flatten({ style: findButtonColumn().props.style });
  return Number(column.rowGap ?? column.gap);
};

const renderCard = (over?: { compact?: boolean }) => {
  const onShare = jest.fn();
  const onCopy = jest.fn();
  renderWithTheme(
    <InviteCodeCard code="ABCDEF" compact={over?.compact} onShare={onShare} onCopy={onCopy} />,
  );
  return { onShare, onCopy };
};

beforeEach(() => {
  setStringAsync.mockClear();
});

describe('InviteCodeCard — 표현 전용(공유 주 + 복사 보조)', () => {
  it('전달된 code를 표시한다 (AC10)', () => {
    renderCard();
    expect(screen.getByText('ABCDEF')).toBeTruthy();
  });

  it('"초대 메시지 공유" 탭 → onShare 1회, onCopy 0회 (AC10)', () => {
    const { onShare, onCopy } = renderCard();
    fireEvent.press(screen.getByLabelText(SHARE_LABEL));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('"초대코드 복사" 탭 → onCopy 1회, onShare 0회 (AC10)', () => {
    const { onShare, onCopy } = renderCard();
    fireEvent.press(screen.getByLabelText(COPY_LABEL));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('두 버튼은 보이는 글자 "공유"·"복사"를 가진 버튼이다 (ui-spec §2)', () => {
    renderCard();
    expect(within(screen.getByRole('button', { name: SHARE_LABEL })).getByText('공유')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: COPY_LABEL })).getByText('복사')).toBeTruthy();
  });

  // 버튼마다 따로 본다 — 한 케이스에 묶으면 앞 버튼이 없을 때 뒤 버튼의 클립보드 호출을 확인하지 못한다.
  it.each([SHARE_LABEL, COPY_LABEL])('"%s"를 눌러도 카드는 클립보드를 직접 부르지 않는다 (AC10 — 배선은 부모)', (label) => {
    renderCard();
    fireEvent.press(screen.getByLabelText(label));
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  // 비동기 후속 갱신까지 흘려보낸 뒤 본다 — 누른 직후 동기 검사만 하면 늦게 뜨는 "복사됨"을 놓친다.
  it('복사를 눌러도 "복사됨" 글자 토글이 없다 (AC10, U23 — 피드백은 전역 토스트 하나)', async () => {
    renderCard();
    await act(async () => {
      fireEvent.press(screen.getByLabelText(COPY_LABEL));
    });
    expect(screen.queryByText('복사됨')).toBeNull();
    expect(screen.getByText('복사')).toBeTruthy();
  });

  it('공유 버튼엔 share 아이콘, 복사 버튼엔 link 아이콘을 단다 (킷 share 글리프 · 킷 mk-home:300 link 승계)', () => {
    renderCard();
    expect(within(screen.getByLabelText(SHARE_LABEL)).getByTestId(`icon-${IconName.Share}`)).toBeTruthy();
    expect(within(screen.getByLabelText(COPY_LABEL)).getByTestId(`icon-${IconName.Link}`)).toBeTruthy();
  });

  it('compact(이름 변경 다이얼로그 안)에서도 코드와 두 버튼이 모두 있다 (AC10)', () => {
    const { onShare, onCopy } = renderCard({ compact: true });
    expect(screen.getByText('ABCDEF')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(SHARE_LABEL));
    fireEvent.press(screen.getByLabelText(COPY_LABEL));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  // iOS는 접근성 요소의 자식을 가려 하나로 합쳐 읽는다 — 카드가 버튼을 감싸면 공유·복사를 따로 누를 수 없다(docs/testing-strategy.md).
  it.each([false, true])('두 버튼은 각각 개별 접근성 요소다 — 감싸는 접근성 조상이 없다 (compact=%s, AC10)', (compact) => {
    renderCard({ compact });
    expect(findAccessibleAncestors({ element: screen.getByLabelText(SHARE_LABEL) })).toStrictEqual([]);
    expect(findAccessibleAncestors({ element: screen.getByLabelText(COPY_LABEL) })).toStrictEqual([]);
  });
});

// QA QV-1 — sm 버튼(높이 35pt)은 눈에 보이는 크기를 두고 눌리는 범위(hitSlop)만 넓혀 44pt를 맞춘다.
describe('InviteCodeCard — 최소 터치 타깃 44pt (QV-1)', () => {
  it.each([
    [SHARE_LABEL, '공유'],
    [COPY_LABEL, '복사'],
  ])('"%s" 실효 터치 높이(패딩×2 + 라벨 줄높이 + 세로 hitSlop) ≥ 44pt', (label, title) => {
    renderCard();
    expect(readEffectiveTouchHeight({ label, title })).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('공유 아래·복사 위로 넓힌 터치 영역의 합이 버튼 열 간격을 넘지 않는다 — 두 버튼의 터치 영역이 겹치지 않는다', () => {
    renderCard();
    const shareSlop = screen.getByRole('button', { name: SHARE_LABEL }).props.hitSlop as Insets | undefined;
    const copySlop = screen.getByRole('button', { name: COPY_LABEL }).props.hitSlop as Insets | undefined;
    expect((shareSlop?.bottom ?? 0) + (copySlop?.top ?? 0)).toBeLessThanOrEqual(readButtonColumnGap());
  });

  // 새 아키텍처(Fabric)는 넘치는 자식이 없는 네이티브 뷰의 경계 밖 터치를 버린다(RN 0.76 iOS RCTViewComponentView
  //   betterHitTest · Android TouchTargetHelper). 버튼 열(높이 = 두 버튼 76)이 네이티브 뷰가 되면 공유 위·복사 아래로 넓힌 6이
  //   잘린다 → 버튼 열은 레이아웃 전용이고, 네이티브 뷰인 카드(배경색)의 세로 여백이 바깥쪽 터치 영역을 품어야 한다.
  it.each([false, true])(
    '버튼 열은 네이티브 뷰를 만들지 않고, 카드 세로 여백이 바깥쪽으로 넓힌 터치 영역을 품는다 (compact=%s)',
    (compact) => {
      renderCard({ compact });
      const column = findButtonColumn();
      expect(listViewFormingProps({ node: column })).toStrictEqual([]);

      let card = column.parent;
      while (card !== null && typeof card.type !== 'string') card = card.parent;
      if (card === null) throw new Error('버튼 열을 품는 카드 호스트가 없다');
      const shareSlop = screen.getByRole('button', { name: SHARE_LABEL }).props.hitSlop as Insets | undefined;
      const copySlop = screen.getByRole('button', { name: COPY_LABEL }).props.hitSlop as Insets | undefined;
      const outward = Math.max(shareSlop?.top ?? 0, copySlop?.bottom ?? 0);
      expect(Number(flatten({ style: card.props.style }).paddingVertical)).toBeGreaterThanOrEqual(outward);
    },
  );
});
