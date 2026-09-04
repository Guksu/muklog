// src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.spec.tsx
// 업데이트 권유 모달(app-version-gate T9) — 프리젠테이션 단위 검증.
//   RenameDialog 셸 패턴(딤·중앙카드·상단 hairline 2버튼 행) 재사용의 "입력 없는 확인형" 변형.
//   배선(Linking·dismissal 저장)은 developer — 여기선 표시·콜백(나중에/업데이트·딤 탭·null=1버튼)만 본다.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { UpdateSuggestModal } from './UpdateSuggestModal';

const noop = () => {};

describe('UpdateSuggestModal', () => {
  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(
      <UpdateSuggestModal visible={false} storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(screen.queryByTestId('update-suggest-card')).toBeNull();
    expect(screen.queryByText('새 버전이 나왔어요')).toBeNull();
  });

  it('visible=true면 제목·본문과 나중에/업데이트 버튼을 렌더한다', () => {
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(screen.getByText('새 버전이 나왔어요')).toBeTruthy();
    expect(screen.getByTestId('update-suggest-dismiss')).toBeTruthy();
    expect(screen.getByTestId('update-suggest-update')).toBeTruthy();
  });

  it('업데이트 탭 시 onUpdatePress를 호출한다', () => {
    const onUpdatePress = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={onUpdatePress} onDismiss={noop} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-update'));
    expect(onUpdatePress).toHaveBeenCalledTimes(1);
  });

  it('나중에 탭 시 onDismiss를 호출한다', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('딤 배경 탭 시 onDismiss를 호출한다(닫기 가능)', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('storeUrl이 null이면 업데이트 버튼을 숨기고 단일 확인 버튼만 렌더한다', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl={null} onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    expect(screen.queryByTestId('update-suggest-update')).toBeNull();
    const only = screen.getByTestId('update-suggest-dismiss');
    fireEvent.press(only);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ── 프레스 치환 A3·A4·A5(motion-press-sweep T3 / ui-spec §2-2·§3-1) ──────────────────────
//   seam = testID로 조회한 노드의 (a) flatten style의 transform/opacity 키 유무.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §9-2).
describe('UpdateSuggestModal — 액션 눌림 피드백(motion-press-sweep A3·A4·A5)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ testId }: { testId: string }) =>
    StyleSheet.flatten(screen.getByTestId(testId).props.style) as Record<string, unknown>;

  it('A3 나중에 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-dismiss' }).transform).toBeDefined());
  });

  it('A3 나중에 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-dismiss' }).opacity).toBeDefined());
    expect(flatten({ testId: 'update-suggest-dismiss' }).transform).toBeUndefined();
  });

  it('A4 업데이트 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-update' }).transform).toBeDefined());
  });

  it('A4 업데이트 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-update' }).opacity).toBeDefined());
    expect(flatten({ testId: 'update-suggest-update' }).transform).toBeUndefined();
  });

  it('A5 확인(storeUrl=null 분기) — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl={null} onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-dismiss' }).transform).toBeDefined());
  });

  it('A5 확인(storeUrl=null 분기) — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl={null} onUpdatePress={noop} onDismiss={noop} />,
    );
    await waitFor(() => expect(flatten({ testId: 'update-suggest-dismiss' }).opacity).toBeDefined());
    expect(flatten({ testId: 'update-suggest-dismiss' }).transform).toBeUndefined();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
