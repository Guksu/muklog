// src/features/room/logName.ts
// 로그 이름 정규화/검증/폴백 유틸 (plan §3.4, 결정2·결정4). 순수 함수(단위 테스트 대상).
//
// ⚠️ 길이 단일 출처(C-LEN): LOG_NAME_MAX_LENGTH=20 ↔ DB rename_room char_length>20 ↔ 입력 maxLength=20.
// ⚠️ 정규화 단일 출처: normalizeLogName(trim→빈 null) ↔ DB nullif(btrim()) (이중 정규화, 동일 규칙).
// ⚠️ 폴백(결정2 B'): name 우선 / 솔로 "{닉}의 기록" / 커플 "{닉} · 짝꿍"(파트너는 "짝꿍" 고정 — profiles RLS self-only).

/** 로그 이름 최대 길이(코드포인트). DB·입력 maxLength 와 단일 출처. */
export const LOG_NAME_MAX_LENGTH = 20;

/** 커플(둘이) 판정 경계 멤버 수. memberCount>=2 → 커플. */
const COUPLE_MIN_MEMBERS = 2;

/** 닉 부재 시 안전 폴백 표기. */
const SOLO_FALLBACK_LABEL = '내 로그';
const COUPLE_FALLBACK_LABEL = '우리 로그';
/** 커플 폴백에서 파트너 고정 표기(파트너 닉 미사용 — profiles RLS self-only). */
const PARTNER_PLACEHOLDER = '짝꿍';

/**
 * 입력 이름을 정규화한다: 앞뒤 공백 trim 후 빈 문자열이면 null(폴백 복귀).
 * @param input 사용자 입력 원문
 * @returns 정규화된 이름(string) 또는 null(빈/공백)
 */
export const normalizeLogName = ({ input }: { input: string }): string | null => {
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * 정규화 후 코드포인트 길이가 최대치를 초과하는지 여부(앱 1차 차단용).
 * String.length(surrogate pair=2) 대신 [...str].length(코드포인트=grapheme 근사)로 산정.
 * @param input 사용자 입력 원문
 * @returns 정규화값이 LOG_NAME_MAX_LENGTH 초과면 true
 */
export const isLogNameTooLong = ({ input }: { input: string }): boolean => {
  const normalized = normalizeLogName({ input });
  if (normalized === null) return false;
  return [...normalized].length > LOG_NAME_MAX_LENGTH;
};

/**
 * 표시명 산출: name이 있으면 name, 없으면 본인 닉네임 기반 폴백(결정2 B').
 *   - name(비어있지 않음) → name
 *   - name 없음 & 솔로 & 닉 있음 → "{닉}의 기록"
 *   - name 없음 & 커플 & 닉 있음 → "{닉} · 짝꿍"
 *   - name 없음 & 닉 없음 → 솔로 "내 로그" / 커플 "우리 로그"
 * @param name 로그 이름(nullable)
 * @param memberCount 멤버 수(1=솔로 / 2=커플)
 * @param selfNickname 본인 닉네임(self-profile, nullable) — 파트너 닉은 사용하지 않음
 * @returns 화면에 표시할 제목 문자열
 */
export const displayLogName = ({
  name,
  memberCount,
  selfNickname,
}: {
  name: string | null;
  memberCount: number;
  selfNickname: string | null;
}): string => {
  if (name != null && name.length > 0) return name;

  const isCouple = memberCount >= COUPLE_MIN_MEMBERS;
  const nick = selfNickname?.trim();

  if (nick == null || nick.length === 0) {
    return isCouple ? COUPLE_FALLBACK_LABEL : SOLO_FALLBACK_LABEL;
  }

  return isCouple ? `${nick} · ${PARTNER_PLACEHOLDER}` : `${nick}의 기록`;
};
