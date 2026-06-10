// src/navigation/screens/ProfileScreen.spec.tsx
// 화면 핵심 흐름 — prefill, 닉네임 검증(저장 disabled+메시지), 사진 변경→changeAvatar, 에러 표시, 저장 성공→refresh.
// 멀티 로그 전환(multi-log-home): "방 나가기" 섹션 제거(plan §4.8 ★(2)) → 나가기/멤버십/네비 관련 케이스 삭제.
// (plan §5 T11 / P1·P5·P6) 훅/auth는 모킹, validateNickname 등 유틸은 실 구현 사용.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 유틸(nickname/errors)은 실제, 훅 2종만 모킹. ⚠️ 배럴 requireActual은 supabase→AsyncStorage를 끌어오므로
// 순수 모듈만 requireActual한다(code.ts requireActual 패턴).
jest.mock('@/features/profile', () => {
  const nickname = jest.requireActual('@/features/profile/nickname');
  const errors = jest.requireActual('@/features/profile/errors');
  return { ...nickname, ...errors, useProfile: jest.fn(), useUpdateProfile: jest.fn() };
});
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

import { useProfile, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/features/auth';
import { ProfileScreen } from './ProfileScreen';

const useProfileMock = useProfile as jest.Mock;
const useUpdateProfileMock = useUpdateProfile as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
  setupProfile({ status: 'ready', profile: { nickname: '민수', avatarUrl: null } });
  setupUpdate();
});

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

describe('ProfileScreen — ready(편집)', () => {
  it('현재 닉네임을 입력칸에 prefill한다', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByDisplayValue('민수')).toBeTruthy();
  });

  it('닉네임을 비우면 "저장"이 disabled되고 안내 메시지가 보인다 (P5)', () => {
    renderWithTheme(<ProfileScreen />);
    fireEvent.changeText(screen.getByDisplayValue('민수'), '');
    expect(screen.getByText('닉네임을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '저장' }).props.accessibilityState.disabled).toBe(true);
  });

  it('"사진 변경"을 누르면 changeAvatar를 호출한다', async () => {
    changeAvatar.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('사진 변경'));
    await waitFor(() => {
      expect(changeAvatar).toHaveBeenCalled();
    });
  });

  it('아바타 업로드 에러 메시지를 표시한다 (P6)', () => {
    setupUpdate({ error: '이미지 업로드에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('이미지 업로드에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  it('닉네임을 바꿔 "저장"하면 saveNickname({nickname}) 후 refresh를 호출한다', async () => {
    saveNickname.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(saveNickname).toHaveBeenCalledWith({ nickname: '새닉' });
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('prefill 직후(변경 없음)에는 "저장"이 disabled다 (불필요 쓰기 방지)', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByRole('button', { name: '저장' }).props.accessibilityState.disabled).toBe(true);
  });

  it('빈 상태(nickname null)면 입력칸이 비어 있고 플레이스홀더 아바타를 보인다', () => {
    setupProfile({ status: 'ready', profile: { nickname: null, avatarUrl: null } });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
  });
});

describe('ProfileScreen — 멀티 로그 전환(나가기 제거, C12)', () => {
  it('"방 나가기" 버튼을 더 이상 렌더하지 않는다 (멀티 로그: 로그별 나가기는 차기 LogScreen으로 이전)', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.queryByText('방 나가기')).toBeNull();
  });

  it('닉네임/아바타 편집은 그대로 동작한다(회귀 0)', async () => {
    saveNickname.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉네임');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(saveNickname).toHaveBeenCalledWith({ nickname: '새닉네임' });
    });
  });
});
