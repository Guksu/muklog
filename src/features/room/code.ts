// src/features/room/code.ts
// 초대코드 charset/길이 + 클라 입력 정규화 (plan §3.4 / §3.6 / C6).
//
// ⚠️ INVITE_CODE_CHARSET 은 create_room RPC(SQL)의 charset과 반드시 동일해야 한다(C6 교차검증 포인트).
//    A-Z 중 O,I 제외(24자) + 0-9 중 0,1 제외(8자) = 32자.
// 코드 "생성"은 서버(RPC) 전담 — 클라는 입력 화면의 정규화/검증만 담당(클라 코드생성 유틸 없음).

export const INVITE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

const allowedChars = new Set(INVITE_CODE_CHARSET.split(''));

/**
 * 입력값 정규화: 대문자 변환 → charset 외 문자(공백·혼동문자 0/O/1/I 포함) 제거 → 최대 6자 컷.
 * autoCapitalize="characters" + autoCorrect={false} 와 함께 사용.
 * @param raw 사용자가 입력한 원본 문자열
 * @returns 정규화된 초대코드(최대 6자)
 */
export const normalizeInviteCodeInput = ({ raw }: { raw: string }): string =>
  raw
    .toUpperCase()
    .split('')
    .filter((ch) => allowedChars.has(ch))
    .slice(0, INVITE_CODE_LENGTH)
    .join('');

/**
 * 6자리 완성 여부(입장 버튼 활성화 조건).
 * @param code 정규화된 초대코드
 * @returns 길이가 INVITE_CODE_LENGTH면 true
 */
export const isInviteCodeComplete = ({ code }: { code: string }): boolean =>
  code.length === INVITE_CODE_LENGTH;
