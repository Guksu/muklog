// src/features/profile/avatarPath.spec.ts
// 아바타 Storage 경로 유틸 명세 (plan §3.1 / §3.3 / P3·P4·P10).
import {
  AVATARS_BUCKET,
  buildAvatarPath,
  createAvatarFileId,
  parseAvatarPath,
} from './avatarPath';

describe('AVATARS_BUCKET', () => {
  it("버킷명은 'avatars' (SQL 정책과 단일 출처)", () => {
    expect(AVATARS_BUCKET).toBe('avatars');
  });
});

describe('buildAvatarPath', () => {
  it('첫 세그먼트가 userId인 {userId}/{fileId}.jpg를 만든다 (P3 — 소유자 정책)', () => {
    expect(buildAvatarPath({ userId: 'u1', fileId: 'abc' })).toBe('u1/abc.jpg');
  });
});

describe('parseAvatarPath', () => {
  it('공개 URL에서 버킷 뒤 경로(첫 세그먼트=uid 포함)를 추출한다 (P10)', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/old.jpg';
    expect(parseAvatarPath({ publicUrl: url })).toBe('u1/old.jpg');
  });

  it('쿼리스트링이 붙어도 경로만 추출한다', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/old.jpg?t=123';
    expect(parseAvatarPath({ publicUrl: url })).toBe('u1/old.jpg');
  });

  it('avatars 버킷 URL이 아니면 null (정리 스킵)', () => {
    expect(parseAvatarPath({ publicUrl: 'https://example.com/whatever.jpg' })).toBeNull();
  });

  it('null/빈 문자열은 null', () => {
    expect(parseAvatarPath({ publicUrl: null })).toBeNull();
    expect(parseAvatarPath({ publicUrl: '' })).toBeNull();
  });
});

describe('createAvatarFileId', () => {
  it('빈 문자열이 아닌 식별자를 만든다', () => {
    expect(createAvatarFileId().length).toBeGreaterThan(0);
  });

  it('연속 호출 시 서로 다른 값을 만든다 (충돌 회피)', () => {
    expect(createAvatarFileId()).not.toBe(createAvatarFileId());
  });
});
