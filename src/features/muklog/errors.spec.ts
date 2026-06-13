// src/features/muklog/errors.spec.ts
// 먹로그 에러 토큰 → 한국어 메시지 매핑 (plan §5 T4, §5.3, AC3·AC5).
//   토큰 단일 출처: 마이그레이션 enforce_muklog_fields()의 raise 토큰 ↔ 이 매핑(동기화 필수).
import {
  MUKLOG_ERROR_MESSAGES,
  DEFAULT_MUKLOG_ERROR_MESSAGE,
  mapMuklogError,
  MuklogErrorToken,
} from './errors';

describe('mapMuklogError', () => {
  it('PLACE_NAME_REQUIRED 토큰을 한국어 메시지로 매핑한다 (AC3)', () => {
    expect(mapMuklogError({ error: new Error(MuklogErrorToken.PlaceNameRequired) })).toBe(
      MUKLOG_ERROR_MESSAGES[MuklogErrorToken.PlaceNameRequired],
    );
  });

  it('RATING_OUT_OF_RANGE 토큰을 매핑한다 (AC4)', () => {
    expect(mapMuklogError({ error: new Error('RATING_OUT_OF_RANGE') })).toBe(
      MUKLOG_ERROR_MESSAGES.RATING_OUT_OF_RANGE,
    );
  });

  it('VISITED_AT_IN_FUTURE 토큰을 매핑한다 (AC5)', () => {
    expect(mapMuklogError({ error: new Error('VISITED_AT_IN_FUTURE') })).toBe(
      MUKLOG_ERROR_MESSAGES.VISITED_AT_IN_FUTURE,
    );
  });

  it('토큰이 다른 텍스트로 감싸여도 포함 매칭한다', () => {
    expect(mapMuklogError({ error: new Error('... PLACE_NAME_REQUIRED ...') })).toBe(
      MUKLOG_ERROR_MESSAGES.PLACE_NAME_REQUIRED,
    );
  });

  it('미지 토큰/네트워크 에러는 기본 메시지로 흡수한다 (AC11)', () => {
    expect(mapMuklogError({ error: new Error('boom') })).toBe(DEFAULT_MUKLOG_ERROR_MESSAGE);
    expect(mapMuklogError({ error: null })).toBe(DEFAULT_MUKLOG_ERROR_MESSAGE);
    expect(mapMuklogError({ error: 'PLACE_NAME_REQUIRED' })).toBe(
      MUKLOG_ERROR_MESSAGES.PLACE_NAME_REQUIRED,
    );
  });

  // 사진 슬라이스(muklog-photos) — 트리거/권한/업로드 토큰.
  it('PHOTO_ORDER_OUT_OF_RANGE 토큰을 매핑한다 (트리거 단일 출처)', () => {
    expect(mapMuklogError({ error: new Error(MuklogErrorToken.PhotoOrderOutOfRange) })).toBe(
      MUKLOG_ERROR_MESSAGES[MuklogErrorToken.PhotoOrderOutOfRange],
    );
  });

  it('PHOTO_LIMIT_EXCEEDED 토큰을 매핑한다 (5장 상한)', () => {
    expect(mapMuklogError({ error: new Error(MuklogErrorToken.PhotoLimitExceeded) })).toBe(
      MUKLOG_ERROR_MESSAGES[MuklogErrorToken.PhotoLimitExceeded],
    );
  });

  it('PERMISSION_DENIED 토큰을 사진 권한 메시지로 매핑한다 (갤러리 권한 거부)', () => {
    expect(mapMuklogError({ error: new Error(MuklogErrorToken.PermissionDenied) })).toBe(
      MUKLOG_ERROR_MESSAGES[MuklogErrorToken.PermissionDenied],
    );
  });

  it('PHOTO_UPLOAD_FAILED 토큰을 업로드 실패 메시지로 매핑한다', () => {
    expect(mapMuklogError({ error: new Error(MuklogErrorToken.PhotoUploadFailed) })).toBe(
      MUKLOG_ERROR_MESSAGES[MuklogErrorToken.PhotoUploadFailed],
    );
  });
});
