// src/features/wishlist/errors.ts
// 위시 트리거/검증/인증 에러 토큰 → 사용자용 한국어 메시지 매핑 (plan §4.3 TC-2·TC-4 실패 경로).
//
// 생산자: 마이그레이션 enforce_wishlist_fields() 트리거가 `raise exception 'PLACE_NAME_REQUIRED'` → error.message에 토큰.
//   + useAddWishlist의 앱단 인증 가드가 NOT_AUTHENTICATED를 throw.
// 소비자: useAddWishlist / useRemoveWishlist 가 이 유틸로 error 상태 메시지를 만든다.
// ⚠️ 토큰 문자열은 SQL(트리거 raise) ↔ 이 매핑이 단일 출처여야 한다(추가/변경 시 동기화).

/** 위시 트리거/검증/인증이 발생시키는 에러 토큰(enum-style 단일 출처). */
export const WishlistErrorToken = {
  PlaceNameRequired: 'PLACE_NAME_REQUIRED', // 트리거: place_name 공백/빈 값
  NotAuthenticated: 'NOT_AUTHENTICATED', // 클라: 로그인 세션 없음(추가 시 added_by 확보 실패)
} as const;
export type WishlistErrorToken = (typeof WishlistErrorToken)[keyof typeof WishlistErrorToken];

/** 에러 토큰 → 한국어 메시지. */
export const WISHLIST_ERROR_MESSAGES: Record<string, string> = {
  [WishlistErrorToken.PlaceNameRequired]: '장소 이름이 필요해요.',
  [WishlistErrorToken.NotAuthenticated]: '로그인이 필요해요. 다시 로그인해 주세요.',
};

/** 토큰 미일치(네트워크/RLS/그 외) 시 기본 메시지. */
export const DEFAULT_WISHLIST_ERROR_MESSAGE = '위시리스트 처리에 실패했어요. 다시 시도해 주세요.';

/**
 * 알 수 없는 에러 값에서 메시지 문자열을 안전하게 추출한다.
 * @param error 임의 타입의 에러 값(Error | string | { message } | 기타)
 * @returns 추출된 메시지 문자열(없으면 빈 문자열)
 */
const extractMessage = ({ error }: { error: unknown }): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
};

/**
 * 에러 객체에서 위시 토큰을 찾아 한국어 메시지로 매핑한다.
 * 1) 메시지 == 토큰 정확 일치  2) 메시지에 토큰 포함  3) 기본 메시지.
 * @param error 트리거/검증/네트워크에서 발생한 에러 값
 * @returns 사용자에게 보여줄 한국어 메시지
 */
export const mapWishlistError = ({ error }: { error: unknown }): string => {
  const message = extractMessage({ error });

  if (message in WISHLIST_ERROR_MESSAGES) return WISHLIST_ERROR_MESSAGES[message];

  for (const token of Object.keys(WISHLIST_ERROR_MESSAGES)) {
    if (message.includes(token)) return WISHLIST_ERROR_MESSAGES[token];
  }

  return DEFAULT_WISHLIST_ERROR_MESSAGE;
};
