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

// --- 푸시 토큰 등록/폐기 모킹 (S1 T4 배선만 검증, SDK 동작은 useRegisterPushToken.spec이 별도 검증) ---
const mockUseRegisterPushToken = jest.fn();
const mockUnregisterDeviceToken = jest.fn();
jest.mock('@/features/notif/useRegisterPushToken', () => ({
  useRegisterPushToken: (...a: unknown[]) => mockUseRegisterPushToken(...a),
  unregisterDeviceToken: (...a: unknown[]) => mockUnregisterDeviceToken(...a),
}));

// --- 소셜 헬퍼 모킹 (Google=OAuth 웹 플로우 / Apple=네이티브) ---
const mockGoogleOAuth = jest.fn();
const mockAppleNative = jest.fn();
jest.mock('../oauthSignIn', () => ({
  signInWithGoogleOAuth: (...a: unknown[]) => mockGoogleOAuth(...a),
}));
jest.mock('../socialSignIn', () => ({
  signInWithAppleNative: (...a: unknown[]) => mockAppleNative(...a),
}));

// --- OAuth 콜백 딥링크 복구 모킹 (Android singleTop 회귀 대비, oauthCallback.spec이 SDK 동작 별도 검증) ---
const mockRecoverFromInitialUrl = jest.fn();
const mockSubscribeCallback = jest.fn();
jest.mock('../oauthCallback', () => ({
  recoverOAuthSessionFromInitialUrl: (...a: unknown[]) => mockRecoverFromInitialUrl(...a),
  subscribeOAuthCallback: (...a: unknown[]) => mockSubscribeCallback(...a),
}));

import { AuthErrorToken } from '../errors';
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

// subscribeOAuthCallback에 넘긴 onUserId를 캡처해 딥링크 도착을 테스트에서 직접 발화.
type OnUserId = (params: { userId: string }) => void;
let callbackOnUserId: OnUserId | null = null;
const unsubscribeCallback = jest.fn();

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
  callbackOnUserId = null;
  mockUpsert.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockUnregisterDeviceToken.mockResolvedValue(undefined);
  mockOnAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => void) => {
    authChangeCb = cb;
    return { data: { subscription: { unsubscribe } } };
  });
  // 기본: 딥링크 복구 없음(정상 경로) + 구독은 no-op 해제 함수 반환.
  mockRecoverFromInitialUrl.mockResolvedValue(null);
  mockSubscribeCallback.mockImplementation(({ onUserId }: { onUserId: OnUserId }) => {
    callbackOnUserId = onUserId;
    return unsubscribeCallback;
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

// Android singleTop 회귀: 커스텀탭 리다이렉트가 MainActivity 새 인스턴스를 띄워 JS가 재시작되면
// openAuthSessionAsync promise가 유실돼 "로그인 성공했는데 로그인 화면"이 된다. 두 복구 경로를 잠근다.
describe('AuthProvider — OAuth 콜백 딥링크 복구', () => {
  it('콜드 재시작: 세션 없어도 초기 URL 복구 성공이면 authenticated (로그인 화면으로 안 떨어짐)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockRecoverFromInitialUrl.mockResolvedValue('u-deeplink');

    renderProvider();

    await waitFor(() => expect(screen.getByText('authenticated:u-deeplink')).toBeTruthy());
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('콜드 재시작: 복구 대상이 없으면 기존대로 unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockRecoverFromInitialUrl.mockResolvedValue(null);

    renderProvider();

    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    expect(mockRecoverFromInitialUrl).toHaveBeenCalledTimes(1);
  });

  it('세션이 이미 있으면 딥링크 복구를 시도하지 않는다', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u-soc' }));

    renderProvider();

    await waitFor(() => expect(screen.getByText('authenticated:u-soc')).toBeTruthy());
    expect(mockRecoverFromInitialUrl).not.toHaveBeenCalled();
  });

  it('웜 복귀: 구독 onUserId 통지 → authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    await act(async () => {
      callbackOnUserId?.({ userId: 'u-warm' });
    });

    await waitFor(() => expect(screen.getByText('authenticated:u-warm')).toBeTruthy());
    expect(captured?.loginError).toBeNull();
  });

  it('딥링크 복구가 먼저 성공하면 뒤늦은 브라우저 취소 결과가 상태를 덮어쓰지 않는다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    // 브라우저 promise는 리다이렉트로 커스텀탭이 닫히면서 취소로 "늦게" resolve된다 — 수동 제어.
    let resolveBrowser: (result: unknown) => void = () => {};
    mockGoogleOAuth.mockReturnValue(
      new Promise((resolve) => {
        resolveBrowser = resolve;
      }),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    // 사용자가 버튼 탭 → authenticating (브라우저 결과는 아직 미정).
    let signInDone: Promise<void> | undefined;
    await act(async () => {
      signInDone = captured?.signInWithGoogle();
    });
    expect(captured?.state.status).toBe('authenticating');

    // 딥링크가 먼저 도착해 로그인을 끝낸다.
    await act(async () => {
      callbackOnUserId?.({ userId: 'u-race' });
    });
    await waitFor(() => expect(screen.getByText('authenticated:u-race')).toBeTruthy());

    // 그 뒤 브라우저가 취소로 늦게 resolve — authenticated 유지, 에러 문구도 없어야 한다.
    await act(async () => {
      resolveBrowser({ ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled });
      await signInDone;
    });

    expect(screen.getByText('authenticated:u-race')).toBeTruthy();
    expect(captured?.loginError).toBeNull();
  });

  it('언마운트 시 딥링크 구독을 해제한다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    view.unmount();

    expect(unsubscribeCallback).toHaveBeenCalled();
  });
});

describe('AuthProvider — signInWithGoogle', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('성공: authenticating(google) → OAuth → ensureProfile → authenticated', async () => {
    mockGoogleOAuth.mockResolvedValue({ ok: true, userId: 'gid' });
    mockUpsert.mockResolvedValue({ error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());

    await act(async () => {
      await captured?.signInWithGoogle();
    });
    // OAuth 성공 → ensureProfileAndAuth(userId) → authenticated. idToken 경로 미사용.
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('authenticated:gid')).toBeTruthy());
    expect(captured?.loginError).toBeNull();
  });

  it('취소: unauthenticated + loginError=null', async () => {
    mockGoogleOAuth.mockResolvedValue({
      ok: false,
      cancelled: true,
      token: AuthErrorToken.GoogleCancelled,
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => {
      await captured?.signInWithGoogle();
    });
    expect(captured?.state.status).toBe('unauthenticated');
    expect(captured?.loginError).toBeNull();
  });

  it('실패(TokenExchangeFailed): unauthenticated + 메시지', async () => {
    mockGoogleOAuth.mockResolvedValue({
      ok: false,
      cancelled: false,
      token: AuthErrorToken.TokenExchangeFailed,
    });
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

  it('signOut → unregisterDeviceToken을 현재 userId로 호출(T6, 로그아웃 토큰 폐기)', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u1' }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('authenticated:u1')).toBeTruthy());

    await act(async () => {
      await captured?.signOut();
    });
    expect(mockUnregisterDeviceToken).toHaveBeenCalledWith({ userId: 'u1' });
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

describe('AuthProvider — 푸시 토큰 등록 배선(S1 T4)', () => {
  it('AC10: authenticated 전이 시 useRegisterPushToken({ userId })로 구동된다', async () => {
    mockGetSession.mockResolvedValue(session({ id: 'u1' }));
    renderProvider();
    await waitFor(() => expect(screen.getByText('authenticated:u1')).toBeTruthy());
    expect(mockUseRegisterPushToken).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('AC10: unauthenticated/loading 상태에선 userId="" 로만 호출(authenticated userId로 미구동)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    expect(mockUseRegisterPushToken).toHaveBeenCalledWith({ userId: '' });
    expect(mockUseRegisterPushToken).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.stringMatching(/.+/) }),
    );
  });
});
