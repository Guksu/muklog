// src/features/auth/oauthSignIn.spec.ts
// Google OAuth 웹 플로우(PKCE) 헬퍼 — signInWithOAuth → openAuthSessionAsync → exchangeCodeForSession.
//   expo-linking / expo-web-browser / supabase를 모킹해 성공·취소·실패 경로를 검증한다.

// expo-linking: createURL(리다이렉트 URL 생성) + parse(리다이렉트에서 code 추출).
const mockParse = jest.fn();
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `muklog://${path}`,
  parse: (...args: unknown[]) => mockParse(...args),
}));

// expo-web-browser: openAuthSessionAsync(인앱 브라우저) + maybeCompleteAuthSession(모듈 로드 시 1회).
const mockOpenAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
}));

// supabase: signInWithOAuth(URL 생성) + exchangeCodeForSession(세션 교환).
const mockSignInWithOAuth = jest.fn();
const mockExchangeCode = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a),
      exchangeCodeForSession: (...a: unknown[]) => mockExchangeCode(...a),
    },
  },
}));

import { AuthErrorToken } from '../errors';
import { signInWithGoogleOAuth } from './oauthSignIn';

beforeEach(() => {
  jest.clearAllMocks();
  // 기본: OAuth URL 정상 발급 + 브라우저 성공 리다이렉트(code 포함) + 세션 교환 성공.
  mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/auth' }, error: null });
  mockOpenAuthSession.mockResolvedValue({ type: 'success', url: 'muklog://auth/callback?code=abc123' });
  mockParse.mockReturnValue({ queryParams: { code: 'abc123' } });
  mockExchangeCode.mockResolvedValue({ data: { session: { user: { id: 'gid' } } }, error: null });
});

describe('signInWithGoogleOAuth', () => {
  it('성공: 리다이렉트 code를 교환해 { ok:true, userId }를 반환한다', async () => {
    const result = await signInWithGoogleOAuth();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'muklog://auth/callback', skipBrowserRedirect: true },
    });
    expect(mockExchangeCode).toHaveBeenCalledWith('abc123');
    expect(result).toEqual({ ok: true, userId: 'gid' });
  });

  it('signInWithOAuth 실패 시 NetworkFailed를 반환하고 브라우저를 열지 않는다', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const result = await signInWithGoogleOAuth();
    expect(mockOpenAuthSession).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed });
  });

  it('사용자 취소(type=cancel) 시 cancelled 신호를 반환하고 교환하지 않는다', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });
    const result = await signInWithGoogleOAuth();
    expect(mockExchangeCode).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled });
  });

  it('리다이렉트에 code가 없으면 TokenExchangeFailed를 반환한다', async () => {
    mockParse.mockReturnValue({ queryParams: {} });
    const result = await signInWithGoogleOAuth();
    expect(mockExchangeCode).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.TokenExchangeFailed });
  });

  it('exchangeCodeForSession 실패 시 TokenExchangeFailed를 반환한다', async () => {
    mockExchangeCode.mockResolvedValue({ data: { session: null }, error: { message: 'rejected' } });
    const result = await signInWithGoogleOAuth();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.TokenExchangeFailed });
  });
});
