// src/features/profile — 공개 표면 (plan §5 T12)
export { useProfile, type Profile, type ProfileState } from './useProfile';
export { ProfileProvider, useProfileContext } from './ProfileProvider';
export { defaultNickname, ANIMAL_NAMES } from './defaultNickname';
export { useUpdateProfile } from './useUpdateProfile';
export { useDeleteAccount } from './useDeleteAccount';
export { DeleteAccountSheet, type DeleteAccountSheetProps } from './DeleteAccountSheet';
export { defaultAvatar, AVATAR_EMOJIS, AVATAR_COLORS } from './avatarDefault';
export { computeProfileStats, type ProfileStats } from './profileStats';
export {
  validateNickname,
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  type NicknameValidation,
} from './nickname';
export { processAvatarImage, AVATAR_SIZE, AVATAR_COMPRESS, type ProcessedImage } from './image';
export { uploadAvatarFromUri } from './uploadAvatarFromUri';
export {
  PENDING_PICK_KEY,
  PendingPickKind,
  savePendingPick,
  loadPendingPick,
  clearPendingPick,
  type PendingPickContext,
} from './pendingPick';
export { useRecoverPendingPick, PICK_RECOVERED_TOAST } from './useRecoverPendingPick';
export {
  mapProfileError,
  ProfileErrorToken,
  PROFILE_ERROR_MESSAGES,
  DEFAULT_PROFILE_ERROR_MESSAGE,
} from './errors';
export {
  AVATARS_BUCKET,
  buildAvatarPath,
  parseAvatarPath,
  createAvatarFileId,
} from './avatarPath';
