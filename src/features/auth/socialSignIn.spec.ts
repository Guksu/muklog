// src/features/auth/socialSignIn.spec.ts
// 네이티브 소셜 로그인 헬퍼 — Apple(expo-apple-authentication) 래퍼.
//   결과는 판별 가능한 union: { ok:true, token } | { ok:false, cancelled } | { ok:false, token: AuthErrorToken }.
//   (Google은 OAuth 웹 플로우로 분리 — oauthSignIn.spec.ts에서 검증.)
import { Platform } from 'react-native';

// expo-apple-authentication: signInAsync + scope enum 모킹.
const mockSignInAsync = jest.fn();
jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

import { AuthErrorToken } from './errors';
import { signInWithAppleNative } from './socialSignIn';

const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
});

describe('signInWithAppleNative', () => {
  it('iOS 성공 시 { ok:true, token: identityToken }을 반환한다', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'a-id-token' });
    const result = await signInWithAppleNative();
    expect(result).toEqual({ ok: true, token: 'a-id-token' });
  });

  it('취소(ERR_REQUEST_CANCELED) 시 cancelled 신호를 반환한다', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    const result = await signInWithAppleNative();
    expect(result).toEqual({ ok: false, cancelled: true, token: AuthErrorToken.AppleCancelled });
  });

  it('identityToken이 null이면 NoIdToken을 반환한다', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null });
    const result = await signInWithAppleNative();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NoIdToken });
  });

  it('일반 에러는 NetworkFailed로 일반화한다', async () => {
    mockSignInAsync.mockRejectedValue(new Error('boom'));
    const result = await signInWithAppleNative();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed });
  });

  it('Android에서는 호출하지 않고 NoIdToken(방어적 early return)을 반환한다', async () => {
    setPlatform('android');
    const result = await signInWithAppleNative();
    expect(mockSignInAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NoIdToken });
  });
});
