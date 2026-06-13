// src/features/auth/socialSignIn.ts
// 네이티브 소셜 로그인 래퍼(plan ③④). 각 SDK 호출을 판별 가능한 결과로 정규화해
// AuthProvider가 SDK별 예외 형태를 몰라도 되게 한다(경계면 단순화).
//
// 결과 union(NativeSignInResult):
//   { ok: true, token }                                  → signInWithIdToken에 넘길 토큰 확보
//   { ok: false, cancelled: true, token: *Cancelled }    → 사용자 취소(loginError=null)
//   { ok: false, cancelled: false, token: AuthErrorToken } → 실패(loginError=메시지)
//
// 보안: webClientId/iosClientId는 public 클라이언트 ID(시크릿 아님) → env(EXPO_PUBLIC_*)에서 읽음.
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { env } from '@/lib/env';

import { AuthErrorToken } from './errors';

export type NativeSignInResult =
  | { ok: true; token: string }
  | { ok: false; cancelled: boolean; token: AuthErrorToken };

/** 앱 부팅 시 1회. GoogleSignin에 클라이언트 ID를 주입한다(plan ③). */
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
  });
};

// SDK가 던지는 에러 객체에서 code 문자열을 안전하게 추출.
const errorCode = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : null;

/**
 * Google 네이티브 로그인 → idToken. 취소/Play 서비스/일반 실패를 토큰으로 정규화한다.
 * @returns 판별 가능한 NativeSignInResult
 */
export const signInWithGoogleNative = async (): Promise<NativeSignInResult> => {
  try {
    if (Platform.OS === 'android') {
      // Android는 Play 서비스 선검사(없으면 throw → PlayServicesUnavailable).
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return { ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled };
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      return { ok: false, cancelled: false, token: AuthErrorToken.NoIdToken };
    }
    return { ok: true, token: idToken };
  } catch (err) {
    const code = errorCode(err);
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled };
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, cancelled: false, token: AuthErrorToken.PlayServicesUnavailable };
    }
    return { ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed };
  }
};

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
