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

// 교환은 oauthCallback.exchangeOAuthCode에 위임되고, 거긴 같은 code의 재교환을 막는 메모를 들고 있다
// (딥링크 복구 경로와의 중복 교환 방지). 테스트가 서로 메모를 물려받지 않도록 매 테스트 고유 code를 쓴다.
let codeSeq = 0;
let currentCode = '';

beforeEach(() => {
  jest.clearAllMocks();
  currentCode = `abc${(codeSeq += 1)}`;
  // 기본: OAuth URL 정상 발급 + 브라우저 성공 리다이렉트(code 포함) + 세션 교환 성공.
  mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/auth' }, error: null });
  mockOpenAuthSession.mockResolvedValue({ type: 'success', url: `muklog://auth/callback?code=${currentCode}` });
  mockParse.mockReturnValue({ queryParams: { code: currentCode } });
  mockExchangeCode.mockResolvedValue({ data: { session: { user: { id: 'gid' } } }, error: null });
});

describe('signInWithGoogleOAuth', () => {
  it('성공: 리다이렉트 code를 교환해 { ok:true, userId }를 반환한다', async () => {
    const result = await signInWithGoogleOAuth();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'muklog://auth/callback', skipBrowserRedirect: true },
    });
    expect(mockExchangeCode).toHaveBeenCalledWith(currentCode);
    expect(result).toEqual({ ok: true, userId: 'gid' });
  });

  it('커스텀탭을 같은 태스크로 연다(createTask:false·showInRecents:true — Android 리다이렉트 전달)', async () => {
    await signInWithGoogleOAuth();
    // 별도 태스크(FLAG_ACTIVITY_NEW_TASK)의 커스텀탭에서는 muklog:// 리다이렉트 인텐트가
    // MainActivity로 전달되지 않아 로그인이 dismiss로 끝난다(2026-08-19 실기기 확증).
    expect(mockOpenAuthSession).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/auth',
      'muklog://auth/callback',
      { createTask: false, showInRecents: true },
    );
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
