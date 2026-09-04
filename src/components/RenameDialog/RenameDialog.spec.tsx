// src/components/RenameDialog.spec.tsx
// 공용 이름변경 다이얼로그(중앙 알림형) — 킷 mk-extra:24-64 RenameDialog RN 번역.
//   프리젠테이션 단위 검증: open 토글·controlled value·취소/저장 콜백·X클리어·maxLength·error/extra 슬롯.
//   배선(정규화·RPC·검증)은 developer 몫 — 여기선 콜백 호출과 슬롯 렌더만 본다(plan §4.2 동작 계약 / T1 AC1.1~1.8).
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { RenameDialog } from './RenameDialog';

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
