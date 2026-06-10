// src/navigation/screens/ProfileScreen.spec.tsx
// 화면 핵심 흐름 — prefill, 닉네임 검증(저장 disabled+메시지), 사진 변경→changeAvatar, 에러 표시, 저장 성공→refresh.
// + 방 나가기(room-leave): 버튼 렌더·Alert 확인 콜백 전이·실패 인라인 (plan §4·§5 T4, C-NAV).
// (plan §5-1, T9 / P1·P5·P6) 훅/auth/room/네비/Alert는 모킹, validateNickname 등 유틸은 실 구현 사용.
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 유틸(nickname/errors)은 실제, 훅 2종만 모킹. ⚠️ 배럴 requireActual은 supabase→AsyncStorage를 끌어오므로
// 순수 모듈만 requireActual한다(OnboardingScreen.spec의 code.ts requireActual 패턴).
jest.mock('@/features/profile', () => {
  const nickname = jest.requireActual('@/features/profile/nickname');
  const errors = jest.requireActual('@/features/profile/errors');
  return { ...nickname, ...errors, useProfile: jest.fn(), useUpdateProfile: jest.fn() };
});
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

// 방 나가기: useLeaveRoom·useMembershipContext만 사용. 배럴 전체 모킹(supabase 비유입).
jest.mock('@/features/room', () => ({ useLeaveRoom: jest.fn(), useMembershipContext: jest.fn() }));

// 네비게이션: reset만 필요(type import는 런타임 소거). 팩토리 호이스팅 → mock 프리픽스.
const mockNavReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockNavReset }),
}));

import { useProfile, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/features/auth';
import { useLeaveRoom, useMembershipContext } from '@/features/room';
import { ProfileScreen } from './ProfileScreen';

const useProfileMock = useProfile as jest.Mock;
const useUpdateProfileMock = useUpdateProfile as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const useLeaveRoomMock = useLeaveRoom as jest.Mock;
const useMembershipContextMock = useMembershipContext as jest.Mock;

const refresh = jest.fn();
const saveNickname = jest.fn();
const changeAvatar = jest.fn();
const leaveRoom = jest.fn();
const membershipRefresh = jest.fn();

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
const setupLeave = (overrides?: { leaving?: boolean; error?: string | null }) => {
  useLeaveRoomMock.mockReturnValue({
    leaveRoom,
    loading: overrides?.leaving ?? false,
    error: overrides?.error ?? null,
  });
};

// Alert.alert 모킹 → "나가기"(destructive) 버튼 onPress 콜백을 직접 호출.
const pressLeaveConfirm = async () => {
  const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
  const buttons = (lastCall?.[2] ?? []) as Array<{ text?: string; style?: string; onPress?: () => void }>;
  const confirm = buttons.find((b) => b.style === 'destructive');
  await (confirm?.onPress as () => Promise<void> | void)?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
  setupProfile({ status: 'ready', profile: { nickname: '민수', avatarUrl: null } });
  setupUpdate();
  setupLeave();
  useMembershipContextMock.mockReturnValue({ state: { status: 'in-room', roomId: 'r1' }, refresh: membershipRefresh });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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

describe('ProfileScreen — 방 나가기 (room-leave, C-NAV)', () => {
  it('하단에 "방 나가기" 버튼을 렌더한다', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('방 나가기')).toBeTruthy();
  });

  it('"방 나가기"를 누르면 확인 다이얼로그(Alert.alert)를 띄운다', () => {
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('방 나가기'));
    expect(Alert.alert).toHaveBeenCalled();
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1);
    expect(title).toBe('방을 나갈까요?');
    expect(typeof message).toBe('string');
    // 취소(cancel) + 나가기(destructive) 2버튼
    expect((buttons as Array<{ style?: string }>).some((b) => b.style === 'cancel')).toBe(true);
    expect((buttons as Array<{ style?: string }>).some((b) => b.style === 'destructive')).toBe(true);
  });

  it('확인 시 leaveRoom() 호출 → 성공하면 membership.refresh() + reset(Onboarding) (C-NAV)', async () => {
    leaveRoom.mockResolvedValueOnce({ roomDeleted: true, roomId: 'r1' });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('방 나가기'));

    await pressLeaveConfirm();

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalled();
    });
    expect(membershipRefresh).toHaveBeenCalled();
    expect(mockNavReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
  });

  it('멱등 성공(roomDeleted:false, roomId:null)도 동일하게 Onboarding으로 전이한다', async () => {
    leaveRoom.mockResolvedValueOnce({ roomDeleted: false, roomId: null });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('방 나가기'));

    await pressLeaveConfirm();

    await waitFor(() => {
      expect(mockNavReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
    });
  });

  it('나가기 실패 시 전이 없이(reset/refresh 미호출) 인라인 에러를 표시한다', async () => {
    leaveRoom.mockRejectedValueOnce(new Error('NOT_AUTHENTICATED'));
    setupLeave({ error: '세션이 만료됐어요. 앱을 다시 시작해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('방 나가기'));

    await pressLeaveConfirm();

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalled();
    });
    expect(mockNavReset).not.toHaveBeenCalled();
    expect(membershipRefresh).not.toHaveBeenCalled();
    expect(screen.getByText('세션이 만료됐어요. 앱을 다시 시작해 주세요.')).toBeTruthy();
  });
});
