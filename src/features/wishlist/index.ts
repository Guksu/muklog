// src/features/wishlist — 공개 표면 (plan §4)
//   조회/추가/삭제 훅 + 매핑 유틸 + 에러 매핑 + 타입 + presentational WishlistView(ui-publisher).
export { WishlistView, type WishlistViewProps } from './WishlistView';
export { useWishlist } from './useWishlist';
export { useAddWishlist, type AddWishlistResult } from './useAddWishlist';
export { useRemoveWishlist } from './useRemoveWishlist';
export { toWishlistItem, type WishlistRow } from './toWishlistItem';
export { toWishlistRow } from './toWishlistRow';
export {
  mapWishlistError,
  WISHLIST_ERROR_MESSAGES,
  DEFAULT_WISHLIST_ERROR_MESSAGE,
  WishlistErrorToken,
} from './errors';
export {
  type WishlistItem,
  type WishlistState,
  type AddWishlistInput,
  type WishlistInsertRow,
} from './types';
