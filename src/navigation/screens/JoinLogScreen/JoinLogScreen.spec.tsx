// src/navigation/screens/JoinLogScreen.spec.tsx
// 초대코드 입력 화면 — 버튼 활성 조건·성공 시 refresh+replace·실패 시 인라인 에러 (plan §6.5 / §5 T8, AC11–AC15).
//   ux-entry-trust(U2) 추가: 키보드 마찰 3종 — tap 관통(keyboardShouldPersistTaps)·KAV 래핑·6자 완성 시 자동 내림.
import React from 'react';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 code/errors는 실 구현 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const code = jest.requireActual('@/features/room/code');
  return { ...code, useJoinRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
}));

import { useJoinRoom, useMyLogsContext } from '@/features/room';
import { JoinLogScreen } from './JoinLogScreen';

const useJoinRoomMock = useJoinRoom as jest.Mock;
const useMyLogsContextMock = useMyLogsContext as jest.Mock;

const joinRoom = jest.fn();
const refresh = jest.fn();

const setupHooks = (overrides?: { loading?: boolean; error?: string | null }) => {
  useJoinRoomMock.mockReturnValue({
    joinRoom,
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
  });
  useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
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
