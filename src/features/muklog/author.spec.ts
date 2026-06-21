// src/features/muklog/author.spec.ts
// 작성자 파생(데이터 레벨) — created_by NULL(탈퇴자 익명화) 안전 처리 (plan §5, AC6).
//   deriveAuthorKind: createdBy/meId → 'me' | 'partner' | 'deleted'. NULL/빈 createdBy = 'deleted'.
//   DELETED_AUTHOR_LABEL: 탈퇴자 라벨 단일 출처(시각 카피는 ui-publisher 와 공유하되 데이터 폴백은 여기).
import {
  AuthorKind,
  DELETED_AUTHOR_LABEL,
  authorAvatarUserId,
  deriveAuthorKind,
} from './author';

describe('deriveAuthorKind', () => {
  it('createdBy === meId 면 me', () => {
    expect(deriveAuthorKind({ createdBy: 'u1', meId: 'u1' })).toBe(AuthorKind.Me);
  });

  it('createdBy !== meId (둘 다 비어있지 않음) 이면 partner', () => {
    expect(deriveAuthorKind({ createdBy: 'u2', meId: 'u1' })).toBe(AuthorKind.Partner);
  });

  it('createdBy 가 null 이면 deleted(탈퇴자 익명화)', () => {
    expect(deriveAuthorKind({ createdBy: null, meId: 'u1' })).toBe(AuthorKind.Deleted);
  });

  it('createdBy 가 빈 문자열이면 deleted', () => {
    expect(deriveAuthorKind({ createdBy: '', meId: 'u1' })).toBe(AuthorKind.Deleted);
  });

  it('createdBy 가 null 이면 meId 와 무관하게 deleted(meId 도 null 인 비로그인 방어)', () => {
    expect(deriveAuthorKind({ createdBy: null, meId: null })).toBe(AuthorKind.Deleted);
  });

  it('createdBy 와 meId 가 둘 다 null 이어도 me 로 오판하지 않는다(NULL=NULL 함정 차단)', () => {
    // 핵심: NULL == NULL 을 동일인으로 처리하면 익명 작성자가 "내가 기록"으로 표시됨 → deleted 로 막는다.
    expect(deriveAuthorKind({ createdBy: null, meId: null })).not.toBe(AuthorKind.Me);
  });
});

describe('authorAvatarUserId', () => {
  it('실 작성자 id 는 그대로 반환(아바타 결정적 파생 키)', () => {
    expect(authorAvatarUserId({ createdBy: 'u2' })).toBe('u2');
  });

  it('null createdBy 는 null 로 반환 → Avatar 가 기본(익명) 아바타로 폴백', () => {
    expect(authorAvatarUserId({ createdBy: null })).toBeNull();
  });

  it('빈 문자열 createdBy 는 null 로 반환(기본 아바타 폴백)', () => {
    expect(authorAvatarUserId({ createdBy: '' })).toBeNull();
  });
});

describe('DELETED_AUTHOR_LABEL', () => {
  it('탈퇴자 라벨 카피 단일 출처', () => {
    expect(DELETED_AUTHOR_LABEL).toBe('탈퇴한 사용자');
  });
});
