// src/features/auth/socialSignIn.spec.ts
// 네이티브 소셜 로그인 헬퍼 — google-signin / expo-apple-authentication 래퍼(plan ③④).
//   결과는 판별 가능한 union: { ok:true, token } | { ok:false, cancelled } | { ok:false, token: AuthErrorToken }.
//   네이티브 SDK는 jest.mock(idToken 반환/취소/Play 서비스 없음 시뮬). Platform 분기 검증.
import { Platform } from 'react-native';

// google-signin: configure/signIn/hasPlayServices + statusCodes 모킹.
const mockConfigure = jest.fn();
const mockSignIn = jest.fn();
const mockHasPlayServices = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// expo-apple-authentication: signInAsync + scope enum 모킹.
const mockSignInAsync = jest.fn();
jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// env: 클라이언트 ID 더미 주입(env throw 회피).
jest.mock('@/lib/env', () => ({
  env: {
    GOOGLE_WEB_CLIENT_ID: 'web-client-id',
    GOOGLE_IOS_CLIENT_ID: 'ios-client-id',
  },
}));

import { AuthErrorToken } from './errors';
import {
  configureGoogleSignIn,
  signInWithAppleNative,
  signInWithGoogleNative,
} from './socialSignIn';

const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
  mockHasPlayServices.mockResolvedValue(true);
});

describe('configureGoogleSignIn', () => {
  it('webClientId/iosClientId로 GoogleSignin.configure를 1회 호출한다', () => {
    configureGoogleSignIn();
    expect(mockConfigure).toHaveBeenCalledWith({
      webClientId: 'web-client-id',
      iosClientId: 'ios-client-id',
    });
  });
});

describe('signInWithGoogleNative', () => {
  it('성공 시 { ok:true, token: idToken }을 반환한다', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'g-id-token' } });
    const result = await signInWithGoogleNative();
    expect(result).toEqual({ ok: true, token: 'g-id-token' });
  });

  it('사용자 취소(type=cancelled) 시 { ok:false, cancelled:true }를 반환한다', async () => {
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });
    const result = await signInWithGoogleNative();
    expect(result).toEqual({ ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled });
  });

  it('취소 statusCode를 throw해도 cancelled 신호로 변환한다', async () => {
    mockSignIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    const result = await signInWithGoogleNative();
    expect(result).toEqual({ ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled });
  });

  it('idToken이 없으면 NoIdToken을 반환한다', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } });
    const result = await signInWithGoogleNative();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NoIdToken });
  });

  it('Android에서 Play 서비스 없음(throw)이면 PlayServicesUnavailable을 반환한다', async () => {
    setPlatform('android');
    mockHasPlayServices.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    const result = await signInWithGoogleNative();
    expect(result).toEqual({
      ok: false,
      cancelled: false,
      token: AuthErrorToken.PlayServicesUnavailable,
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('일반 에러는 NetworkFailed로 일반화한다', async () => {
    mockSignIn.mockRejectedValue(new Error('boom'));
    const result = await signInWithGoogleNative();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed });
  });
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

  it('Android에서는 호출하지 않고 NoIdToken(방어적 early return)을 반환한다', async () => {
    setPlatform('android');
    const result = await signInWithAppleNative();
    expect(mockSignInAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: false, token: AuthErrorToken.NoIdToken });
  });
});
