// src/features/profile/errors.spec.ts
// 에러 토큰 → 한국어 메시지 매핑 명세 (plan §3.6 / §5-1, T3 / P6). 토큰 5종 + fallback + 타입 추출.
import {
  DEFAULT_PROFILE_ERROR_MESSAGE,
  mapProfileError,
  PROFILE_ERROR_MESSAGES,
  ProfileErrorToken,
} from './errors';

describe('mapProfileError — 토큰 정확 일치 (4종 + fallback)', () => {
  it('NICKNAME_EMPTY', () => {
    expect(mapProfileError({ error: new Error(ProfileErrorToken.NicknameEmpty) })).toBe(
      '닉네임을 입력해 주세요.',
    );
  });

  it('NICKNAME_TOO_LONG', () => {
    expect(mapProfileError({ error: new Error(ProfileErrorToken.NicknameTooLong) })).toBe(
      '닉네임은 20자까지 입력할 수 있어요.',
    );
  });

  it('PERMISSION_DENIED', () => {
    expect(mapProfileError({ error: new Error(ProfileErrorToken.PermissionDenied) })).toBe(
      '사진 접근 권한이 필요해요. 설정에서 허용해 주세요.',
    );
  });

  it('AVATAR_UPLOAD_FAILED', () => {
    expect(mapProfileError({ error: new Error(ProfileErrorToken.AvatarUploadFailed) })).toBe(
      '이미지 업로드에 실패했어요. 다시 시도해 주세요.',
    );
  });

  it('PROFILE_ERROR_MESSAGES는 정확히 4개의 토큰 키를 가진다 (단일 출처)', () => {
    expect(Object.keys(PROFILE_ERROR_MESSAGES).sort()).toEqual(
      ['AVATAR_UPLOAD_FAILED', 'NICKNAME_EMPTY', 'NICKNAME_TOO_LONG', 'PERMISSION_DENIED'].sort(),
    );
  });
});

describe('mapProfileError — 포함 매칭 / fallback', () => {
  it('토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapProfileError({ error: new Error('Error: AVATAR_UPLOAD_FAILED (network)') })).toBe(
      '이미지 업로드에 실패했어요. 다시 시도해 주세요.',
    );
  });

  it('알 수 없는 메시지는 fallback', () => {
    expect(mapProfileError({ error: new Error('some network failure') })).toBe(
      DEFAULT_PROFILE_ERROR_MESSAGE,
    );
  });

  it('빈 메시지는 fallback', () => {
    expect(mapProfileError({ error: new Error('') })).toBe(DEFAULT_PROFILE_ERROR_MESSAGE);
  });
});

describe('mapProfileError — error 타입 추출', () => {
  it('문자열 입력', () => {
    expect(mapProfileError({ error: 'PERMISSION_DENIED' })).toBe(
      '사진 접근 권한이 필요해요. 설정에서 허용해 주세요.',
    );
  });

  it('{ message } 객체 입력', () => {
    expect(mapProfileError({ error: { message: 'NICKNAME_EMPTY' } })).toBe('닉네임을 입력해 주세요.');
  });

  it('null은 throw 없이 fallback', () => {
    expect(mapProfileError({ error: null })).toBe(DEFAULT_PROFILE_ERROR_MESSAGE);
  });

  it('숫자 등 기타 타입은 throw 없이 fallback', () => {
    expect(mapProfileError({ error: 42 })).toBe(DEFAULT_PROFILE_ERROR_MESSAGE);
  });
});
