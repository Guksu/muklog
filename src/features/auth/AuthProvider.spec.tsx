// src/features/auth/AuthProvider.spec.tsx
// AuthProvider 상태머신(plan ②/§3) — 5상태 + 소셜 메서드 + 익명 강등(E8) + onAuthStateChange.
//   supabase(getSession/signInWithIdToken/signOut/onAuthStateChange/profiles.upsert) 모킹.
//   네이티브 헬퍼(socialSignIn)는 결과 union을 직접 모킹(SDK 형태는 socialSignIn.spec이 별도 검증).
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

// --- supabase 모킹 ---
const mockGetSession = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUpsert = jest.fn();
const unsubscribe = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      signInWithIdToken: (...a: unknown[]) => mockSignInWithIdToken(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
      onAuthStateChange: (...a: unknown[]) => mockOnAuthStateChange(...a),
    },
    from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }),
  },
}));

// --- 네이티브 소셜 헬퍼 모킹 ---
const mockConfigureGoogle = jest.fn();
const mockGoogleNative = jest.fn();
const mockAppleNative = jest.fn();
jest.mock('./socialSignIn', () => ({
  configureGoogleSignIn: (...a: unknown[]) => mockConfigureGoogle(...a),
  signInWithGoogleNative: (...a: unknown[]) => mockGoogleNative(...a),
  signInWithAppleNative: (...a: unknown[]) => mockAppleNative(...a),
}));

import { AuthErrorToken } from './errors';
import { AuthProvider, useAuth } from './AuthProvider';

// useAuth를 화면에 투영해 상태/메서드를 단언. context 값을 외부로 노출.
let captured: ReturnType<typeof useAuth> | null = null;
const Probe = () => {
  const value = useAuth();
  captured = value;
  const { state } = value;
  return (
    <Text>
      {state.status}
      {state.status === 'authenticated' ? `:${state.userId}` : ''}
    </Text>
  );
};

// onAuthStateChange 콜백을 캡처해 테스트에서 직접 발화.
let authChangeCb: ((event: string, session: unknown) => void) | null = null;

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const session = (user: { id: string; is_anonymous?: boolean }) => ({
  data: { session: { user } },
  error: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  captured = null;
  authChangeCb = null;
  mockUpsert.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockOnAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
    authChangeCb = cb;
    return { data: { subscription: { unsubscribe } } };
  });
});

describe('AuthProvider — 부트스트랩', () => {
  it('세션 없음 → unauthenticated(익명 자동 발급 0)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('세션 있음 → profiles upsert 후 authenticated(userId 복원)', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u-soc' }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('authenticated:u-soc')).toBeTruthy());
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('익명 세션 잔존 → signOut으로 강등 후 unauthenticated (E8)', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'anon', is_anonymous: true }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('getSession throw → error(message) 전체화면, retry로 재부트스트랩', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('연결 실패'));
    renderProvider();
    await waitFor(() => expect(screen.getByText('error')).toBeTruthy());
    expect(captured?.state.status === 'error' && captured.state.message).toBe('연결 실패');

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await act(async () => {
      captured?.retry();
    });
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
  });
});

describe('AuthProvider — signInWithGoogle', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('성공: authenticating(google) → signInWithIdToken(google) → onAuthStateChange → authenticated', async () => {
    mockGoogleNative.mockResolvedValue({ ok: true, token: 'g-token' });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'gid' } },
      error: null,
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    await act(async () => {
      await captured?.signInWithGoogle();
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'g-token' });
    // onAuthStateChange가 세션 전달 → authenticated.
    await act(async () => {
      authChangeCb?.('SIGNED_IN', { user: { id: 'gid' } });
    });
    await waitFor(() => expect(screen.getByText('authenticated:gid')).toBeTruthy());
    expect(captured?.loginError).toBeNull();
  });

  it('취소: unauthenticated + loginError=null, signInWithIdToken 미호출', async () => {
    mockGoogleNative.mockResolvedValue({
      ok: false,
      cancelled: true,
      token: AuthErrorToken.GoogleCancelled,
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => {
      await captured?.signInWithGoogle();
    });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(captured?.state.status).toBe('unauthenticated');
    expect(captured?.loginError).toBeNull();
  });

  it('NoIdToken: unauthenticated + 메시지, supabase 미호출', async () => {
    mockGoogleNative.mockResolvedValue({
      ok: false,
      cancelled: false,
      token: AuthErrorToken.NoIdToken,
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => {
      await captured?.signInWithGoogle();
    });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(captured?.loginError).toBe('로그인 정보를 받지 못했어요. 다시 시도해 주세요.');
  });

  it('signInWithIdToken 실패: unauthenticated + TokenExchangeFailed 메시지', async () => {
    mockGoogleNative.mockResolvedValue({ ok: true, token: 'g-token' });
    mockSignInWithIdToken.mockResolvedValue({ data: { user: null }, error: { message: 'rejected' } });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => {
      await captured?.signInWithGoogle();
    });
    expect(captured?.state.status).toBe('unauthenticated');
    expect(captured?.loginError).toBe('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });
});

describe('AuthProvider — signInWithApple', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('성공: signInWithIdToken(apple) 호출', async () => {
    mockAppleNative.mockResolvedValue({ ok: true, token: 'a-token' });
    mockSignInWithIdToken.mockResolvedValue({ data: { user: { id: 'aid' } }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => {
      await captured?.signInWithApple();
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'a-token' });
  });
});

describe('AuthProvider — signOut & onAuthStateChange', () => {
  it('signOut → unauthenticated, profileEnsuredRef 리셋(재로그인 시 upsert 재실행)', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u1' }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('authenticated:u1')).toBeTruthy());
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    await act(async () => {
      await captured?.signOut();
    });
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    // 재로그인(onAuthStateChange로 동일 트리거) → upsert 재실행(가드 리셋 확인).
    await act(async () => {
      authChangeCb?.('SIGNED_IN', { user: { id: 'u1' } });
    });
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(2));
  });

  it('onAuthStateChange 세션 null(SIGNED_OUT) → error 강제 전이하지 않는다', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u1' }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('authenticated:u1')).toBeTruthy());
    await act(async () => {
      authChangeCb?.('SIGNED_OUT', null);
    });
    // error로 가지 않음(authenticated 유지 또는 unauthenticated — error 금지).
    await waitFor(() => expect(captured?.state.status).not.toBe('error'));
  });
});
