// src/navigation/screens/ProfileScreen.spec.tsx
// 프로필 화면 핵심 흐름 — 킷 mk-log.jsx:380-451 B3 정합(plan §5 B3 / §5-1).
//   상태 분기(loading/error), 96px 아바타(userId 디폴트)+카메라 배지(탭→changeAvatar),
//   닉네임 편집 시트(prefill·검증·저장→refresh), 통계 3칸[로그·"-"·커플], 설정 리스트 4행.
// 유틸(nickname/errors)은 실제, 훅(profile 2종/auth/room useMyLogs)만 모킹.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// ⚠️ 배럴 requireActual은 supabase→AsyncStorage를 끌어오므로 순수 모듈만 requireActual.
jest.mock('@/features/profile', () => {
  const nickname = jest.requireActual('@/features/profile/nickname');
  const errors = jest.requireActual('@/features/profile/errors');
  // computeProfileStats는 순수 함수(MyLog는 type-only import라 supabase/room 런타임 미연결) → requireActual 안전.
  const profileStats = jest.requireActual('@/features/profile/profileStats');
  return {
    ...nickname,
    ...errors,
    ...profileStats,
    useProfile: jest.fn(),
    useUpdateProfile: jest.fn(),
  };
});
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/room', () => ({ useMyLogs: jest.fn() }));

import { useProfile, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/features/auth';
import { useMyLogs } from '@/features/room';
import { ProfileScreen } from './ProfileScreen';

const useProfileMock = useProfile as jest.Mock;
const useUpdateProfileMock = useUpdateProfile as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const useMyLogsMock = useMyLogs as jest.Mock;

const refresh = jest.fn();
const saveNickname = jest.fn();
const changeAvatar = jest.fn();

const setupProfile = (state: unknown) => {
  useProfileMock.mockReturnValue({ state, refresh });
};
const setupUpdate = (overrides?: {
  savingNickname?: boolean;
  uploadingAvatar?: boolean;
  error?: string | null;
}) => {
  useUpdateProfileMock.mockReturnValue({
    saveNickname,
    changeAvatar,
    savingNickname: overrides?.savingNickname ?? false,
    uploadingAvatar: overrides?.uploadingAvatar ?? false,
    error: overrides?.error ?? null,
  });
};
const setupMyLogs = (logs: { memberCount: number }[] = []) => {
  // 실제 useMyLogs 반환형: { state: MyLogsState, refresh }.
  useMyLogsMock.mockReturnValue({ state: { status: 'ready', logs }, refresh: jest.fn() });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
  setupProfile({ status: 'ready', profile: { nickname: '민수', avatarUrl: null } });
  setupUpdate();
  setupMyLogs();
});

const openNicknameSheet = () => fireEvent.press(screen.getByLabelText('닉네임 편집'));

describe('ProfileScreen — 상태 분기', () => {
  it('loading이면 스피너를 표시한다', () => {
    setupProfile({ status: 'loading' });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByTestId('profile-loading')).toBeTruthy();
  });

  it('error면 메시지와 "다시 시도"를 표시하고, 누르면 refresh를 호출한다', () => {
    setupProfile({ status: 'error', message: '프로필 조회에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('프로필 조회에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });
});

describe('ProfileScreen — ready 구조(B3)', () => {
  it('userId 디폴트 아바타(96px)를 렌더한다(url 없음)', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByTestId('avatar-default')).toBeTruthy();
  });

  it('avatarUrl 있으면 이미지 아바타를 렌더한다', () => {
    setupProfile({ status: 'ready', profile: { nickname: '민수', avatarUrl: 'https://x/a.jpg' } });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByTestId('avatar-image')).toBeTruthy();
  });

  it('카메라 배지를 누르면 changeAvatar를 호출한다(이미지 업로드 동선)', async () => {
    changeAvatar.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('프로필 사진 변경'));
    await waitFor(() => {
      expect(changeAvatar).toHaveBeenCalled();
    });
  });

  it('통계 3칸[로그 수·"-"·커플 로그 수]을 계산해 표시한다', () => {
    setupMyLogs([{ memberCount: 2 }, { memberCount: 1 }, { memberCount: 2 }]);
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('로그')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // 로그 수
    expect(screen.getByText('기록한 맛집')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy(); // 집계 OUT 플레이스홀더
    expect(screen.getByText('커플 로그')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // 커플 로그 수(memberCount>=2)
  });

  it('설정 리스트 4행(알림·위시리스트·이용안내·설정)을 표시한다', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('알림 설정')).toBeTruthy();
    expect(screen.getByText('위시리스트')).toBeTruthy();
    expect(screen.getByText('이용 안내')).toBeTruthy();
    expect(screen.getByText('설정')).toBeTruthy();
  });

  it('아바타 업로드 에러 메시지를 표시한다 (P6)', () => {
    setupUpdate({ error: '이미지 업로드에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('이미지 업로드에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
  });
});

describe('ProfileScreen — 닉네임 편집 시트', () => {
  it('펜슬을 누르면 시트가 열리고 현재 닉네임이 prefill된다', () => {
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    expect(screen.getByDisplayValue('민수')).toBeTruthy();
  });

  it('닉네임을 비우면 "저장"이 disabled되고 안내 메시지가 보인다 (P5)', () => {
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    fireEvent.changeText(screen.getByDisplayValue('민수'), '');
    expect(screen.getByText('닉네임을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '저장' }).props.accessibilityState.disabled).toBe(true);
  });

  it('prefill 직후(변경 없음)에는 "저장"이 disabled다 (불필요 쓰기 방지)', () => {
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    expect(screen.getByRole('button', { name: '저장' }).props.accessibilityState.disabled).toBe(true);
  });

  it('닉네임을 바꿔 "저장"하면 saveNickname({nickname}) 후 refresh를 호출한다', async () => {
    saveNickname.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(saveNickname).toHaveBeenCalledWith({ nickname: '새닉' });
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('빈 상태(nickname null)면 닉네임 미설정 + userId 디폴트 아바타를 보인다', () => {
    setupProfile({ status: 'ready', profile: { nickname: null, avatarUrl: null } });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('닉네임 미설정')).toBeTruthy();
    expect(screen.getByTestId('avatar-default')).toBeTruthy();
  });
});
