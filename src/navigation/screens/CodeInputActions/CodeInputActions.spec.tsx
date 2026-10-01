// src/navigation/screens/CodeInputActions/CodeInputActions.spec.tsx
// 초대코드 입력 보조 버튼 줄 — 렌더 계약(invite-share U73·U24 ②, ui-spec §3).
//   "붙여넣기"는 항상, "지우기"는 코드가 있을 때만 보인다. 입장 중이면 둘 다 잠근다. 동작은 콜백으로만 올려 보낸다.
//   터치 영역(QA QV-1): 두 sm 버튼의 실효 터치 높이 ≥ 44pt — 렌더 픽셀이 아니라 계산의 입력값(패딩·줄높이·hitSlop)을 본다
//     (선례 MapPermissionBanner.spec).
import React from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
import { renderWithTheme } from '@/test/renderWithTheme';

import { CodeInputActions } from './CodeInputActions';

// 접근성 이름·힌트는 테스트 seam으로 고정한다(ui-spec §3-2).
const PASTE_LABEL = '초대코드 붙여넣기';
const CLEAR_LABEL = '초대코드 지우기';

// 최소 터치 타깃(iOS HIG 44pt) — 선례 MapPermissionBanner.spec.
const MIN_TOUCH_TARGET = 44;

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
  const hitSlop = button.props.hitSlop as { top?: number; bottom?: number } | undefined;
  return Number(box.paddingVertical) * 2 + Number(text.lineHeight) + (hitSlop?.top ?? 0) + (hitSlop?.bottom ?? 0);
};

const renderActions = (over?: { canClear?: boolean; disabled?: boolean }) => {
  const onPaste = jest.fn();
  const onClear = jest.fn();
  renderWithTheme(
    <CodeInputActions
      onPaste={onPaste}
      onClear={onClear}
      canClear={over?.canClear ?? false}
      disabled={over?.disabled ?? false}
    />,
  );
  return { onPaste, onClear };
};

describe('CodeInputActions', () => {
  it('"붙여넣기" 버튼(이름 "초대코드 붙여넣기")을 렌더한다', () => {
    renderActions();
    const paste = screen.getByRole('button', { name: PASTE_LABEL });
    expect(within(paste).getByText('붙여넣기')).toBeTruthy();
  });

  it('붙여넣기 탭 → onPaste 1회', () => {
    const { onPaste, onClear } = renderActions();
    fireEvent.press(screen.getByLabelText(PASTE_LABEL));
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('canClear=false(코드 0자)면 "지우기"를 렌더하지 않는다 — 킷 RenameDialog 지우기처럼 값이 있을 때만', () => {
    renderActions({ canClear: false });
    expect(screen.queryByLabelText(CLEAR_LABEL)).toBeNull();
    expect(screen.queryByText('지우기')).toBeNull();
  });

  it('canClear=true면 "지우기"(이름 "초대코드 지우기")를 렌더하고, 탭 → onClear 1회', () => {
    const { onPaste, onClear } = renderActions({ canClear: true });
    const clear = screen.getByRole('button', { name: CLEAR_LABEL });
    expect(within(clear).getByText('지우기')).toBeTruthy();
    fireEvent.press(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onPaste).not.toHaveBeenCalled();
  });

  it('힌트로 무슨 일이 일어나는지 알린다 — 붙여넣기는 클립보드를 읽는다는 사실을 미리 말한다', () => {
    renderActions({ canClear: true });
    expect(screen.getByLabelText(PASTE_LABEL).props.accessibilityHint).toBe('복사한 글에서 초대코드를 찾아 채워요');
    expect(screen.getByLabelText(CLEAR_LABEL).props.accessibilityHint).toBe('입력한 초대코드를 모두 지워요');
  });

  it('disabled(입장 중)면 두 버튼 모두 비활성이고, 눌러도 콜백이 불리지 않는다', () => {
    const { onPaste, onClear } = renderActions({ canClear: true, disabled: true });
    const paste = screen.getByLabelText(PASTE_LABEL);
    const clear = screen.getByLabelText(CLEAR_LABEL);
    expect(paste.props.accessibilityState?.disabled).toBe(true);
    expect(clear.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(paste);
    fireEvent.press(clear);
    expect(onPaste).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('disabled=false면 두 버튼 모두 활성이다', () => {
    renderActions({ canClear: true, disabled: false });
    expect(screen.getByLabelText(PASTE_LABEL).props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByLabelText(CLEAR_LABEL).props.accessibilityState?.disabled).toBe(false);
  });

  // 줄(행)이 접근성 요소면 iOS가 두 버튼을 하나로 합쳐 읽는다(docs/testing-strategy.md "접근성 단언").
  it('두 버튼은 각각 개별 접근성 요소다 — 감싸는 접근성 조상이 없다', () => {
    renderActions({ canClear: true });
    expect(findAccessibleAncestors({ element: screen.getByLabelText(PASTE_LABEL) })).toStrictEqual([]);
    expect(findAccessibleAncestors({ element: screen.getByLabelText(CLEAR_LABEL) })).toStrictEqual([]);
  });

  // QA QV-1 — sm 버튼(높이 35pt)은 눈에 보이는 크기를 두고 눌리는 범위(hitSlop)만 넓혀 44pt를 맞춘다.
  it.each([
    [PASTE_LABEL, '붙여넣기'],
    [CLEAR_LABEL, '지우기'],
  ])('"%s" 실효 터치 높이(패딩×2 + 라벨 줄높이 + 세로 hitSlop) ≥ 44pt (QV-1)', (label, title) => {
    renderActions({ canClear: true });
    expect(readEffectiveTouchHeight({ label, title })).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
