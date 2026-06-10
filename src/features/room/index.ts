// src/features/room — 공개 표면
export { MembershipProvider, useMembershipContext } from './MembershipProvider';
export { useMembership, type MembershipState } from './useMembership';
export { useCreateRoom, type CreateRoomResult } from './useCreateRoom';
export { useJoinRoom, type JoinRoomResult } from './useJoinRoom';
export { mapRoomError, ROOM_ERROR_MESSAGES, DEFAULT_ROOM_ERROR_MESSAGE } from './errors';
export { ROOM_MODES, ROOM_CAPACITY, type RoomMode } from './modes';
export {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  normalizeInviteCodeInput,
  isInviteCodeComplete,
} from './code';
