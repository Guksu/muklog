// src/features/room — 공개 표면
// 멀티 로그 전환(multi-log-home): MembershipProvider/useMembership(단일 방) → MyLogsProvider/useMyLogs(다중 로그)로 대체.
export { MyLogsProvider, useMyLogsContext } from './MyLogsProvider';
export { useMyLogs, type MyLog, type MyLogsState } from './useMyLogs';
export { useCreateRoom, type CreateRoomResult } from './useCreateRoom';
export { useJoinRoom, type JoinRoomResult } from './useJoinRoom';
export { useLeaveRoom, type LeaveRoomResult } from './useLeaveRoom';
export { mapRoomError, ROOM_ERROR_MESSAGES, DEFAULT_ROOM_ERROR_MESSAGE } from './errors';
export { ROOM_MODES, ROOM_CAPACITY, type RoomMode } from './modes';
export {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  normalizeInviteCodeInput,
  isInviteCodeComplete,
} from './code';
