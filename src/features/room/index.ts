// src/features/room — 공개 표면
// 멀티 로그 전환(multi-log-home): MembershipProvider/useMembership(단일 방) → MyLogsProvider/useMyLogs(다중 로그)로 대체.
export { MyLogsProvider, useMyLogsContext } from './MyLogsProvider';
export { useMyLogs, type MyLog, type MyLogsState } from './useMyLogs';
export { useRoom, type RoomDetail, type RoomDetailState } from './useRoom';
export { useCreateRoom, type CreateRoomResult } from './useCreateRoom';
export { useJoinRoom, type JoinRoomResult } from './useJoinRoom';
export { useLeaveRoom, type LeaveRoomResult } from './useLeaveRoom';
export { useRenameRoom, type RenameRoomResult } from './useRenameRoom';
export {
  LOG_NAME_MAX_LENGTH,
  normalizeLogName,
  isLogNameTooLong,
  displayLogName,
} from './logName';
export { mapRoomError, ROOM_ERROR_MESSAGES, DEFAULT_ROOM_ERROR_MESSAGE } from './errors';
export { ROOM_MODES, ROOM_CAPACITY, type RoomMode } from './modes';
export {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  normalizeInviteCodeInput,
  isInviteCodeComplete,
} from './code';
// 로그 이름(log-name) 프리젠테이션 컴포넌트 — developer가 데이터/배선을 붙인다.
export { LogNameSheet, type LogNameSheetProps } from './components/LogNameSheet';
export { LogTitleButton, type LogTitleButtonProps } from './components/LogTitleButton';
