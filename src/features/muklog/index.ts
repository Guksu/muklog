// src/features/muklog — 공개 표면 (plan §5 T12)
//   조회/입력 훅 + 카드/리스트/시트 + 카테고리/타입/에러 매핑.
export { useMuklogs } from './useMuklogs';
export {
  useMuklog,
  type MuklogDetail,
  type MuklogDetailPhoto,
  type MuklogDetailState,
} from './useMuklog';
export { useCreateMuklog, type CreateMuklogResult } from './useCreateMuklog';
export { useUpdateMuklog, type UpdateMuklogResult } from './useUpdateMuklog';
export { useDeleteMuklog } from './useDeleteMuklog';
export { planPhotoReconcile, type PhotoReconcilePlan } from './reconcileMuklogPhotos';
export { useMuklogPhotoPicker, MUKLOG_PHOTO_MAX } from './useMuklogPhotoPicker';
export { uploadMuklogPhotos, type UploadMuklogPhotosResult } from './uploadMuklogPhotos';
export { MUKLOG_PHOTOS_BUCKET, buildMuklogPhotoPath, createPhotoFileId } from './photoPath';
export { processMuklogPhoto, PHOTO_MAX_EDGE, PHOTO_COMPRESS } from './photoImage';
export { MuklogCard, type MuklogCardProps } from './MuklogCard';
export { MuklogList, type MuklogListProps } from './MuklogList';
export {
  MuklogEntrySheet,
  type MuklogEntrySheetProps,
  type MuklogEditSubmitInput,
} from './MuklogEntrySheet';
export { PhotoPickerGrid, type PhotoPickerGridProps } from './PhotoPickerGrid';
// 장소검색(muklog-place) presentational — 킷 mk-log PlaceSearch/placeChosen 번역.
export { PlaceResultRow, type PlaceResultRowProps } from './PlaceResultRow';
export {
  PlaceSearchField,
  type PlaceSearchFieldProps,
  type PlaceSearchStatus,
} from './PlaceSearchField';
export { PlaceSelectedSummary, type PlaceSelectedSummaryProps } from './PlaceSelectedSummary';
// 장소검색(muklog-place) data 계층 — 검색 훅 + invoke 래퍼 + Kakao 매핑 유틸(developer).
//   PlaceSearchStatus 타입은 PlaceSearchField가 이미 export(동일 정의) — 중복 방지 위해 여기선 미재노출.
export {
  usePlaceSearch,
  PLACE_SEARCH_DEBOUNCE_MS,
  PLACE_SEARCH_MIN_LENGTH,
  type UsePlaceSearchResult,
} from './usePlaceSearch';
export { usePlaceSelection, type UsePlaceSelectionResult } from './usePlaceSelection';
export { searchPlaces } from './searchPlaces';
export { mapKakaoCategory, deriveArea, placeFieldsFromItem } from './kakaoCategory';
export {
  MUKLOG_CATEGORIES,
  MUKLOG_CATEGORY_KEYS,
  categoryLabel,
  categoryEmoji,
  type MuklogCategoryKey,
} from './categories';
export {
  mapMuklogError,
  MUKLOG_ERROR_MESSAGES,
  DEFAULT_MUKLOG_ERROR_MESSAGE,
  MuklogErrorToken,
} from './errors';
export {
  type Muklog,
  type MuklogsState,
  type CreateMuklogInput,
  type PickedPhoto,
  type ExistingPhoto,
  type EditorPhoto,
  type MuklogEditInitial,
  type UpdateMuklogInput,
  type PlaceSearchItem,
  type PlaceFields,
  type PlaceSelection,
} from './types';
export { muklogCategoriesInUse, filterMuklogsByCategory } from './filterByCategory';
