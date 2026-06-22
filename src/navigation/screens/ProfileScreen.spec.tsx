// src/navigation/screens/ProfileScreen.spec.tsx
// 프로필 화면 핵심 흐름 — 킷 mk-log.jsx:527-622 ProfileScreen 정합(plan profile-fidelity S5).
//   상태 분기(loading/error), 96px 아바타(userId 디폴트)+카메라 배지(탭→changeAvatar·실변경 토스트),
//   닉네임 편집 시트(prefill·검증·저장→refresh·토스트), 통계 3칸[로그·Σ맛집·커플], 설정 리스트 2행(알림·이용안내),
//   이용안내 토스트, 즉시 로그아웃(Alert 없음).
// 유틸(nickname/errors)은 실제, 훅(profile 2종/auth/room useMyLogs)·전역 토스트만 모킹.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { renderWithTheme } from '@/test/renderWithTheme';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';

// ⚠️ 배럴 requireActual은 supabase→AsyncStorage를 끌어오므로 순수 모듈만 requireActual.
jest.mock('@/features/profile', () => {
  const nickname = jest.requireActual('@/features/profile/nickname');
  const errors = jest.requireActual('@/features/profile/errors');
  // computeProfileStats는 순수 함수(MyLog는 type-only import라 supabase/room 런타임 미연결) → requireActual 안전.
  const profileStats = jest.requireActual('@/features/profile/profileStats');
  // DeleteAccountSheet 는 순수 presentational(Sheet/Button/Text + 토큰) → requireActual 안전(supabase 미연결).
  const deleteAccountSheet = jest.requireActual('@/features/profile/DeleteAccountSheet');
  return {
    ...nickname,
    ...errors,
    ...profileStats,
    ...deleteAccountSheet,
    useProfile: jest.fn(),
    useUpdateProfile: jest.fn(),
    useDeleteAccount: jest.fn(),
  };
});
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/room', () => ({ useMyLogs: jest.fn() }));
// 약관/개인정보 행 → 인앱 브라우저(openBrowserAsync) 모킹.
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));
// SubBar(뒤로) + 설정 행 진입을 위한 navigation 모킹 — goBack/navigate.
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
}));

// Alert.alert: 즉시 로그아웃 전환 후엔 호출되지 않아야 함(회귀 가드).
import { Alert } from 'react-native';
jest.spyOn(Alert, 'alert');

import { useDeleteAccount, useProfile, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/features/auth';
import { useMyLogs } from '@/features/room';
import { ProfileScreen } from './ProfileScreen';

const useProfileMock = useProfile as jest.Mock;
const useUpdateProfileMock = useUpdateProfile as jest.Mock;
const useDeleteAccountMock = useDeleteAccount as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const useMyLogsMock = useMyLogs as jest.Mock;

const refresh = jest.fn();
const saveNickname = jest.fn();
const changeAvatar = jest.fn();
const signOut = jest.fn();
const deleteAccount = jest.fn();

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
const setupMyLogs = (logs: { memberCount: number; spotCount?: number }[] = []) => {
  // 실제 useMyLogs 반환형: { state: MyLogsState, refresh }. spotCount 누락 시 0(통계 합산용).
  const withSpot = logs.map((l) => ({ spotCount: 0, ...l }));
  useMyLogsMock.mockReturnValue({ state: { status: 'ready', logs: withSpot }, refresh: jest.fn() });
};

const setupDelete = (overrides?: { loading?: boolean; error?: string | null }) => {
  useDeleteAccountMock.mockReturnValue({
    deleteAccount,
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({
    state: { status: 'authenticated', userId: 'u1' },
    retry: jest.fn(),
    signOut,
  });
  setupProfile({ status: 'ready', profile: { nickname: '민수', avatarUrl: null } });
  setupUpdate();
  setupDelete();
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
    changeAvatar.mockResolvedValueOnce({ changed: true });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('프로필 사진 변경'));
    await waitFor(() => {
      expect(changeAvatar).toHaveBeenCalled();
    });
  });

  it('아바타 실변경 성공 시 "프로필 사진을 변경했어요" 토스트(킷 539)', async () => {
    changeAvatar.mockResolvedValueOnce({ changed: true });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('프로필 사진 변경'));
    await waitFor(() => {
      expect(screen.getByText('프로필 사진을 변경했어요')).toBeTruthy();
    });
  });

  it('아바타 취소(changed:false) 시 토스트 미노출', async () => {
    changeAvatar.mockResolvedValueOnce({ changed: false });
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('프로필 사진 변경'));
    await waitFor(() => {
      expect(changeAvatar).toHaveBeenCalled();
    });
    expect(screen.queryByText('프로필 사진을 변경했어요')).toBeNull();
  });

  it('아바타 실패(reject) 시 토스트 미노출', async () => {
    changeAvatar.mockRejectedValueOnce(new Error('fail'));
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('프로필 사진 변경'));
    await waitFor(() => {
      expect(changeAvatar).toHaveBeenCalled();
    });
    expect(screen.queryByText('프로필 사진을 변경했어요')).toBeNull();
  });

  it('통계 3칸[로그 수·Σ맛집·커플 로그 수]을 계산해 표시한다 (킷 totalSpots)', () => {
    setupMyLogs([
      { memberCount: 2, spotCount: 3 },
      { memberCount: 1, spotCount: 2 },
      { memberCount: 2, spotCount: 0 },
    ]);
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('로그')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // 로그 수
    expect(screen.getByText('기록한 맛집')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy(); // Σ spotCount = 3+2+0
    expect(screen.getByText('커플 로그')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // 커플 로그 수(memberCount>=2)
    // "-" 플레이스홀더는 제거됨(실값 표기).
    expect(screen.queryByText('-')).toBeNull();
  });

  it('설정 리스트(알림 설정·이용 안내·서비스 약관·개인정보 처리방침)를 표시한다 (킷 584 "설정" 행 제거)', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('알림 설정')).toBeTruthy();
    expect(screen.getByText('이용 안내')).toBeTruthy();
    // 약관·개인정보(로그인 후 접근, App Store 정합).
    expect(screen.getByText('서비스 약관')).toBeTruthy();
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy();
    // 킷 584: "설정" 행 제거.
    expect(screen.queryByText('설정')).toBeNull();
    expect(screen.queryByTestId('settings-row-설정')).toBeNull();
    // 델타 #5(B9): 위시리스트 행도 부재(회귀 가드).
    expect(screen.queryByText('위시리스트')).toBeNull();
  });

  it('"알림 설정" 행 탭 → NotifSettings로 navigate 한다 (notif-settings 회귀)', () => {
    mockNavigate.mockClear();
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('settings-row-알림 설정'));
    expect(mockNavigate).toHaveBeenCalledWith('NotifSettings');
  });

  it('"이용 안내" 행 탭 → "조금만 기다려 주세요" 토스트(navigate 미발생) (킷 586)', () => {
    mockNavigate.mockClear();
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('settings-row-이용 안내'));
    expect(screen.getByText('조금만 기다려 주세요')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('"서비스 약관" 행 탭 → 이용약관 URL을 인앱 브라우저로 연다', () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('settings-row-서비스 약관'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(TERMS_URL);
  });

  it('"개인정보 처리방침" 행 탭 → 개인정보 URL을 인앱 브라우저로 연다', () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('settings-row-개인정보 처리방침'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(PRIVACY_URL);
  });

  it('아바타 업로드 에러 메시지를 표시한다 (P6)', () => {
    setupUpdate({ error: '이미지 업로드에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('이미지 업로드에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  it('"로그아웃" 활성 행을 표시한다 (social-auth ⑥)', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('로그아웃')).toBeTruthy();
  });

  it('"로그아웃" 행을 누르면 Alert 없이 즉시 signOut을 호출한다 (즉시 로그아웃, 킷 595)', () => {
    renderWithTheme(<ProfileScreen />);
    fireEvent.press(screen.getByText('로그아웃'));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileScreen — 회원 탈퇴(AC5)', () => {
  const openDeleteSheet = () => fireEvent.press(screen.getByText('회원 탈퇴'));

  it('"회원 탈퇴" 행을 로그아웃 아래에 약하게 표시한다 (Apple 5.1.1(v))', () => {
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('회원 탈퇴')).toBeTruthy();
    // 행 자체는 확인 시트 진입점일 뿐(즉시 삭제 금지) → 초기엔 확인 시트 미노출.
    expect(screen.queryByText('정말 탈퇴할까요?')).toBeNull();
  });

  it('"회원 탈퇴" 행 탭 → 파괴 확인 시트(되돌릴 수 없음)를 연다(즉시 삭제 안 함)', () => {
    renderWithTheme(<ProfileScreen />);
    openDeleteSheet();
    expect(screen.getByText('정말 탈퇴할까요?')).toBeTruthy();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('확인 시트 "취소" → 시트가 닫히고 deleteAccount 미호출', () => {
    renderWithTheme(<ProfileScreen />);
    openDeleteSheet();
    fireEvent.press(screen.getByLabelText('취소'));
    expect(screen.queryByText('정말 탈퇴할까요?')).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('"탈퇴하기" → deleteAccount() 실행, 성공 시 signOut을 호출한다 (AC5 배선)', async () => {
    deleteAccount.mockResolvedValueOnce(true);
    renderWithTheme(<ProfileScreen />);
    openDeleteSheet();
    fireEvent.press(screen.getByLabelText('탈퇴하기'));
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledTimes(1);
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('탈퇴 실패 시 signOut을 호출하지 않고 토스트로 알린다(세션 유지·재시도)', async () => {
    deleteAccount.mockRejectedValueOnce(new Error('fail'));
    setupDelete({ error: '탈퇴에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    openDeleteSheet();
    fireEvent.press(screen.getByLabelText('탈퇴하기'));
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalled();
    });
    expect(signOut).not.toHaveBeenCalled();
    // 실패 신호 2종: 시트 인라인 error(useDeleteAccount.error) + 전역 토스트 → 같은 카피가 둘 노출.
    expect(screen.getAllByText('탈퇴에 실패했어요. 다시 시도해 주세요.').length).toBeGreaterThanOrEqual(1);
  });

  it('탈퇴 진행 중(loading)이면 danger 버튼이 비활성된다(중복 실행 차단)', () => {
    setupDelete({ loading: true });
    renderWithTheme(<ProfileScreen />);
    openDeleteSheet();
    expect(screen.getByLabelText('탈퇴하기').props.accessibilityState.disabled).toBe(true);
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

  it('닉네임 저장 성공 시 "닉네임을 변경했어요" 토스트(킷 545)', async () => {
    saveNickname.mockResolvedValueOnce(undefined);
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(screen.getByText('닉네임을 변경했어요')).toBeTruthy();
    });
  });

  it('닉네임 저장 실패 시 변경 토스트 미노출', async () => {
    saveNickname.mockRejectedValueOnce(new Error('fail'));
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(saveNickname).toHaveBeenCalled();
    });
    expect(screen.queryByText('닉네임을 변경했어요')).toBeNull();
  });

  it('닉네임 입력은 maxLength 20으로 제한한다 (AC3.4)', () => {
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    expect(screen.getByDisplayValue('민수').props.maxLength).toBe(20);
  });

  it('초대코드(extra)는 노출하지 않는다 (AC3.7)', () => {
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    expect(screen.queryByText('초대코드')).toBeNull();
  });

  it('저장 실패 시 다이얼로그가 유지되고 에러를 노출한다 (AC3.6)', async () => {
    saveNickname.mockRejectedValueOnce(new Error('fail'));
    setupUpdate({ error: '닉네임 저장에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<ProfileScreen />);
    openNicknameSheet();
    fireEvent.changeText(screen.getByDisplayValue('민수'), '새닉');
    fireEvent.press(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(saveNickname).toHaveBeenCalled();
    });
    // 실패: 다이얼로그 유지(입력 보존) + useUpdateProfile.error 노출.
    expect(screen.getByDisplayValue('새닉')).toBeTruthy();
    expect(screen.getByText('닉네임 저장에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
  });

  it('빈 상태(nickname null)면 닉네임 미설정 + userId 디폴트 아바타를 보인다', () => {
    setupProfile({ status: 'ready', profile: { nickname: null, avatarUrl: null } });
    renderWithTheme(<ProfileScreen />);
    expect(screen.getByText('닉네임 미설정')).toBeTruthy();
    expect(screen.getByTestId('avatar-default')).toBeTruthy();
  });
});
