// src/navigation/HomeHeader.spec.tsx
// 홈 커스텀 헤더 — 워드마크 "먹로그"+🍽️ / +버튼(로그 생성) / 프로필 아바타(누르면 Profile 이동).
//   (mk-home HomeHeader 재현 · ui-redesign 슬라이스 A 충실화)
//   useAuth(userId)·useProfile(닉/아바타)·useCreateRoom·useMyLogsContext·useNavigation 모킹.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('@/features/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/features/profile', () => ({
  useProfile: jest.fn(),
}));

jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  return { ...errors, useCreateRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { useCreateRoom, useMyLogsContext } from '@/features/room';

import { HomeHeader } from './HomeHeader';
import { Routes } from './routes';

const useAuthMock = useAuth as jest.Mock;
const useProfileMock = useProfile as jest.Mock;
const useCreateRoomMock = useCreateRoom as jest.Mock;
const useMyLogsContextMock = useMyLogsContext as jest.Mock;

const createRoom = jest.fn();
const refresh = jest.fn();

const setup = (over?: { nickname?: string | null; avatarUrl?: string | null }) => {
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
  useProfileMock.mockReturnValue({
    state: {
      status: 'ready',
      profile: { nickname: over?.nickname ?? '민지', avatarUrl: over?.avatarUrl ?? null },
    },
    refresh: jest.fn(),
  });
  useCreateRoomMock.mockReturnValue({ createRoom, loading: false, error: null });
  useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
};

beforeEach(() => {
  jest.clearAllMocks();
  createRoom.mockReset();
  refresh.mockReset();
  setup();
});

describe('HomeHeader', () => {
  it('워드마크 "먹로그"와 🍽️ 이모지를 렌더한다', () => {
    renderWithTheme(<HomeHeader />);
    expect(screen.getByText('먹로그')).toBeTruthy();
    expect(screen.getByText('🍽️')).toBeTruthy();
  });

  it('+버튼(로그 만들기)을 렌더한다', () => {
    renderWithTheme(<HomeHeader />);
    expect(screen.getByLabelText('로그 만들기')).toBeTruthy();
    expect(screen.getByTestId('icon-plus')).toBeTruthy();
  });

  it('프로필 아바타를 누르면 Profile 라우트로 이동한다', () => {
    renderWithTheme(<HomeHeader />);
    fireEvent.press(screen.getByLabelText('프로필'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.Profile);
  });

  it('아바타 URL이 있으면 이미지로, 없으면 플레이스홀더(이니셜)로 표시한다', () => {
    setup({ avatarUrl: 'https://example.com/a.png', nickname: '민지' });
    const { rerender } = renderWithTheme(<HomeHeader />);
    expect(screen.getByTestId('avatar-image')).toBeTruthy();

    setup({ avatarUrl: null, nickname: '민지' });
    rerender(<HomeHeader />);
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
  });
});
