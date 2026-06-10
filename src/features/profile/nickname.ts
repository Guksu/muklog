// src/features/profile/nickname.ts
// 닉네임 검증 유틸 + 길이 상수 (plan §3.5, T2 / P5).
//
// 생산자: 이 유틸이 trim·길이 판정 결과(ok/empty/too-long)를 단일 출처로 제공.
// 소비자: ProfileScreen(저장 버튼 활성·인라인 메시지), useUpdateProfile.saveNickname(검증→update).
// ⚠️ 길이는 JS String.length 기준(MVP 단순화 — 그래핌/이모지 별도 처리 안 함, plan §6).

export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameValidation =
  | { ok: true; value: string } // trim된 정규값
  | { ok: false; reason: 'empty' | 'too-long' };

/**
 * 닉네임 입력값을 trim한 뒤 길이를 검증한다.
 * @param raw 사용자가 입력한 원본 문자열
 * @returns ok+정규값(trim) 또는 ok:false+사유('empty'|'too-long')
 */
export const validateNickname = ({ raw }: { raw: string }): NicknameValidation => {
  const value = raw.trim();
  if (value.length < NICKNAME_MIN_LENGTH) return { ok: false, reason: 'empty' };
  if (value.length > NICKNAME_MAX_LENGTH) return { ok: false, reason: 'too-long' };
  return { ok: true, value };
};
