// src/features/profile — 공개 표면 (plan §5 T12)
export { useProfile, type Profile, type ProfileState } from './useProfile';
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
