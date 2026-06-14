// src/features/auth/socialSignIn.ts
// 네이티브 소셜 로그인 래퍼. Apple은 네이티브(expo-apple-authentication) idToken을 그대로 쓴다.
//   (Google은 네이티브 idToken의 nonce 한계로 OAuth 웹 플로우로 분리 — oauthSignIn.ts 참고.)
//
// 결과 union(NativeSignInResult):
//   { ok: true, token }                                  → signInWithIdToken에 넘길 토큰 확보
//   { ok: false, cancelled: true, token: *Cancelled }    → 사용자 취소(loginError=null)
//   { ok: false, cancelled: false, token: AuthErrorToken } → 실패(loginError=메시지)
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { AuthErrorToken } from './errors';

export type NativeSignInResult =
  | { ok: true; token: string }
  | { ok: false; cancelled: boolean; token: AuthErrorToken };

// SDK가 던지는 에러 객체에서 code 문자열을 안전하게 추출.
const errorCode = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;

// expo-apple-authentication 취소 에러 코드.
const APPLE_CANCELED_CODE = 'ERR_REQUEST_CANCELED' as const;

/**
 * Apple 네이티브 로그인(iOS 전용) → identityToken. Android는 호출하지 않고 방어적 early return(plan E5).
 * @returns 판별 가능한 NativeSignInResult
 */
export const signInWithAppleNative = async (): Promise<NativeSignInResult> => {
  if (Platform.OS !== 'ios') {
    return { ok: false, cancelled: false, token: AuthErrorToken.NoIdToken };
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { ok: false, cancelled: false, token: AuthErrorToken.NoIdToken };
    }
    return { ok: true, token: credential.identityToken };
  } catch (err) {
    if (errorCode(err) === APPLE_CANCELED_CODE) {
      return { ok: false, cancelled: true, token: AuthErrorToken.AppleCancelled };
    }
    return { ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed };
  }
};
