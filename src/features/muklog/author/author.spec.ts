// src/features/muklog/author.spec.ts
// 작성자 파생(데이터 레벨) — created_by NULL(탈퇴자 익명화) 안전 처리 (plan §5, AC6).
//   deriveAuthorKind: createdBy/meId → 'me' | 'partner' | 'deleted'. NULL/빈 createdBy = 'deleted'.
//   DELETED_AUTHOR_LABEL: 탈퇴자 라벨 단일 출처(시각 카피는 ui-publisher 와 공유하되 데이터 폴백은 여기).
//   resolveAuthor(S5b): members 매핑으로 실 닉/아바타 파생(3명+ 정확). 미매칭 me/partner 폴백. NULL→Deleted.
import {
  AuthorKind,
  DELETED_AUTHOR_LABEL,
  authorAvatarUserId,
  deriveAuthorKind,
  resolveAuthor,
} from './author';
import { defaultNickname } from '@/features/profile/defaultNickname';
import { type RoomMember } from '@/features/room';

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

describe('resolveAuthor', () => {
  const members: RoomMember[] = [
    { userId: 'u1', nickname: '민수', avatarUrl: 'https://cdn/u1.jpg' },
    { userId: 'u2', nickname: '지현', avatarUrl: null },
    { userId: 'u3', nickname: null, avatarUrl: 'https://cdn/u3.jpg' },
  ];

  it('① members에 createdBy 매칭 → 실 닉 label·avatarUrl (me)', () => {
    expect(resolveAuthor({ createdBy: 'u1', meId: 'u1', members })).toEqual({
      kind: AuthorKind.Me,
      label: '민수',
      nickname: '민수',
      avatarUrl: 'https://cdn/u1.jpg',
      avatarUserId: 'u1',
    });
  });

  it('① 매칭(partner) → 실 닉 label·avatarUrl(null 가능)', () => {
    expect(resolveAuthor({ createdBy: 'u2', meId: 'u1', members })).toEqual({
      kind: AuthorKind.Partner,
      label: '지현',
      nickname: '지현',
      avatarUrl: null,
      avatarUserId: 'u2',
    });
  });

  it('② 매칭 & nickname null → defaultNickname 폴백(label=닉)', () => {
    const nick = defaultNickname({ userId: 'u3' });
    expect(resolveAuthor({ createdBy: 'u3', meId: 'u1', members })).toEqual({
      kind: AuthorKind.Partner,
      label: nick,
      nickname: nick,
      avatarUrl: 'https://cdn/u3.jpg',
      avatarUserId: 'u3',
    });
  });

  it('③ 미매칭 & createdBy===meId → "내가 기록" 폴백(avatarUrl null·avatarUserId=createdBy)', () => {
    expect(resolveAuthor({ createdBy: 'u9', meId: 'u9', members })).toEqual({
      kind: AuthorKind.Me,
      label: '내가 기록',
      nickname: null,
      avatarUrl: null,
      avatarUserId: 'u9',
    });
  });

  it('④ 미매칭 & 다른 uid → "짝꿍이 기록" 폴백', () => {
    expect(resolveAuthor({ createdBy: 'u9', meId: 'u1', members })).toEqual({
      kind: AuthorKind.Partner,
      label: '짝꿍이 기록',
      nickname: null,
      avatarUrl: null,
      avatarUserId: 'u9',
    });
  });

  it('④ 미매칭(members 미로드=빈배열) & partner → "짝꿍이 기록"(회귀 0)', () => {
    expect(resolveAuthor({ createdBy: 'u2', meId: 'u1', members: [] })).toEqual({
      kind: AuthorKind.Partner,
      label: '짝꿍이 기록',
      nickname: null,
      avatarUrl: null,
      avatarUserId: 'u2',
    });
  });

  it('⑤ createdBy NULL → Deleted(members 무관, label=탈퇴한 사용자·아바타 null)', () => {
    expect(resolveAuthor({ createdBy: null, meId: 'u1', members })).toEqual({
      kind: AuthorKind.Deleted,
      label: DELETED_AUTHOR_LABEL,
      nickname: null,
      avatarUrl: null,
      avatarUserId: null,
    });
  });

  it('⑥ 3명 로그: 서로 다른 두 멤버 작성 글이 각각 다른 닉으로 매핑', () => {
    const a = resolveAuthor({ createdBy: 'u1', meId: 'u1', members });
    const b = resolveAuthor({ createdBy: 'u2', meId: 'u1', members });
    expect(a.label).toBe('민수');
    expect(b.label).toBe('지현');
    expect(a.avatarUserId).toBe('u1');
    expect(b.avatarUserId).toBe('u2');
  });
});
