// src/features/room/logName.ts
// 로그 이름 정규화/검증/폴백 유틸 (plan §3.4, 결정2·결정4). 순수 함수(단위 테스트 대상).
//
// ⚠️ 길이 단일 출처(C-LEN): LOG_NAME_MAX_LENGTH=20 ↔ DB rename_room char_length>20 ↔ 입력 maxLength=20.
// ⚠️ 정규화 단일 출처: normalizeLogName(trim→빈 null) ↔ DB nullif(btrim()) (이중 정규화, 동일 규칙).
// ⚠️ 폴백(결정2 B'): name 우선 / 솔로 "{닉}의 기록" / 커플 "{닉} · 짝꿍"(파트너는 "짝꿍" 고정 — profiles RLS self-only).
//
// S5b(members-display): 멤버 실명 노출 후 폴백을 킷 mkLogTitle(mk-ui:272) 규칙으로 확장 →
//   logTitleFromMembers(name / 1명 "{나}의 기록" / 2명 "A · B" / 3명+ "A 외 N명"). 멤버 미로드 시 displayLogName로 회귀.

import { defaultNickname } from '@/features/profile/defaultNickname';

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

/**
 * 로그 멤버 1인(카멜) — RPC list_room_members 응답 매핑 후 shape (plan §3.2).
 *   ⚠️ 계약 단일 출처: developer의 useRoomMembers가 반환하는 RoomMember 와 동일 shape이어야 한다.
 *   developer는 useRoomMembers.ts에서 이 타입을 re-export 하거나 동일 정의로 통일한다(경계 계약).
 */
export type RoomMember = {
  /** 멤버 uuid(=profiles.id, room_members.user_id). "나" 판정 키. */
  userId: string;
  /** 멤버 닉네임. null이면 defaultNickname({ userId }) 폴백. */
  nickname: string | null;
  /** 아바타 공개 URL(public 버킷, pass-through, plan §3.4). null이면 결정적 디폴트. */
  avatarUrl: string | null;
};

/** 멤버 표시 닉 — nickname 우선, null이면 결정적 defaultNickname(userId). 화면 간 신원 일관(#3). */
const memberDisplayName = ({ member }: { member: RoomMember }): string =>
  member.nickname != null && member.nickname.trim().length > 0
    ? member.nickname
    : defaultNickname({ userId: member.userId });

/**
 * 멤버 목록 기반 로그 제목 파생(킷 mkLogTitle mk-ui:272). name 있으면 name 우선,
 * 없으면 멤버 수 규칙으로 파생. 멤버 미로드(빈 배열)면 displayLogName 폴백으로 회귀(회귀 0).
 *   - name(비어있지 않음) → name (현행 rooms.name 유지)
 *   - members 0 → displayLogName 폴백(selfNickname 기반, meId 멤버 수 미상 → 솔로 취급)
 *   - members 1 → "{나}의 기록"(나=meId 매칭 멤버 닉 or selfNickname)
 *   - members 2 → "A · B"(joined_at asc 순서 그대로)
 *   - members 3+ → "A 외 (N-1)명"
 * @param name 로그 이름(nullable)
 * @param members 멤버 목록(joined_at asc). 빈 배열=미로드
 * @param meId 현재 사용자 uuid — 1명일 때 "나" 판정
 * @param selfNickname 본인 닉(폴백용, nullable)
 * @returns 화면에 표시할 제목 문자열
 */
export const logTitleFromMembers = ({
  name,
  members,
  meId,
  selfNickname,
}: {
  name: string | null;
  members: RoomMember[];
  meId: string;
  selfNickname: string | null;
}): string => {
  if (name != null && name.length > 0) return name;

  // 멤버 미로드 → 기존 displayLogName 폴백(회귀 0, 솔로 취급).
  if (members.length === 0) {
    return displayLogName({ name, memberCount: 1, selfNickname });
  }

  if (members.length === 1) {
    const me = members.find((m) => m.userId === meId);
    const selfLabel =
      selfNickname != null && selfNickname.trim().length > 0
        ? selfNickname
        : me
          ? memberDisplayName({ member: me })
          : defaultNickname({ userId: meId });
    return `${selfLabel}의 기록`;
  }

  if (members.length === 2) {
    return `${memberDisplayName({ member: members[0] })} · ${memberDisplayName({ member: members[1] })}`;
  }

  return `${memberDisplayName({ member: members[0] })} 외 ${members.length - 1}명`;
};
