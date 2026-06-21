// src/features/muklog/author.ts
// 작성자 파생(데이터 레벨) — created_by NULL(탈퇴자 익명화) 안전 처리 (plan §5, AC6).
//   회원 탈퇴 마이그레이션(20260621120000)으로 muklogs.created_by 가 nullable(ON DELETE SET NULL)이 되어
//   탈퇴자가 쓴 기록은 created_by = NULL 로 익명화된다. 작성자 라벨/아바타 파생이 NULL 에 graceful 하도록 단일 출처화.
//
// 경계: 라벨 "문자열"(비주얼 카피)은 ui-publisher 와 공유하되, 데이터 폴백(AuthorKind 판별 + 익명 아바타 키)은 여기.
//   ⚠️ NULL == NULL 함정: createdBy/meId 둘 다 NULL 일 때 `createdBy === meId` 는 JS 에서 true(null===null) →
//      익명 작성자가 "내가 기록"으로 오표시될 수 있다. deriveAuthorKind 는 NULL/빈 createdBy 를 먼저 Deleted 로 가른다.

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
