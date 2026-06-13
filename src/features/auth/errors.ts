// src/features/auth/errors.ts
// 소셜 로그인 에러 토큰(enum-style 상수, 컨벤션) + 사용자 노출 메시지 매핑.
// 취소 토큰(*Cancelled)은 메시지 매핑이 없다 → loginError=null(인라인 메시지 미표시, plan E1).
// 매핑된 토큰만 loginError 문자열로 노출된다.

/** 소셜 로그인 흐름에서 식별하는 에러 종류(도메인 식별 문자열, plan §3.3). */
export const AuthErrorToken = {
  GoogleCancelled: 'GoogleCancelled', // 취소 → loginError=null(메시지 X)
  AppleCancelled: 'AppleCancelled', // 취소 → loginError=null
  NetworkFailed: 'NetworkFailed',
  TokenExchangeFailed: 'TokenExchangeFailed', // signInWithIdToken 실패
  NoIdToken: 'NoIdToken', // SDK가 idToken을 반환 안 함
  PlayServicesUnavailable: 'PlayServicesUnavailable', // Google(Android) Play 서비스 없음
} as const;

export type AuthErrorToken = (typeof AuthErrorToken)[keyof typeof AuthErrorToken];

/**
 * 토큰 → 사용자 노출 메시지. 취소 토큰은 의도적으로 매핑하지 않는다(undefined → loginError=null).
 * 정의되지 않은 토큰/예기치 못한 에러는 TokenExchangeFailed 메시지로 일반화한다(messageForAuthError).
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [AuthErrorToken.NetworkFailed]: '네트워크 연결을 확인해 주세요.',
  [AuthErrorToken.TokenExchangeFailed]: '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
  [AuthErrorToken.NoIdToken]: '로그인 정보를 받지 못했어요. 다시 시도해 주세요.',
  [AuthErrorToken.PlayServicesUnavailable]: 'Google Play 서비스를 사용할 수 없어요.',
};

/**
 * 에러 토큰을 인라인 메시지로 변환한다.
 * - 취소 토큰(*Cancelled): null(메시지 미표시, plan E1).
 * - 매핑된 토큰: 해당 메시지.
 * - 미매핑/알 수 없는 토큰: TokenExchangeFailed 메시지(일반화 — 빈 화면 방지).
 * @param token 에러 토큰
 * @returns 인라인 메시지 또는 null(취소)
 */
export const messageForAuthError = ({ token }: { token: AuthErrorToken }): string | null => {
  if (token === AuthErrorToken.GoogleCancelled || token === AuthErrorToken.AppleCancelled) {
    return null;
  }
  return AUTH_ERROR_MESSAGES[token] ?? AUTH_ERROR_MESSAGES[AuthErrorToken.TokenExchangeFailed];
};
