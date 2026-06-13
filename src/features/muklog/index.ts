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
} from './types';
export { muklogCategoriesInUse, filterMuklogsByCategory } from './filterByCategory';
