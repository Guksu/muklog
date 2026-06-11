// src/navigation/screens/LogScreen.spec.tsx
// 로그 상세 — useRoom 조회 → 솔로(InviteCodeCard) / 커플(코드 숨김) 분기 + 로딩/에러/roomId 누락 방어.
//   (plan §6.1 / §5 T10, AC1·AC3·AC4·AC5·C8). ⚠️ spec 갱신(의도적): 기존 placeholder → useRoom 분기.
import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockParams: { current: unknown } = { current: { roomId: 'r1' } };
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams.current }),
}));

// 배럴 모킹: useRoom만 모킹(supabase 비유입). 나머지 순수 export는 실 구현 유지.
jest.mock('@/features/room', () => {
  const actual = jest.requireActual('@/features/room/code');
  return { ...actual, useRoom: jest.fn() };
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

import { useRoom } from '@/features/room';
import { LogScreen } from './LogScreen';

const useRoomMock = useRoom as jest.Mock;
const refresh = jest.fn();

const setRoomState = (state: unknown) => {
  useRoomMock.mockReturnValue({ state, refresh });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = { roomId: 'r1' };
  setRoomState({ status: 'loading' });
});

describe('LogScreen', () => {
  it('roomId가 없으면(직접 진입) 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = {};
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('params 자체가 undefined여도 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = undefined;
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('loading 상태면 로더를 표시한다', () => {
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByTestId('logscreen-loading')).toBeTruthy();
  });

  it('error 상태면 메시지 + 다시 시도 버튼을 표시하고 코드를 노출하지 않는다 (AC5)', () => {
    setRoomState({ status: 'error', message: '이 로그에 접근할 권한이 없어요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('이 로그에 접근할 권한이 없어요.')).toBeTruthy();
    expect(screen.getByLabelText('다시 시도')).toBeTruthy();
  });

  it('솔로(memberCount=1)면 InviteCodeCard(코드)와 초대 안내를 표시한다 (AC1)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('ABCDEF')).toBeTruthy();
    expect(screen.getByText('초대코드로 짝꿍을 초대하세요')).toBeTruthy();
  });

  it('커플(memberCount=2)이면 초대코드를 숨기고 "둘이 함께 기록 중" 문구를 표시한다 (AC3)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.queryByText('ABCDEF')).toBeNull();
    expect(screen.getByText('둘이 함께 기록 중이에요')).toBeTruthy();
  });
});
