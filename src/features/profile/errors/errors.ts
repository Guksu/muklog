// src/features/profile/errors.ts
// 프로필 에러 토큰 → 사용자용 한국어 메시지 매핑 (plan §3.6, T3 / P6).
//
// 생산자: validateNickname(empty/too-long) / changeAvatar(권한·업로드 실패) → 토큰 문자열.
// 소비자: useUpdateProfile(error 상태) / ProfileScreen(인라인 메시지).
// ⚠️ 토큰 문자열은 유틸 ↔ 훅 ↔ 화면 단일 출처. invite-room의 mapRoomError와 별도 모듈로 둔다(plan §3.6).

/** 프로필 도메인 에러 토큰(enum-style 상수). */
export const ProfileErrorToken = {
  NicknameEmpty: 'NICKNAME_EMPTY',
  NicknameTooLong: 'NICKNAME_TOO_LONG',
  PermissionDenied: 'PERMISSION_DENIED',
  AvatarUploadFailed: 'AVATAR_UPLOAD_FAILED',
  // 회원 탈퇴(delete-account Edge Function) 경로 토큰 — useDeleteAccount / 함수 응답 body 에서 유입.
  Unauthenticated: 'UNAUTHENTICATED', // 401(세션 만료·미인증)
  DeleteFailed: 'DELETE_FAILED', // 500(deleteUser 실패, 재시도 가능·세션 유지)
  DeleteAccountIncomplete: 'DELETE_ACCOUNT_INCOMPLETE', // deleted:true 아님(미완료 삭제, 재시도)
} as const;

export type ProfileErrorToken = (typeof ProfileErrorToken)[keyof typeof ProfileErrorToken];

/** 에러 토큰 → 한국어 메시지. */
export const PROFILE_ERROR_MESSAGES: Record<ProfileErrorToken, string> = {
  [ProfileErrorToken.NicknameEmpty]: '닉네임을 입력해 주세요.',
  [ProfileErrorToken.NicknameTooLong]: '닉네임은 20자까지 입력할 수 있어요.',
  [ProfileErrorToken.PermissionDenied]: '사진 접근 권한이 필요해요. 설정에서 허용해 주세요.',
  [ProfileErrorToken.AvatarUploadFailed]: '이미지 업로드에 실패했어요. 다시 시도해 주세요.',
  [ProfileErrorToken.Unauthenticated]: '로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.',
  [ProfileErrorToken.DeleteFailed]: '계정 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.',
  [ProfileErrorToken.DeleteAccountIncomplete]: '계정 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.',
};

/** 토큰 미일치(네트워크/그 외) 시 기본 메시지. */
export const DEFAULT_PROFILE_ERROR_MESSAGE = '처리에 실패했어요. 다시 시도해 주세요.';

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
 * 에러 값에서 토큰을 찾아 한국어 메시지로 매핑한다.
 * 1) 메시지 == 토큰 정확 일치  2) 메시지에 토큰 포함  3) 기본 메시지.
 * @param error 검증/업로드/권한에서 발생한 에러 값(또는 토큰 문자열)
 * @returns 사용자에게 보여줄 한국어 메시지
 */
export const mapProfileError = ({ error }: { error: unknown }): string => {
  const message = extractMessage({ error });

  // 1) 정확 일치
  if (message in PROFILE_ERROR_MESSAGES) {
    return PROFILE_ERROR_MESSAGES[message as ProfileErrorToken];
  }

  // 2) 포함 매칭 (토큰이 다른 텍스트로 감싸인 경우 대비)
  for (const token of Object.keys(PROFILE_ERROR_MESSAGES) as ProfileErrorToken[]) {
    if (message.includes(token)) return PROFILE_ERROR_MESSAGES[token];
  }

  // 3) 기본
  return DEFAULT_PROFILE_ERROR_MESSAGE;
};
