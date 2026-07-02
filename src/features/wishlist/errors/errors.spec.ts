// src/features/wishlist/errors.spec.ts
// 위시 에러 토큰 → 한국어 메시지 매핑 명세 (plan §4.3 TC-2 실패, TC-4 실패).
//   정확 일치 / 메시지 내 토큰 포함 / 미일치 기본값 / 임의 에러 값(Error|string|object) 추출.
import {
  mapWishlistError,
  WishlistErrorToken,
  WISHLIST_ERROR_MESSAGES,
  DEFAULT_WISHLIST_ERROR_MESSAGE,
} from './errors';

describe('mapWishlistError', () => {
  it('토큰과 정확히 일치하는 메시지(Error.message)를 한국어로 매핑한다', () => {
    expect(mapWishlistError({ error: new Error(WishlistErrorToken.PlaceNameRequired) })).toBe(
      WISHLIST_ERROR_MESSAGES[WishlistErrorToken.PlaceNameRequired],
    );
  });

  it('메시지 안에 토큰이 포함돼 있으면(예: Postgres 래핑) 그 토큰으로 매핑한다', () => {
    const wrapped = new Error('new row violates ... PLACE_NAME_REQUIRED (P0001)');
    expect(mapWishlistError({ error: wrapped })).toBe(
      WISHLIST_ERROR_MESSAGES[WishlistErrorToken.PlaceNameRequired],
    );
  });

  it('NOT_AUTHENTICATED 토큰을 로그인 안내 메시지로 매핑한다', () => {
    expect(mapWishlistError({ error: new Error(WishlistErrorToken.NotAuthenticated) })).toBe(
      WISHLIST_ERROR_MESSAGES[WishlistErrorToken.NotAuthenticated],
    );
  });

  it('알 수 없는 에러는 기본 메시지로 폴백한다', () => {
    expect(mapWishlistError({ error: new Error('boom-unknown') })).toBe(
      DEFAULT_WISHLIST_ERROR_MESSAGE,
    );
  });

  it('문자열/객체/널 형태의 에러 값에서도 메시지를 안전하게 추출한다', () => {
    expect(mapWishlistError({ error: WishlistErrorToken.NotAuthenticated })).toBe(
      WISHLIST_ERROR_MESSAGES[WishlistErrorToken.NotAuthenticated],
    );
    expect(mapWishlistError({ error: { message: WishlistErrorToken.PlaceNameRequired } })).toBe(
      WISHLIST_ERROR_MESSAGES[WishlistErrorToken.PlaceNameRequired],
    );
    expect(mapWishlistError({ error: null })).toBe(DEFAULT_WISHLIST_ERROR_MESSAGE);
  });
});
