// src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.spec.tsx
// 업데이트 권유 모달(app-version-gate T9) — 프리젠테이션 단위 검증.
//   RenameDialog 셸 패턴(딤·중앙카드·상단 hairline 2버튼 행) 재사용의 "입력 없는 확인형" 변형.
//   배선(Linking·dismissal 저장)은 developer — 여기선 표시·콜백(나중에/업데이트·딤 탭·null=1버튼)만 본다.
import React from 'react';
import { AccessibilityInfo, Modal, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
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

// 딤이 상태바까지 덮는지는 렌더 결과로 관측되지 않는다 → Modal props로 고정(dim-full-cover plan §6 S1).
describe('UpdateSuggestModal — 딤 전체 화면 커버 (dim-full-cover)', () => {
  // TC-A4
  it('A4 — Modal이 statusBarTranslucent를 켠다', () => {
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
  });
});

// ── 접근성: 버튼이 개별 요소로 노출된다(dialog-card-a11y) ───────────────────────────────
//   RenameDialog와 같은 셸이라 같은 결함을 가졌다 — 카드가 Pressable(accessible 기본 true)이면
//   iOS는 제목·본문·버튼을 하나의 요소로 합쳐 버튼을 개별로 조작할 수 없게 한다.
//   seam: 호스트 요소의 접근성·터치 props(accessible·focusable·pointerEvents·라벨·역할)와 조상 사슬,
//         탭의 핸들러 효과.
describe('UpdateSuggestModal — 접근성: 버튼이 개별 요소로 노출된다 (dialog-card-a11y)', () => {
  const renderModal = ({
    storeUrl = 'https://store',
    onUpdatePress = noop,
    onDismiss = noop,
  }: {
    storeUrl?: string | null;
    onUpdatePress?: () => void;
    onDismiss?: () => void;
  } = {}) =>
    renderWithTheme(
      <UpdateSuggestModal
        visible
        storeUrl={storeUrl}
        onUpdatePress={onUpdatePress}
        onDismiss={onDismiss}
      />,
    );

  const ancestorsOf = ({ testId }: { testId: string }) =>
    findAccessibleAncestors({ element: screen.getByTestId(testId) });

  it('카드 래퍼는 접근성 요소가 아니다', () => {
    renderModal();
    expect(screen.getByTestId('update-suggest-card').props.accessible).not.toBe(true);
  });

  // Android는 focusable 뷰에 클릭 리스너를 달아 TalkBack이 "활성화할 수 있는 요소"로 멈춘다.
  it('카드 래퍼는 포커스·클릭 대상도 아니다', () => {
    renderModal();
    expect(screen.getByTestId('update-suggest-card').props.focusable).not.toBe(true);
  });

  // 딤과 카드는 형제 레이어라 카드가 터치를 받아야 카드 위 탭이 딤으로 빠지지 않는다.
  //   fireEvent는 형제로 빠지는 경로를 흉내 내지 않으므로 props로 잠근다.
  it('카드는 터치를 받는 뷰다(pointerEvents로 터치를 흘려보내지 않는다)', () => {
    renderModal();
    const card = screen.getByTestId('update-suggest-card');
    expect(card.props.pointerEvents ?? 'auto').toBe('auto');
    expect(StyleSheet.flatten(card.props.style).pointerEvents ?? 'auto').toBe('auto');
  });

  // toStrictEqual — toEqual은 배열 안의 undefined를 무시한다. 헬퍼는 testID 없는 조상도 타입 이름으로 돌려준다.
  it.each([
    { label: '나중에', testId: 'update-suggest-dismiss' },
    { label: '업데이트', testId: 'update-suggest-update' },
  ])('$label의 조상에는 접근성 요소가 없다', ({ testId }) => {
    renderModal();
    expect(ancestorsOf({ testId })).toStrictEqual([]);
  });

  it('storeUrl이 null인 단일 확인 버튼의 조상에도 접근성 요소가 없다', () => {
    renderModal({ storeUrl: null });
    expect(ancestorsOf({ testId: 'update-suggest-dismiss' })).toStrictEqual([]);
  });

  it('나중에·업데이트가 각자의 접근성 라벨로 조회된다', () => {
    renderModal();
    expect(screen.getByRole('button', { name: '나중에' }).props.testID).toBe(
      'update-suggest-dismiss',
    );
    expect(screen.getByRole('button', { name: '업데이트' }).props.testID).toBe(
      'update-suggest-update',
    );
  });

  it('storeUrl이 null이면 "확인"이 접근성 라벨로 조회된다', () => {
    renderModal({ storeUrl: null });
    expect(screen.getByRole('button', { name: '확인' }).props.testID).toBe(
      'update-suggest-dismiss',
    );
  });

  it('딤 배경은 "닫기" 버튼으로 노출된다(화면 읽기 기능의 닫기 경로)', () => {
    renderModal();
    expect(screen.getByRole('button', { name: '닫기' }).props.testID).toBe(
      'update-suggest-backdrop',
    );
  });

  it('카드나 카드 안 제목을 탭해도 닫히지 않는다(딤과 형제 레이어)', () => {
    const onDismiss = jest.fn();
    const onUpdatePress = jest.fn();
    renderModal({ onDismiss, onUpdatePress });
    fireEvent.press(screen.getByTestId('update-suggest-card'));
    fireEvent.press(screen.getByText('새 버전이 나왔어요'));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onUpdatePress).not.toHaveBeenCalled();
  });
});
