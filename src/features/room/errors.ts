// src/features/room/errors.ts
// RPC 에러 토큰 → 사용자용 한국어 메시지 매핑 (plan §3.7, C2).
//
// 생산자: create_room/join_room/get_room RPC가 `raise exception '<TOKEN>'` → Supabase JS error.message에 토큰.
// 소비자: useCreateRoom/useJoinRoom/useRoom, PlusHeaderButton/JoinLogScreen이 이 유틸로 사용자 메시지를 만든다.
// ⚠️ 토큰 문자열은 RPC(SQL) ↔ 이 매핑이 단일 출처여야 한다. 토큰 추가/변경 시 양쪽 동기화.

/** RPC가 발생시키는 에러 토큰 → 한국어 메시지. */
export const ROOM_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: '초대코드를 다시 확인해 주세요.',
  ROOM_FULL: '이미 2명이 모두 입장한 방이에요.',
  ALREADY_IN_ROOM: '이미 참여 중인 방이 있어요.',
  CODE_GENERATION_FAILED: '코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.',
  NOT_AUTHENTICATED: '세션이 만료됐어요. 앱을 다시 시작해 주세요.',
  // room-modes 신규 토큰 (plan §3.7). create_room/join_room RPC가 raise.
  INVALID_MODE: '방 모드 선택이 올바르지 않아요.',
  SOLO_ROOM_NOT_JOINABLE: '혼자 쓰는 방에는 입장할 수 없어요.',
  // log-invite 신규 토큰 (plan §5.5, C2). get_room(p_room_id) RPC가 raise.
  //   ⚠️ SQL(raise) ↔ 이 매핑이 단일 출처 — 20260611120000_log_invite.sql 과 동기화 유지.
  NOT_A_MEMBER: '이 로그에 접근할 권한이 없어요.',
  ROOM_NOT_FOUND: '로그를 찾을 수 없어요.',
  // log-name 신규 토큰 (plan §3.4, C2). rename_room(p_room_id, p_name) RPC가 raise.
  //   ⚠️ SQL(raise) ↔ 이 매핑이 단일 출처 — 20260615120000_log_name.sql 과 동기화 유지.
  NAME_TOO_LONG: '이름은 20자까지 쓸 수 있어요.',
};

/** 토큰 미일치(네트워크/그 외) 시 기본 메시지. */
export const DEFAULT_ROOM_ERROR_MESSAGE = '연결에 실패했어요. 다시 시도해 주세요.';

/**
 * 알 수 없는 에러 값에서 메시지 문자열을 안전하게 추출한다.
 * @param error 임의 타입의 에러 값(Error | string | { message } | 기타)
 * @returns 추출된 메시지 문자열(없으면 빈 문자열)
 */
const extractMessage = ({ error }: { error: unknown }): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
};

/**
 * 에러 객체에서 토큰을 찾아 한국어 메시지로 매핑.
 * 1) 메시지 == 토큰 정확 일치 우선  2) 메시지에 토큰 포함  3) 기본 메시지.
 * @param error RPC/네트워크에서 발생한 에러 값
 * @returns 사용자에게 보여줄 한국어 메시지
 */
export const mapRoomError = ({ error }: { error: unknown }): string => {
  const message = extractMessage({ error });

  // 1) 정확 일치
  if (message in ROOM_ERROR_MESSAGES) return ROOM_ERROR_MESSAGES[message];

  // 2) 포함 매칭 (Postgres가 토큰을 다른 텍스트로 감쌀 경우 대비)
  for (const token of Object.keys(ROOM_ERROR_MESSAGES)) {
    if (message.includes(token)) return ROOM_ERROR_MESSAGES[token];
  }

  // 3) 기본
  return DEFAULT_ROOM_ERROR_MESSAGE;
};
