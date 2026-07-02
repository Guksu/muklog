// src/features/muklog/author.ts
// 작성자 파생(데이터 레벨) — created_by NULL(탈퇴자 익명화) 안전 처리 (plan §5, AC6).
//   회원 탈퇴 마이그레이션(20260621120000)으로 muklogs.created_by 가 nullable(ON DELETE SET NULL)이 되어
//   탈퇴자가 쓴 기록은 created_by = NULL 로 익명화된다. 작성자 라벨/아바타 파생이 NULL 에 graceful 하도록 단일 출처화.
//
// 경계: 라벨 "문자열"(비주얼 카피)은 ui-publisher 와 공유하되, 데이터 폴백(AuthorKind 판별 + 익명 아바타 키)은 여기.
//   ⚠️ NULL == NULL 함정: createdBy/meId 둘 다 NULL 일 때 `createdBy === meId` 는 JS 에서 true(null===null) →
//      익명 작성자가 "내가 기록"으로 오표시될 수 있다. deriveAuthorKind 는 NULL/빈 createdBy 를 먼저 Deleted 로 가른다.
//
// S5b(members-display): resolveAuthor — 멤버 목록(useRoomMembers)에서 createdBy 를 조회해 실 닉/아바타로 매핑.
//   3명+ 로그도 me/partner 이분법 없이 createdBy 로 직접 매핑(정확). 미매칭(미로드·나간 작성자)은 me/partner 폴백 카피(회귀 0).

import { defaultNickname } from '@/features/profile/defaultNickname';
// 타입 단일 출처는 logName.ts(계약). 배럴(@/features/room) 대신 정의 파일 직접 import로 supabase 전이 로드 회피(type-only).
import { type RoomMember } from '@/features/room/logName';

/** 작성자 판별(라벨/아바타 분기 단일 출처). 시각 카피는 ui-publisher 가 이 kind 로 매핑. */
export const AuthorKind = {
  Me: 'me',
  Partner: 'partner',
  Deleted: 'deleted',
} as const;
export type AuthorKind = (typeof AuthorKind)[keyof typeof AuthorKind];

/** 탈퇴자 라벨 카피 단일 출처(데이터 폴백). 비주얼 표현은 ui-publisher 가 이 값을 소비. */
export const DELETED_AUTHOR_LABEL = '탈퇴한 사용자';

/**
 * 작성자 종류를 파생한다. created_by NULL/빈 문자열(탈퇴자 익명화) → Deleted 를 최우선 판별
 * (NULL==NULL 을 동일인으로 오판하지 않게). 그 외 meId 일치=Me, 불일치=Partner.
 * @param createdBy 작성자 uuid | null(탈퇴자 익명화)
 * @param meId 현재 사용자 uuid | null
 * @returns AuthorKind
 */
export const deriveAuthorKind = ({
  createdBy,
  meId,
}: {
  createdBy: string | null;
  meId: string | null;
}): AuthorKind => {
  if (!createdBy) return AuthorKind.Deleted;
  return createdBy === meId ? AuthorKind.Me : AuthorKind.Partner;
};

/**
 * 아바타 결정적 파생 키. 실 작성자 id 는 그대로, NULL/빈(탈퇴자)이면 null →
 * Avatar 가 userId 없음으로 기본(익명) 아바타로 폴백(크래시 0).
 * @param createdBy 작성자 uuid | null
 * @returns 아바타 키(uuid) 또는 null
 */
export const authorAvatarUserId = ({ createdBy }: { createdBy: string | null }): string | null =>
  createdBy ? createdBy : null;

/** 미매칭 폴백 카피 단일 출처(멤버 미로드/나간 작성자). 매핑 성공 시엔 실 닉이 label. */
const ME_FALLBACK_LABEL = '내가 기록';
const PARTNER_FALLBACK_LABEL = '짝꿍이 기록';

/** 작성자 표시 파생 결과(라벨/닉/아바타). MuklogDetail 작성자 행이 소비(plan §3.3). */
export type ResolvedAuthor = {
  /** 작성자 종류(라벨/아바타 분기 파생). */
  kind: AuthorKind;
  /** 화면 표시 라벨 — 매핑 시 실 닉, 미매칭 폴백 시 "내가 기록"/"짝꿍이 기록", NULL 시 "탈퇴한 사용자". */
  label: string;
  /** 매핑된 실 닉네임(null=미매칭/탈퇴 — 라벨은 폴백 카피). */
  nickname: string | null;
  /** 매핑된 아바타 public URL(null=미설정/미매칭/탈퇴 → Avatar 가 avatarUserId 로 결정적 폴백). */
  avatarUrl: string | null;
  /** 아바타 결정적 파생 키(=createdBy, 탈퇴자면 null). */
  avatarUserId: string | null;
};

/**
 * 작성자 표시 정보를 파생한다. members(useRoomMembers.ready)에서 createdBy 를 직접 조회 →
 * 실 닉/아바타·label. 미매칭(멤버 미로드 or 나간 작성자)이면 me/partner 폴백 카피(avatarUrl null, 회귀 0).
 * createdBy NULL(탈퇴자 익명화)은 members 무관 Deleted(라벨=탈퇴한 사용자·아바타 null).
 * @param createdBy 작성자 uuid | null(탈퇴자 익명화)
 * @param meId 현재 사용자 uuid | null
 * @param members 로그 멤버 목록(joined_at asc). 빈 배열=미로드 → 폴백
 * @returns ResolvedAuthor
 */
export const resolveAuthor = ({
  createdBy,
  meId,
  members,
}: {
  createdBy: string | null;
  meId: string | null;
  members: RoomMember[];
}): ResolvedAuthor => {
  const kind = deriveAuthorKind({ createdBy, meId });

  // 탈퇴자(NULL/빈) 최우선 — members 무관 graceful.
  if (kind === AuthorKind.Deleted) {
    return { kind, label: DELETED_AUTHOR_LABEL, nickname: null, avatarUrl: null, avatarUserId: null };
  }

  // createdBy 는 여기서 non-null(Deleted 아님). 멤버 목록에서 직접 조회(3명+ 정확 매핑).
  const member = members.find((m) => m.userId === createdBy);

  if (member) {
    const nickname =
      member.nickname != null && member.nickname.trim().length > 0
        ? member.nickname
        : defaultNickname({ userId: createdBy! });
    return { kind, label: nickname, nickname, avatarUrl: member.avatarUrl, avatarUserId: createdBy };
  }

  // 미매칭(멤버 미로드 or 나간 작성자) → me/partner 폴백 카피. 아바타는 결정적 폴백(url null).
  const label = kind === AuthorKind.Me ? ME_FALLBACK_LABEL : PARTNER_FALLBACK_LABEL;
  return { kind, label, nickname: null, avatarUrl: null, avatarUserId: createdBy };
};
