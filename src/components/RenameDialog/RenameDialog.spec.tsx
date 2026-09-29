// src/components/RenameDialog.spec.tsx
// 공용 이름변경 다이얼로그(중앙 알림형) — 킷 mk-extra:24-64 RenameDialog RN 번역.
//   프리젠테이션 단위 검증: open 토글·controlled value·취소/저장 콜백·X클리어·maxLength·error/extra 슬롯.
//   배선(정규화·RPC·검증)은 developer 몫 — 여기선 콜백 호출과 슬롯 렌더만 본다(plan §4.2 동작 계약 / T1 AC1.1~1.8).
import React from 'react';
import { AccessibilityInfo, Modal, StatusBar, StyleSheet, Text } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
import { renderWithTheme } from '@/test/renderWithTheme';

import { resolveModalTopInset } from '../modalInsets';

import { RENAME_DIALOG_TOP_OFFSET, RenameDialog } from './RenameDialog';

const noop = () => {};

describe('RenameDialog', () => {
  // AC1.1
  it('open=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(
      <RenameDialog open={false} title="로그 이름" value="" onChange={noop} onCancel={noop} onSave={noop} />,
    );
    expect(screen.queryByText('로그 이름')).toBeNull();
    expect(screen.queryByTestId('rename-dialog-card')).toBeNull();
  });

  // AC1.2
  it('open=true면 title·입력값·취소·저장을 렌더한다', () => {
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="우리 맛집" onChange={noop} onCancel={noop} onSave={noop} />,
    );
    expect(screen.getByText('로그 이름')).toBeTruthy();
    expect(screen.getByText('취소')).toBeTruthy();
    expect(screen.getByText('저장')).toBeTruthy();
    expect(screen.getByTestId('rename-dialog-input').props.value).toBe('우리 맛집');
  });

  it('subtitle을 전달하면 보조문을 렌더한다', () => {
    renderWithTheme(
      <RenameDialog
        open
        title="로그 이름"
        subtitle="비워두면 기본 이름으로 돌아가요"
        value=""
        onChange={noop}
        onCancel={noop}
        onSave={noop}
      />,
    );
    expect(screen.getByText('비워두면 기본 이름으로 돌아가요')).toBeTruthy();
  });

  // AC1.3
  it('딤 배경 탭 시 onCancel을 1회 호출한다', () => {
    const onCancel = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={onCancel} onSave={noop} />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // AC1.3
  it('카드 본문 탭은 onCancel을 호출하지 않는다', () => {
    const onCancel = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={onCancel} onSave={noop} />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-card'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('취소 버튼 탭 시 onCancel을 호출한다', () => {
    const onCancel = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={onCancel} onSave={noop} />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // AC1.4
  it('저장 버튼 탭 시 onSave를 1회 호출한다', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="새 이름" onChange={noop} onCancel={noop} onSave={onSave} />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // AC1.4
  it('입력 Enter(submitEditing) 시 onSave를 1회 호출한다', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="새 이름" onChange={noop} onCancel={noop} onSave={onSave} />,
    );
    fireEvent(screen.getByTestId('rename-dialog-input'), 'submitEditing');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // AC1.5
  it('saving=true면 저장 버튼이 비활성이고 로딩을 표시한다', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="새 이름" onChange={noop} onCancel={noop} onSave={onSave} saving />,
    );
    expect(screen.getByTestId('rename-dialog-saving')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rename-dialog-save'));
    fireEvent(screen.getByTestId('rename-dialog-input'), 'submitEditing');
    expect(onSave).not.toHaveBeenCalled();
  });

  // AC1.5
  it('saveDisabled=true면 저장 버튼 탭이 onSave를 호출하지 않는다', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <RenameDialog
        open
        title="닉네임"
        value=""
        onChange={noop}
        onCancel={noop}
        onSave={onSave}
        saveDisabled
      />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  // AC1.6
  it('입력 변경 시 onChange(next)를 호출한다', () => {
    const onChange = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={onChange} onCancel={noop} onSave={noop} />,
    );
    fireEvent.changeText(screen.getByTestId('rename-dialog-input'), '새 이름');
    expect(onChange).toHaveBeenCalledWith('새 이름');
  });

  // AC1.6
  it('값이 있으면 X(클리어) 버튼을 노출하고 탭 시 onChange("")를 호출한다', () => {
    const onChange = jest.fn();
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="지울 값" onChange={onChange} onCancel={noop} onSave={noop} />,
    );
    fireEvent.press(screen.getByTestId('rename-dialog-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  // AC1.6
  it('값이 비어 있으면 X(클리어) 버튼을 노출하지 않는다', () => {
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={noop} onSave={noop} />,
    );
    expect(screen.queryByTestId('rename-dialog-clear')).toBeNull();
  });

  // AC1.7
  it('maxLength를 TextInput에 전달한다(기본 20)', () => {
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={noop} onSave={noop} />,
    );
    expect(screen.getByTestId('rename-dialog-input').props.maxLength).toBe(20);
  });

  it('maxLength를 명시하면 그 값을 전달한다', () => {
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={noop} onSave={noop} maxLength={10} />,
    );
    expect(screen.getByTestId('rename-dialog-input').props.maxLength).toBe(10);
  });

  // AC1.8
  it('error를 전달하면 인라인 에러를 노출하고, 미전달이면 노출하지 않는다', () => {
    const { rerender } = renderWithTheme(
      <RenameDialog open title="닉네임" value="" onChange={noop} onCancel={noop} onSave={noop} />,
    );
    expect(screen.queryByText('닉네임을 입력해 주세요.')).toBeNull();
    rerender(
      <RenameDialog
        open
        title="닉네임"
        value=""
        onChange={noop}
        onCancel={noop}
        onSave={noop}
        error="닉네임을 입력해 주세요."
      />,
    );
    expect(screen.getByText('닉네임을 입력해 주세요.')).toBeTruthy();
  });

  // AC1.8
  it('extra 노드를 전달하면 입력 하단에 렌더한다', () => {
    renderWithTheme(
      <RenameDialog
        open
        title="로그 이름"
        value=""
        onChange={noop}
        onCancel={noop}
        onSave={noop}
        extra={<Text>INVITE_SLOT</Text>}
      />,
    );
    expect(screen.getByText('INVITE_SLOT')).toBeTruthy();
  });
});

// ── 프레스 치환 A1·A2(motion-press-sweep T3 / ui-spec §2-2·§3-1) ────────────────────────
//   seam = testID로 조회한 노드의 (a) flatten style의 transform/opacity 키 유무 (b) onPress 횟수.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §9-2 — 실값은 motion.spec가 잠갔다).
describe('RenameDialog — 취소/저장 액션 눌림 피드백(motion-press-sweep A1·A2)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ testId }: { testId: string }) =>
    StyleSheet.flatten(screen.getByTestId(testId).props.style) as Record<string, unknown>;

  const renderDialog = (props: Partial<React.ComponentProps<typeof RenameDialog>> = {}) => {
    renderWithTheme(
      <RenameDialog
        open
        title="로그 이름"
        value="새 이름"
        onChange={noop}
        onCancel={noop}
        onSave={noop}
        {...props}
      />,
    );
  };

  it('A1 취소 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderDialog();
    await waitFor(() => expect(flatten({ testId: 'rename-dialog-cancel' }).transform).toBeDefined());
  });

  it('A1 취소 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderDialog();
    await waitFor(() => expect(flatten({ testId: 'rename-dialog-cancel' }).opacity).toBeDefined());
    expect(flatten({ testId: 'rename-dialog-cancel' }).transform).toBeUndefined();
  });

  it('A2 저장 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderDialog();
    await waitFor(() => expect(flatten({ testId: 'rename-dialog-save' }).transform).toBeDefined());
  });

  it('A2 저장 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderDialog();
    await waitFor(() => expect(flatten({ testId: 'rename-dialog-save' }).opacity).toBeDefined());
    expect(flatten({ testId: 'rename-dialog-save' }).transform).toBeUndefined();
  });

  it('A2 저장 — saveDisabled=true면 transform이 부착되지 않고 flatten opacity가 0.45다', () => {
    mockReduceMotion({ enabled: false });
    renderDialog({ saveDisabled: true });
    expect(flatten({ testId: 'rename-dialog-save' }).transform).toBeUndefined();
    expect(flatten({ testId: 'rename-dialog-save' }).opacity).toBe(0.45);
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog();
    expect(warn).not.toHaveBeenCalled();
  });
});

// ── 프레스 부여 C9(motion-press-c T4 / ui-spec §2) ────────────────────────
//   seam = testID `rename-dialog-clear` 노드의 flatten style transform/opacity 키 유무.
//   P4(console.warn 0건)는 위 A1·A2 블록이 같은 렌더 트리(value 있음 → ✕ 렌더)로 이미 커버한다.
//   Category B(딤 오버레이)는 이 스프린트에서 건드리지 않는다.
//   (당시 함께 Category B였던 전파차단 카드는 dialog-card-a11y에서 누름 요소가 아닌 View로 바뀌었다.)
describe('RenameDialog — 입력 지우기 ✕ 눌림 피드백(motion-press-c C9)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flattenClear = () =>
    StyleSheet.flatten(screen.getByTestId('rename-dialog-clear').props.style) as Record<
      string,
      unknown
    >;

  // ✕는 value가 빈 문자열이면 렌더되지 않는다 — 값이 있는 상태에서만 검증한다(plan E9).
  const renderWithValue = () => {
    renderWithTheme(
      <RenameDialog
        open
        title="로그 이름"
        value="새 이름"
        onChange={noop}
        onCancel={noop}
        onSave={noop}
      />,
    );
  };

  it('C9 지우기 ✕ — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithValue();
    await waitFor(() => expect(flattenClear().transform).toBeDefined());
  });

  it('C9 지우기 ✕ — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithValue();
    await waitFor(() => expect(flattenClear().opacity).toBeDefined());
    expect(flattenClear().transform).toBeUndefined();
  });
});

// 딤이 상태바까지 덮으면 Modal 컨테이너의 위쪽 inset이 0이 된다 — 그러면 카드가 상태바 높이만큼 위로 밀린다.
//   "카드는 상태바 아래 70px에서 시작한다"는 킷 계약(ESP+70)을 합성값으로 고정한다(dim-full-cover plan §6 S1·S2).
describe('RenameDialog — 딤 전체 화면 커버 + 상단 위치 보정 (dim-full-cover)', () => {
  const renderOpen = () =>
    renderWithTheme(
      <RenameDialog open title="로그 이름" value="" onChange={noop} onCancel={noop} onSave={noop} />,
    );
  const wrapPaddingTop = () =>
    StyleSheet.flatten(screen.getByTestId('rename-dialog-wrap').props.style).paddingTop;

  // TC-A2
  it('A2 — Modal이 statusBarTranslucent를 켠다', () => {
    renderOpen();
    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
  });

  // TC-C1 — renderWithTheme의 insets.top은 0, 테스트 환경의 currentHeight는 undefined.
  it('C1 — 상단 여백이 resolveModalTopInset + RENAME_DIALOG_TOP_OFFSET과 같다', () => {
    renderOpen();
    expect(wrapPaddingTop()).toBe(
      resolveModalTopInset({ insetTop: 0, statusBarHeight: StatusBar.currentHeight }) +
        RENAME_DIALOG_TOP_OFFSET,
    );
  });

  // TC-C2
  it('C2 — 상태바 높이가 24여도 카드는 상태바 아래 70에서 시작한다', () => {
    const original = StatusBar.currentHeight;
    StatusBar.currentHeight = 24;
    try {
      renderOpen();
      expect(wrapPaddingTop()).toBe(24 + RENAME_DIALOG_TOP_OFFSET);
    } finally {
      StatusBar.currentHeight = original;
    }
  });
});

// ── 접근성: 컨트롤이 개별 요소로 노출된다(dialog-card-a11y) ─────────────────────────────
//   증상: iOS 접근성 트리에서 입력란·지우기·취소·저장이 "닉네임 닉네임 지우기 취소 저장" 요소 하나로 노출됐다.
//   원인: 카드가 Pressable(accessible 기본 true)이었다 — iOS는 접근성 요소의 자식을 화면 읽기 기능에 노출하지 않는다.
//   seam: 호스트 요소의 접근성·터치 props(accessible·focusable·pointerEvents·라벨·역할)와 조상 사슬,
//         탭의 핸들러 효과(onCancel).
//   딤 탭 → onCancel / 카드 탭 → 미호출은 위 AC1.3 두 케이스가 이미 잠갔다(이 블록은 카드 안 자식 탭을 더한다).
describe('RenameDialog — 접근성: 컨트롤이 개별 요소로 노출된다 (dialog-card-a11y)', () => {
  // 지우기 ✕는 value가 있어야 렌더된다 → 값이 있는 상태로 네 컨트롤을 모두 띄운다.
  const renderDialog = ({ onCancel = noop }: { onCancel?: () => void } = {}) =>
    renderWithTheme(
      <RenameDialog
        open
        title="닉네임"
        value="국수"
        onChange={noop}
        onCancel={onCancel}
        onSave={noop}
      />,
    );

  const CONTROLS = [
    { label: '입력란', testId: 'rename-dialog-input' },
    { label: '지우기', testId: 'rename-dialog-clear' },
    { label: '취소', testId: 'rename-dialog-cancel' },
    { label: '저장', testId: 'rename-dialog-save' },
  ];

  it('카드 래퍼는 접근성 요소가 아니다', () => {
    renderDialog();
    expect(screen.getByTestId('rename-dialog-card').props.accessible).not.toBe(true);
  });

  // Android는 focusable 뷰에 클릭 리스너를 달아 TalkBack이 "활성화할 수 있는 요소"로 멈춘다
  //   (ReactViewManager.setFocusable). Pressable을 남기고 accessible만 끄면 focusable 기본값(true)이 남는다.
  it('카드 래퍼는 포커스·클릭 대상도 아니다', () => {
    renderDialog();
    expect(screen.getByTestId('rename-dialog-card').props.focusable).not.toBe(true);
  });

  // 딤과 카드는 형제 레이어라 카드가 터치를 받아야 카드 위 탭이 딤으로 빠지지 않는다.
  //   카드가 터치를 흘려보내면(box-none·none) 실기기에서는 카드 여백 탭이 딤에 닿아 대화상자가 닫힌다
  //   — fireEvent는 형제로 빠지는 경로를 흉내 내지 않으므로 props로 잠근다.
  it('카드는 터치를 받는 뷰다(pointerEvents로 터치를 흘려보내지 않는다)', () => {
    renderDialog();
    const card = screen.getByTestId('rename-dialog-card');
    expect(card.props.pointerEvents ?? 'auto').toBe('auto');
    expect(StyleSheet.flatten(card.props.style).pointerEvents ?? 'auto').toBe('auto');
  });

  // toStrictEqual — toEqual은 배열 안의 undefined를 무시한다. 헬퍼는 testID 없는 조상도 타입 이름으로 돌려준다.
  it.each(CONTROLS)('$label의 조상에는 접근성 요소가 없다', ({ testId }) => {
    renderDialog();
    expect(findAccessibleAncestors({ element: screen.getByTestId(testId) })).toStrictEqual([]);
  });

  it('입력란·지우기·취소·저장이 각자의 접근성 라벨로 조회된다', () => {
    renderDialog();
    expect(screen.getByLabelText('닉네임').props.testID).toBe('rename-dialog-input');
    expect(screen.getByRole('button', { name: '지우기' }).props.testID).toBe('rename-dialog-clear');
    expect(screen.getByRole('button', { name: '취소' }).props.testID).toBe('rename-dialog-cancel');
    expect(screen.getByRole('button', { name: '저장' }).props.testID).toBe('rename-dialog-save');
  });

  it('딤 배경은 "닫기" 버튼으로 노출된다(화면 읽기 기능의 닫기 경로)', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: '닫기' }).props.testID).toBe(
      'rename-dialog-backdrop',
    );
  });

  it('카드 안 제목을 탭해도 onCancel을 호출하지 않는다', () => {
    const onCancel = jest.fn();
    renderDialog({ onCancel });
    fireEvent.press(screen.getByText('닉네임'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
