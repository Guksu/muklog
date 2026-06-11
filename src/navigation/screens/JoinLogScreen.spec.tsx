// src/navigation/screens/JoinLogScreen.spec.tsx
// 초대코드 입장 화면 — 버튼 활성 조건·성공 시 refresh+replace·실패 시 인라인 에러 (plan §6.5 / §5 T8, AC11–AC15).
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 code/errors는 실 구현 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const code = jest.requireActual('@/features/room/code');
  return { ...code, useJoinRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace }),
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

beforeEach(() => {
  jest.clearAllMocks();
  joinRoom.mockReset();
  refresh.mockReset();
  mockReplace.mockReset();
  setupHooks();
});

describe('JoinLogScreen', () => {
  it('6자 미만이면 입장 버튼이 비활성이라 joinRoom을 호출하지 않는다 (AC11)', () => {
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDE'); // 5자
    fireEvent.press(screen.getByLabelText('입장하기'));
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it('6자 완성 시 입장 → joinRoom({code}) → refresh() → navigation.replace(LogScreen) (AC12)', async () => {
    joinRoom.mockResolvedValueOnce({ roomId: 'r1' });
    renderWithTheme(<JoinLogScreen />);

    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('입장하기'));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith({ code: 'ABCDEF' });
    });
    expect(refresh).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('LogScreen', { roomId: 'r1' });
  });

  it('실패 시(INVALID_CODE) 인라인 에러 메시지를 표시하고 네비게이션하지 않는다 (AC13)', async () => {
    joinRoom.mockImplementationOnce(async () => {
      // useJoinRoom이 error를 세팅하고 throw 하는 실제 동작 모사
      setupHooks({ error: '초대코드를 다시 확인해 주세요.' });
      throw new Error('INVALID_CODE');
    });
    const { rerender } = renderWithTheme(<JoinLogScreen />);

    typeCode('ZZZZZZ');
    fireEvent.press(screen.getByLabelText('입장하기'));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalled();
    });
    rerender(<JoinLogScreen />);
    expect(screen.getByText('초대코드를 다시 확인해 주세요.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('useJoinRoom.error(ROOM_FULL 매핑)를 인라인 에러로 표시한다 (AC14)', () => {
    setupHooks({ error: '이미 2명이 모두 입장한 방이에요.' });
    renderWithTheme(<JoinLogScreen />);
    expect(screen.getByText('이미 2명이 모두 입장한 방이에요.')).toBeTruthy();
  });

  it('loading 중에는 입장 버튼이 busy라 joinRoom을 호출하지 않는다', () => {
    setupHooks({ loading: true });
    renderWithTheme(<JoinLogScreen />);
    typeCode('ABCDEF');
    fireEvent.press(screen.getByLabelText('입장하기'));
    expect(joinRoom).not.toHaveBeenCalled();
  });
});
