// src/navigation/screens/LogListScreen.spec.tsx
// 내 로그 목록 화면 — loading/error/empty/list 4분기, 빈 상태(에러 아님), 카드(배지·생성일·탭→LogScreen).
// (plan §4.5 / §5 T8, C2·C9·C10·C11) useMyLogsContext·useNavigation 모킹. formatLogDate 등 유틸은 실 구현.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('@/features/room', () => ({ useMyLogsContext: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { useMyLogsContext } from '@/features/room';
import { LogListScreen } from './LogListScreen';
import { Routes } from '../routes';

const useMyLogsContextMock = useMyLogsContext as jest.Mock;
const refresh = jest.fn();

const log = (over?: Partial<{
  roomId: string;
  mode: string;
  memberCount: number;
  createdAt: string;
  joinedAt: string;
}>) => ({
  roomId: 'r1',
  mode: 'couple',
  memberCount: 2,
  createdAt: '2026-06-10T00:00:00.000Z',
  joinedAt: '2026-06-10T01:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  refresh.mockReset();
});

describe('LogListScreen — 상태 분기', () => {
  it('loading이면 스피너(testID loglist-loading)를 표시한다', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'loading' }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByTestId('loglist-loading')).toBeTruthy();
  });

  it('error면 메시지 + "다시 시도"를 표시하고, 누르면 refresh를 호출한다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'error', message: '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.' },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('로그 목록을 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });

  it('ready & 빈 배열이면 빈 상태(에러 아님)를 표시한다 (C9)', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('아직 로그가 없어요')).toBeTruthy();
    // 가이드 문구(+ 버튼 안내) 노출
    expect(screen.getByText(/\+ 버튼/)).toBeTruthy();
  });
});

describe('LogListScreen — 카드(list)', () => {
  it('멤버 2명이면 "둘이" 배지, 1명이면 "혼자" 배지를 보인다 (C2 파생)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: {
        status: 'ready',
        logs: [
          log({ roomId: 'r1', memberCount: 2 }),
          log({ roomId: 'r2', memberCount: 1, createdAt: '2026-06-09T00:00:00.000Z' }),
        ],
      },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('둘이')).toBeTruthy();
    expect(screen.getByText('혼자')).toBeTruthy();
  });

  it('생성일을 YYYY.MM.DD로 표기한다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ createdAt: '2026-06-10T00:00:00.000Z' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('2026.06.10')).toBeTruthy();
  });

  it('카드를 누르면 LogScreen으로 roomId를 전달하며 이동한다 (C10)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r-tap' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByLabelText('로그 열기'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.LogScreen, { roomId: 'r-tap' });
  });
});
