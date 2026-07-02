// src/features/room — 공개 표면
// 멀티 로그 전환(multi-log-home): MembershipProvider/useMembership(단일 방) → MyLogsProvider/useMyLogs(다중 로그)로 대체.
export { MyLogsProvider, useMyLogsContext } from './MyLogsProvider';
export { useMyLogs, type MyLog, type MyLogsState } from './useMyLogs';
export { useLogPreviewUrls } from './useLogPreviewUrls';
export { useRoom, type RoomDetail, type RoomDetailState } from './useRoom';
// 로그 멤버 목록(members-display S5b) — list_room_members DEFINER RPC 소비. RoomMember 는 logName.ts 정의 재사용(중복 정의 금지).
export { useRoomMembers, type RoomMembersState } from './useRoomMembers';
export { useCreateRoom, type CreateRoomResult } from './useCreateRoom';
export { useJoinRoom, type JoinRoomResult } from './useJoinRoom';
export { useLeaveRoom, type LeaveRoomResult } from './useLeaveRoom';
export {
  useCancelRoomDeletion,
  type CancelRoomDeletionResult,
} from './useCancelRoomDeletion';
export { deletionCountdownLabel } from './deletionCountdownLabel';
export { useRenameRoom, type RenameRoomResult } from './useRenameRoom';
export {
  LOG_NAME_MAX_LENGTH,
  normalizeLogName,
  isLogNameTooLong,
  displayLogName,
  logTitleFromMembers,
  type RoomMember,
} from './logName';
export { mapRoomError, ROOM_ERROR_MESSAGES, DEFAULT_ROOM_ERROR_MESSAGE } from './errors';
export { ROOM_MODES, ROOM_CAPACITY, type RoomMode } from './modes';
export {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  normalizeInviteCodeInput,
  isInviteCodeComplete,
} from './code';
// 로그 이름(log-name) 진입 버튼 — 편집 표현부는 공용 RenameDialog(@/components)로 통일(기존 편집 시트 폐기, rename-dialog D-4).
export { LogTitleButton, type LogTitleButtonProps } from './components/LogTitleButton';
// 참여자 블록(members-display S5b, 킷 mk-log:79-103) — presentational. 데이터·RPC·배선은 developer 2단계.
export { ParticipantBlock, type ParticipantBlockProps } from './components/ParticipantBlock';
// 로그 나가기/예약삭제 UI(room-lifecycle, 킷 비종속·MuklogDetail 패턴 재사용) — presentational. RPC·배선은 developer.
export { LeaveLogSheets, type LeaveLogSheetsProps } from './LeaveLogSheets';
export {
  ScheduledDeletionBanner,
  type ScheduledDeletionBannerProps,
} from './ScheduledDeletionBanner';
