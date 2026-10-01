// src/navigation/screens/JoinLogScreen.spec.tsx
// 초대코드 입력 화면 — 버튼 활성 조건·성공 시 refresh+replace·실패 시 인라인 에러 (plan §6.5 / §5 T8, AC11–AC15).
//   ux-entry-trust(U2) 추가: 키보드 마찰 3종 — tap 관통(keyboardShouldPersistTaps)·KAV 래핑·6자 완성 시 자동 내림.
//   invite-share(U73·U24, plan R16 — AC17~AC22): 붙여넣기(누를 때만 클립보드 1회 읽기)·실패 안내·실패 문구 초기화·지우기.
//     readInviteCodeFromClipboard는 실 구현 + expo-clipboard 대역(읽기 횟수를 본다). useJoinRoom 대역에 clearError를 둔다.
//   QA 1회차: E25(붙여넣기 자동 입장 0)·E22(같은 코드 재붙여넣기 문구 유지) 잠금, 실패 때 키보드 내림(QV-2), 버튼 줄 폭 = 셀 줄 폭(QV-3).
//   리더 지시 2회차: 붙여넣기 연타 가드(QA S6 — 읽는 동안 다시 눌러도 클립보드 1회), 새 아키텍처 가드는 공용 판정(src/test/listViewFormingProps).
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { findAccessibleAncestors } from '@/test/findAccessibleAncestors';
import { listViewFormingProps } from '@/test/listViewFormingProps';
import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 code/errors는 실 구현 사용, 훅/컨텍스트만 모킹(supabase 비유입).
//   readInviteCodeFromClipboard는 실 구현 — 아래 expo-clipboard 대역으로 클립보드 읽기 횟수·결과를 제어한다.
jest.mock('@/features/room', () => {
  const code = jest.requireActual('@/features/room/code');
  const clipboardReader = jest.requireActual('@/features/room/readInviteCodeFromClipboard');
  return { ...code, ...clipboardReader, useJoinRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
  hasStringAsync: jest.fn(),
  setStringAsync: jest.fn(),
}));

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
}));

import * as Clipboard from 'expo-clipboard';
import { useJoinRoom, useMyLogsContext } from '@/features/room';
import { JoinLogScreen } from './JoinLogScreen';

const useJoinRoomMock = useJoinRoom as jest.Mock;
const useMyLogsContextMock = useMyLogsContext as jest.Mock;
const getStringAsync = Clipboard.getStringAsync as jest.Mock;
const hasStringAsync = Clipboard.hasStringAsync as jest.Mock;

const joinRoom = jest.fn();
const refresh = jest.fn();
// useJoinRoom.clearError 대역(invite-share U24 ①). 기본은 아무 일도 하지 않는다 — 문구가 사라지는지 보는 케이스는
//   clearErrorResetsHook()로 실물처럼 훅 반환의 error를 null로 바꾼다.
const clearError = jest.fn();

const setupHooks = (overrides?: { loading?: boolean; error?: string | null }) => {
  useJoinRoomMock.mockReturnValue({
    joinRoom,
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
    clearError,
  });
  useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
};

/**
 * clearError 대역을 실물(setError(null))처럼 만든다 — 다음 렌더부터 훅 반환의 error가 null이다.
 *   화면은 같은 핸들러에서 코드 상태를 바꿔 다시 그리므로 그 렌더에서 문구가 사라진다.
 */
const clearErrorResetsHook = ({ loading }: { loading: boolean }) => {
  clearError.mockImplementation(() => setupHooks({ loading, error: null }));
};

const typeCode = (value: string) => {
  fireEvent.changeText(screen.getByTestId('code-hidden-input'), value);
};

// Platform.OS 조작(useAppVersionGate.spec 패턴) — KAV behavior 분기 검증용.
const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  joinRoom.mockReset();
  refresh.mockReset();
  mockReplace.mockReset();
  clearError.mockReset();
  getStringAsync.mockReset();
  hasStringAsync.mockReset();
  setupHooks();
  setPlatform('ios');
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});

describe('JoinLogScreen', () => {
  it('6자 미만이면 입장 버튼이 비활성이라 joinRoom을 호출하지 않는다 (AC11)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDE'); // 5자
    fireEvent.press(screen.getByLabelText('들어가기'));
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it('6자 완성 시 입장 → joinRoom({code}) → refresh() → navigation.replace(LogScreen) (AC12)', async () => {
    joinRoom.mockResolvedValueOnce({ roomId: 'r1' });
    renderWithTheme(<JoinLogScreen />);

    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('들어가기'));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith({ code: 'ABCDEF' });
    });
    expect(refresh).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('LogScreen', { roomId: 'r1' });
  });

  it('입장 성공 시 전역 토스트 "로그에 들어왔어요"를 표시한다 (킷 mk-home:232)', async () => {
    joinRoom.mockResolvedValueOnce({ roomId: 'r1' });
    renderWithTheme(<JoinLogScreen />);

    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('들어가기'));

    await waitFor(() => {
      expect(screen.getByText('로그에 들어왔어요')).toBeTruthy();
    });
  });

  it('실패 시(INVALID_CODE) 인라인 에러 메시지를 표시하고 네비게이션하지 않는다 (AC13)', async () => {
    joinRoom.mockImplementationOnce(async () => {
      // useJoinRoom이 error를 세팅하고 throw 하는 실제 동작 모사
      setupHooks({ error: '초대코드를 다시 확인해 주세요.' });
      throw new Error('INVALID_CODE');
    });
    const { rerender } = renderWithTheme(<JoinLogScreen />);

    typeCode('ZZZZZZ');
    fireEvent.press(screen.getByLabelText('들어가기'));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalled();
    });
    rerender(<JoinLogScreen />);
    expect(screen.getByText('초대코드를 다시 확인해 주세요.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('useJoinRoom.error(ROOM_FULL 매핑)를 인라인 에러로 표시한다 (AC14)', () => {
    setupHooks({ error: '로그 정원(5명)이 가득 찼어요.' });
    renderWithTheme(<JoinLogScreen />);
    expect(screen.getByText('로그 정원(5명)이 가득 찼어요.')).toBeTruthy();
  });

  it('loading 중에는 입장 버튼이 busy라 joinRoom을 호출하지 않는다', () => {
    setupHooks({ loading: true });
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('들어가기'));
    expect(joinRoom).not.toHaveBeenCalled();
  });
});

// U2 — 키보드가 다음 행동을 막지 않게 한다(원칙 2 진입 마찰 제거 / 3 탭 즉시 반응).
describe('JoinLogScreen — 키보드 마찰 제거(U2)', () => {
  it('스크롤뷰가 키보드 위 탭을 관통시킨다(keyboardShouldPersistTaps="handled")', () => {
    renderWithTheme(<JoinLogScreen />);
    // 기본값 'never'면 키보드가 떠 있을 때 첫 탭이 키보드 닫기에 소비된다.
    expect(screen.getByTestId('join-scroll').props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('키보드가 떠 있어도 "들어가기" 첫 탭이 곧바로 joinRoom을 호출한다', async () => {
    joinRoom.mockResolvedValueOnce({ roomId: 'r1' });
    renderWithTheme(<JoinLogScreen />);

    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('들어가기'));

    await waitFor(() => expect(joinRoom).toHaveBeenCalledTimes(1));
    expect(joinRoom).toHaveBeenCalledWith({ code: 'ABCDEF' });
  });

  it('콘텐츠가 KeyboardAvoidingView(testID join-kav)로 감싸져 있다', () => {
    renderWithTheme(<JoinLogScreen />);
    // 호스트 View로 내려오는 testID — KAV가 실제로 트리에 있다는 증거.
    expect(screen.getByTestId('join-kav')).toBeTruthy();
  });

  it('iOS에서는 KAV behavior가 padding이다(버튼을 밀어 올림)', () => {
    setPlatform('ios');
    renderWithTheme(<JoinLogScreen />);
    // behavior는 KAV가 내부에서 소비해 호스트 View로 내려오지 않는다 → 합성 엘리먼트에서 읽는다.
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('Android에서는 KAV behavior 미지정(네이티브 adjustResize에 맡김)', () => {
    setPlatform('android');
    renderWithTheme(<JoinLogScreen />);
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
  });

  it('6자가 채워지는 순간 키보드를 내린다(버튼이 가려지지 않게)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it('5자까지는 키보드를 내리지 않는다(입력이 끊기지 않게)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDE');
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('지웠다 다시 채우면 재완성마다 키보드를 내린다', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    typeCode('ABCDE');
    typeCode('ABCDEZ');
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(2);
  });

  it('혼동문자 붙여넣기로 정규화 후 6자 미만이면 키보드를 내리지 않고 버튼도 비활성이다', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB0O1I'); // 0/O/1/I 제거 → 'AB'
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('들어가기'));
    expect(joinRoom).not.toHaveBeenCalled();
  });
});

// invite-share(U73·U24 ②) — 붙여넣기·지우기 버튼 골격의 렌더 계약(ui-spec §3).
//   동작(클립보드 1회 읽기·코드 비우기·포커스·안내 문구)은 developer 배선이라 여기서는 보지 않는다(plan R16).
describe('JoinLogScreen — 붙여넣기·지우기 버튼 골격(U73)', () => {
  const PASTE_LABEL = '초대코드 붙여넣기';
  const CLEAR_LABEL = '초대코드 지우기';

  /** 판정에 쓰는 렌더 트리 노드의 최소 형태(react-test-renderer ReactTestInstance와 구조 호환 — CodeInput.spec 관례). */
  type TreeNode = {
    type: unknown;
    props: Record<string, unknown>;
    parent: TreeNode | null;
    findAll: (predicate: (node: TreeNode) => boolean) => TreeNode[];
  };

  const flatten = ({ style }: { style: unknown }) =>
    (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle & TextStyle;

  /**
   * 렌더된 6셀 줄의 폭 — 셀 폭의 합 + 셀 줄 간격 × (셀 수 − 1). 셀과 그 부모 줄(호스트)의 스타일 값에서 읽는다.
   * @returns 셀 줄 폭(pt)
   */
  const readRenderedCellRowWidth = (): number => {
    const cells = Array.from(
      { length: 6 },
      (_, index) => screen.getByTestId(`code-cell-${index}`, { includeHiddenElements: true }) as TreeNode,
    );
    let row = cells[0].parent;
    while (row !== null && typeof row.type !== 'string') row = row.parent;
    if (row === null) throw new Error('셀을 품는 호스트 줄이 없다');
    const rowStyle = flatten({ style: row.props.style });
    const gap = Number(rowStyle.columnGap ?? rowStyle.gap);
    const cellWidthSum = cells.reduce((sum, cell) => sum + Number(flatten({ style: cell.props.style }).width), 0);
    return cellWidthSum + gap * (cells.length - 1);
  };

  /** 붙여넣기 버튼의 호스트 조상 가운데 폭을 정한 가장 가까운 것(버튼 줄 래퍼). */
  const findActionsRowWrapper = (): TreeNode => {
    let current = (screen.getByLabelText(PASTE_LABEL) as TreeNode).parent;
    while (current !== null) {
      if (typeof current.type === 'string' && typeof flatten({ style: current.props.style }).width === 'number') {
        return current;
      }
      current = current.parent;
    }
    throw new Error('폭을 정한 버튼 줄 래퍼가 없다');
  };

  /**
   * 버튼부터 코드 입력을 함께 품는 조상(스크롤 콘텐츠) 직전까지의 호스트 조상에서 네이티브 뷰를 만드는 속성을 모은다
   * (판정은 공용 src/test/listViewFormingProps — RN 0.76.9 규칙 전체, 테두리는 두께 0도 포함).

   * @param label 버튼 접근성 이름
   * @returns 속성 이름 배열 — 비어 있어야 버튼 위아래로 넓힌 터치 영역이 잘리지 않는다
   */
  const collectViewFormingAncestorProps = ({ label }: { label: string }): string[] => {
    const found: string[] = [];
    let current = (screen.getByLabelText(label) as TreeNode).parent;
    while (current !== null) {
      if (current.findAll((node) => node.props.testID === 'code-hidden-input').length > 0) return found;
      if (typeof current.type === 'string') found.push(...listViewFormingProps({ node: current }));
      current = current.parent;
    }
    throw new Error('코드 입력을 함께 품는 조상이 없다');
  };

  /** 숨김 입력란과 셀을 함께 품는 가장 가까운 호스트 조상 — CodeInput이 그리는 영역(감싸는 Pressable)의 뿌리. */
  const findCodeInputRoot = () => {
    let current = (screen.getByTestId('code-hidden-input') as TreeNode).parent;
    while (current !== null) {
      const hasCell = current.findAll((node) => node.props.testID === 'code-cell-0').length > 0;
      if (typeof current.type === 'string' && hasCell) return current;
      current = current.parent;
    }
    throw new Error('입력란과 셀을 함께 품는 호스트 조상이 없다');
  };

  it('처음부터 "붙여넣기" 버튼이 있다', () => {
    renderWithTheme(<JoinLogScreen />);
    expect(screen.getByRole('button', { name: PASTE_LABEL })).toBeTruthy();
  });

  it('코드가 비었으면 "지우기"가 없고, 한 글자 이상이면 나타나며, 다시 비우면 사라진다 (AC22)', () => {
    renderWithTheme(<JoinLogScreen />);
    expect(screen.queryByLabelText(CLEAR_LABEL)).toBeNull();
    typeCode('A');
    expect(screen.getByRole('button', { name: CLEAR_LABEL })).toBeTruthy();
    typeCode('');
    expect(screen.queryByLabelText(CLEAR_LABEL)).toBeNull();
  });

  it('입장 중(loading)이면 붙여넣기·지우기가 비활성이다 (AC21)', () => {
    setupHooks({ loading: true });
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    expect(screen.getByLabelText(PASTE_LABEL).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText(CLEAR_LABEL).props.accessibilityState?.disabled).toBe(true);
  });

  it('입장 중이 아니면 붙여넣기·지우기가 활성이다', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    expect(screen.getByLabelText(PASTE_LABEL).props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByLabelText(CLEAR_LABEL).props.accessibilityState?.disabled).toBe(false);
  });

  // 버튼이 감싸는 Pressable 안에 들면 iOS가 입력란과 버튼을 하나로 합쳐 읽는다(code-input-a11y 계약, plan §4.5).
  it('붙여넣기·지우기는 코드 입력 영역(감싸는 Pressable) 밖에 있다', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    // 버튼이 화면에 있다는 것부터 확인한다 — 없으면 아래 "영역 안에 없음"이 저절로 참이 된다.
    expect(screen.getByLabelText(PASTE_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(CLEAR_LABEL)).toBeTruthy();
    // 코드 영역 안에서 두 버튼 이름을 가진 호스트를 찾는다 — 없어야 한다(이름 배열로 비교해 실패 메시지를 짧게).
    const actionLabelsInside = findCodeInputRoot()
      .findAll(
        (node) =>
          typeof node.type === 'string' &&
          (node.props.accessibilityLabel === PASTE_LABEL || node.props.accessibilityLabel === CLEAR_LABEL),
      )
      .map((node) => node.props.accessibilityLabel);
    expect(actionLabelsInside).toStrictEqual([]);
  });

  it('붙여넣기·지우기는 각각 개별 접근성 요소다 — 감싸는 접근성 조상이 없다', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    expect(findAccessibleAncestors({ element: screen.getByLabelText(PASTE_LABEL) })).toStrictEqual([]);
    expect(findAccessibleAncestors({ element: screen.getByLabelText(CLEAR_LABEL) })).toStrictEqual([]);
  });

  // QA QV-3 — "지우기"는 입력(셀 줄) 끝에 둔다(ui-spec §3-3, 킷 RenameDialog 지우기 X 관례 mk-extra:47-51).
  //   줄을 콘텐츠 폭에 두면 기기 폭에 따라 지우기가 셀 줄 끝에서 −16~+19pt 어긋난다 → 줄 폭을 셀 줄 폭에 묶고 가운데에 둔다.
  //   좁은 화면에서는 콘텐츠 폭까지만(최대 100%). 픽셀 배치는 기기 스모크 — 여기서는 폭이 같은 출처인지만 본다.
  it('붙여넣기·지우기 줄은 셀 줄과 같은 폭으로 가운데에 놓인다 — 지우기가 기기 폭과 무관하게 셀 줄 끝에 맞는다 (QV-3)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    const actionsRow = findActionsRowWrapper();
    const rowStyle = flatten({ style: actionsRow.props.style });
    expect(rowStyle.width).toBe(readRenderedCellRowWidth());
    expect(rowStyle.alignSelf).toBe('center');
    expect(rowStyle.maxWidth).toBe('100%');
    // 두 버튼이 이 줄 안에 있다 — 폭을 다른 래퍼에 줘서 버튼 줄과 따로 놀면 여기서 빨개진다.
    const labelsInside = actionsRow
      .findAll(
        (node) =>
          typeof node.type === 'string' &&
          (node.props.accessibilityLabel === PASTE_LABEL || node.props.accessibilityLabel === CLEAR_LABEL),
      )
      .map((node) => node.props.accessibilityLabel);
    expect(labelsInside).toStrictEqual([PASTE_LABEL, CLEAR_LABEL]);
  });

  // 새 아키텍처(Fabric)는 넘치는 자식이 없는 네이티브 뷰의 경계 밖 터치를 버린다(RN 0.76 iOS RCTViewComponentView
  //   betterHitTest · Android TouchTargetHelper). 버튼 줄을 감싼 View에 testID·배경 등을 주면 네이티브 뷰가 되어 그 경계
  //   (버튼 높이 35)에서 위아래 hitSlop 5가 잘린다(QV-1이 무효가 된다) → 버튼과 스크롤 콘텐츠 사이의 View는 레이아웃 전용이어야 한다.
  it.each([PASTE_LABEL, CLEAR_LABEL])(
    '"%s"를 감싼 View는 네이티브 뷰를 만들지 않는다 — 새 아키텍처에서도 넓힌 터치 영역이 잘리지 않는다 (QV-1)',
    (label) => {
      renderWithTheme(<JoinLogScreen />);
      typeCode('AB');
      expect(collectViewFormingAncestorProps({ label })).toStrictEqual([]);
    },
  );
});

// invite-share(U73·U24) — 붙여넣기·지우기 동작과 실패 문구 초기화(plan R16).
describe('JoinLogScreen — 붙여넣기·지우기 동작(U73·U24)', () => {
  const PASTE_LABEL = '초대코드 붙여넣기';
  const CLEAR_LABEL = '초대코드 지우기';
  const PASTE_NOTICE = '복사한 글에서 초대코드를 찾지 못했어요.';
  const JOIN_ERROR = '초대코드를 다시 확인해 주세요.';
  const STORE_URL = 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594';
  const messageWith = ({ code }: { code: string }) =>
    `먹로그에서 우리 맛집 같이 기록해요\n초대코드: ${code}\n앱 받기: ${STORE_URL}`;

  const inputValue = () => screen.getByTestId('code-hidden-input').props.value;
  const isJoinDisabled = () => screen.getByLabelText('들어가기').props.accessibilityState?.disabled;

  /** "붙여넣기"를 누르고 클립보드 읽기·상태 반영까지 흘려보낸다. */
  const pressPaste = async () => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(PASTE_LABEL));
    });
  };

  it('화면이 뜨는 것만으로는 클립보드를 읽지 않는다 — 입력해도 읽지 않는다 (AC19)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    expect(getStringAsync).not.toHaveBeenCalled();
    expect(hasStringAsync).not.toHaveBeenCalled();
  });

  it('붙여넣기 → 클립보드 1회 읽기 → 공유 메시지의 코드로 6칸을 채우고 키보드를 내린다, "들어가기"로 그 코드로 입장한다 (AC17)', async () => {
    getStringAsync.mockResolvedValue(messageWith({ code: 'K7P3AB' }));
    // 입장 결과는 이 케이스의 관심 밖이다 — 끝나지 않게 두어 성공 토스트·화면 이동이 테스트 뒤로 새지 않게 한다.
    joinRoom.mockReturnValueOnce(new Promise(() => undefined));
    renderWithTheme(<JoinLogScreen />);

    await pressPaste();

    expect(getStringAsync).toHaveBeenCalledTimes(1);
    expect(hasStringAsync).not.toHaveBeenCalled();
    expect(inputValue()).toBe('K7P3AB');
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(isJoinDisabled()).toBe(false);

    fireEvent.press(screen.getByLabelText('들어가기'));
    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith({ code: 'K7P3AB' }));
  });

  it('이미 채운 코드가 있어도 붙여넣은 코드로 통째 바꾼다 (AC17)', async () => {
    getStringAsync.mockResolvedValue(messageWith({ code: 'K7P3AB' }));
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    await pressPaste();
    expect(inputValue()).toBe('K7P3AB');
  });

  // 입장은 "들어가기"를 누를 때만 한다 — 잘못 뽑힌 코드가 시도 제한(10회/1시간)을 쓰지 않게(plan E25 · QA F1).
  it('붙여넣기로 6칸이 채워져도 입장은 자동으로 하지 않는다 — "들어가기"를 눌러야 한다 (E25 · 시도 제한 보호)', async () => {
    getStringAsync.mockResolvedValue(messageWith({ code: 'K7P3AB' }));
    renderWithTheme(<JoinLogScreen />);
    await pressPaste();
    expect(inputValue()).toBe('K7P3AB');
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it('클립보드가 비었으면(iOS 붙여넣기 거부 포함) 입력은 그대로 두고 안내를 띄운다 (AC18)', async () => {
    getStringAsync.mockResolvedValue('');
    renderWithTheme(<JoinLogScreen />);
    await pressPaste();
    expect(inputValue()).toBe('');
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();
  });

  it('허용 문자가 6자 미만이면 입력한 글자를 지우지 않고 같은 안내를 띄운다 (AC18)', async () => {
    getStringAsync.mockResolvedValue('K7P3');
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    await pressPaste();
    expect(inputValue()).toBe('AB');
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();
  });

  // iOS 16+는 클립보드를 읽을 때마다 붙여넣기 허용 창을 띄운다 — 읽는 동안 또 눌러도 한 번만 읽어야 창이 두 번 뜨지 않는다(QA S6).
  //   읽기는 허용·거부 모두 끝나므로(expo-clipboard ios/ClipboardModule.swift:14-17) 끝나면 다시 누를 수 있어야 한다.
  it('클립보드를 읽는 동안 "붙여넣기"를 또 눌러도 한 번만 읽고, 읽기가 끝나면 다시 읽는다 (S6 — iOS 붙여넣기 허용 창 1회)', async () => {
    let finishRead: (text: string) => void = () => undefined;
    getStringAsync.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    );
    renderWithTheme(<JoinLogScreen />);

    fireEvent.press(screen.getByLabelText(PASTE_LABEL));
    fireEvent.press(screen.getByLabelText(PASTE_LABEL));
    expect(getStringAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRead(messageWith({ code: 'K7P3AB' }));
    });
    expect(inputValue()).toBe('K7P3AB');

    getStringAsync.mockResolvedValueOnce(messageWith({ code: 'Q9W8E7' }));
    await pressPaste();
    expect(getStringAsync).toHaveBeenCalledTimes(2);
    expect(inputValue()).toBe('Q9W8E7');
  });

  it('클립보드 읽기가 실패해도 화면이 죽지 않고 같은 안내를 띄운다 (AC18)', async () => {
    getStringAsync.mockRejectedValue(new Error('pasteboard unavailable'));
    renderWithTheme(<JoinLogScreen />);
    await pressPaste();
    expect(inputValue()).toBe('');
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();
  });

  // iPhone SE에서 추천 단어 줄·서드파티 키보드가 떠 있으면 입력 아래 안내 줄이 보이는 영역 밖으로 밀린다(QA QV-2).
  //   안내가 실패의 유일한 피드백이라 키보드를 내려 보이게 한다 — 성공(6자 완성) 때와 같은 동작(ui-spec §3-3 QV-2 ①).
  it('붙여넣기에 실패하면 키보드를 내려 입력 아래 안내가 키보드에 가리지 않게 한다 — 입력한 글자는 그대로 (QV-2)', async () => {
    getStringAsync.mockResolvedValue('K7P3');
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');
    expect(Keyboard.dismiss).not.toHaveBeenCalled();

    await pressPaste();

    expect(inputValue()).toBe('AB');
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it('입장 실패 문구가 보이는 상태에서 코드를 한 글자 바꾸면 clearError를 부르고 문구가 사라진다 (AC20)', () => {
    setupHooks({ error: JOIN_ERROR });
    clearErrorResetsHook({ loading: false });
    renderWithTheme(<JoinLogScreen />);
    expect(screen.getByText(JOIN_ERROR)).toBeTruthy();

    typeCode('A');

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(JOIN_ERROR)).toBeNull();
  });

  it('붙여넣기로 코드가 바뀌어도 입장 실패 문구가 사라진다 (AC20)', async () => {
    getStringAsync.mockResolvedValue(messageWith({ code: 'K7P3AB' }));
    setupHooks({ error: JOIN_ERROR });
    clearErrorResetsHook({ loading: false });
    renderWithTheme(<JoinLogScreen />);

    await pressPaste();

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(JOIN_ERROR)).toBeNull();
    expect(inputValue()).toBe('K7P3AB');
  });

  it('허용 안 되는 글자라 값이 그대로면 clearError를 부르지 않고 문구를 남긴다 (AC20)', () => {
    const { rerender } = renderWithTheme(<JoinLogScreen />);
    typeCode('ABC');
    // 'ABC'로 입장했다가 실패한 상태를 만든다(훅이 error를 세팅).
    setupHooks({ error: JOIN_ERROR });
    rerender(<JoinLogScreen />);
    clearError.mockClear();

    typeCode('ABC0');

    expect(inputValue()).toBe('ABC');
    expect(clearError).not.toHaveBeenCalled();
    expect(screen.getByText(JOIN_ERROR)).toBeTruthy();
  });

  it('같은 코드를 다시 붙여넣으면 값이 그대로라 clearError를 부르지 않고 입장 실패 문구를 남긴다 (E22 — 같은 코드는 같은 결과)', async () => {
    getStringAsync.mockResolvedValue(messageWith({ code: 'K7P3AB' }));
    const { rerender } = renderWithTheme(<JoinLogScreen />);
    typeCode('K7P3AB');
    // 'K7P3AB'로 입장했다가 실패한 상태를 만든다. clearError 대역은 실물처럼 훅 반환의 error를 지운다.
    setupHooks({ error: JOIN_ERROR });
    clearErrorResetsHook({ loading: false });
    rerender(<JoinLogScreen />);
    clearError.mockClear();

    await pressPaste();
    // 실물 훅은 clearError가 불리면 상태가 바뀌어 화면을 다시 그린다. 대역에는 그 재렌더가 없어 직접 다시 그려 문구를 본다.
    rerender(<JoinLogScreen />);

    expect(inputValue()).toBe('K7P3AB');
    expect(clearError).not.toHaveBeenCalled();
    expect(screen.getByText(JOIN_ERROR)).toBeTruthy();
  });

  it('붙여넣기 안내가 보이는 상태에서 코드를 한 글자 바꾸면 안내가 사라진다 (AC20)', async () => {
    getStringAsync.mockResolvedValue('');
    renderWithTheme(<JoinLogScreen />);
    await pressPaste();
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();

    typeCode('A');

    expect(screen.queryByText(PASTE_NOTICE)).toBeNull();
  });

  it('안내 뒤 성공한 붙여넣기는 값이 같아도 "찾지 못했어요" 안내를 지운다', async () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('K7P3AB');
    getStringAsync.mockResolvedValueOnce('');
    await pressPaste();
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();

    getStringAsync.mockResolvedValueOnce(messageWith({ code: 'K7P3AB' }));
    await pressPaste();

    expect(inputValue()).toBe('K7P3AB');
    expect(screen.queryByText(PASTE_NOTICE)).toBeNull();
  });

  it('안내와 입장 오류가 겹치면 안내를 먼저 보이고, "들어가기"를 누르면 안내를 지운다(오류는 훅이 새로 세팅)', async () => {
    const { rerender } = renderWithTheme(<JoinLogScreen />);
    typeCode('K7P3AB');
    setupHooks({ error: JOIN_ERROR });
    rerender(<JoinLogScreen />);
    getStringAsync.mockResolvedValue('');
    await pressPaste();
    expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();
    expect(screen.queryByText(JOIN_ERROR)).toBeNull();

    joinRoom.mockImplementationOnce(async () => {
      throw new Error('INVALID_CODE');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('들어가기'));
    });

    expect(joinRoom).toHaveBeenCalledWith({ code: 'K7P3AB' });
    expect(screen.queryByText(PASTE_NOTICE)).toBeNull();
    expect(screen.getByText(JOIN_ERROR)).toBeTruthy();
  });

  it('입장 중(loading)이면 붙여넣기를 눌러도 클립보드를 읽지 않고, 지우기를 눌러도 값이 그대로다 (AC21)', async () => {
    setupHooks({ loading: true });
    renderWithTheme(<JoinLogScreen />);
    typeCode('AB');

    await pressPaste();
    fireEvent.press(screen.getByLabelText(CLEAR_LABEL));

    expect(getStringAsync).not.toHaveBeenCalled();
    expect(inputValue()).toBe('AB');
  });

  describe('지우기 (AC22)', () => {
    let focusSpy: jest.SpyInstance;
    beforeEach(() => {
      focusSpy = jest.spyOn(TextInput.prototype, 'focus');
    });
    afterEach(() => {
      focusSpy.mockRestore();
    });

    it('지우기 → 값 비움 · "들어가기" 비활성 · clearError · 숨김 입력란 포커스 요청(키보드 다시 올림)', () => {
      renderWithTheme(<JoinLogScreen />);
      typeCode('ABCDEF');
      clearError.mockClear();
      focusSpy.mockClear();

      fireEvent.press(screen.getByLabelText(CLEAR_LABEL));

      expect(inputValue()).toBe('');
      expect(isJoinDisabled()).toBe(true);
      expect(clearError).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalledTimes(1);
      expect(focusSpy.mock.contexts[0]).toBe(screen.UNSAFE_getByType(TextInput).instance);
    });

    it('지우기는 입장 실패 문구와 붙여넣기 안내를 함께 지운다', async () => {
      getStringAsync.mockResolvedValue('');
      setupHooks({ error: JOIN_ERROR });
      clearErrorResetsHook({ loading: false });
      const { rerender } = renderWithTheme(<JoinLogScreen />);
      typeCode('AB');
      // 한 글자 입력으로 문구가 지워졌으니 실패를 다시 세팅한다.
      setupHooks({ error: JOIN_ERROR });
      rerender(<JoinLogScreen />);
      await pressPaste();
      expect(screen.getByText(PASTE_NOTICE)).toBeTruthy();

      fireEvent.press(screen.getByLabelText(CLEAR_LABEL));

      expect(screen.queryByText(PASTE_NOTICE)).toBeNull();
      expect(screen.queryByText(JOIN_ERROR)).toBeNull();
    });
  });
});
