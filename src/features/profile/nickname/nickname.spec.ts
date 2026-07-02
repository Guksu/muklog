// src/features/profile/nickname.spec.ts
// 닉네임 검증 유틸 명세 (plan §3.5 / §5-1 단위, T2). 경계: 0/1/20/21자, 공백·앞뒤공백 trim.
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  validateNickname,
} from './nickname';

describe('validateNickname — 빈/공백(empty)', () => {
  it('빈 문자열 → ok:false, empty', () => {
    expect(validateNickname({ raw: '' })).toEqual({ ok: false, reason: 'empty' });
  });

  it('공백 전용 → ok:false, empty (trim 후 빈값)', () => {
    expect(validateNickname({ raw: '   ' })).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('validateNickname — 정상(ok) + trim', () => {
  it('1자 → ok, value 그대로', () => {
    expect(validateNickname({ raw: 'a' })).toEqual({ ok: true, value: 'a' });
  });

  it('앞뒤 공백은 trim해서 정규값을 돌려준다', () => {
    expect(validateNickname({ raw: '  닉  ' })).toEqual({ ok: true, value: '닉' });
  });

  it('정확히 20자 → ok', () => {
    const twenty = 'a'.repeat(20);
    expect(validateNickname({ raw: twenty })).toEqual({ ok: true, value: twenty });
  });
});

describe('validateNickname — 너무 김(too-long)', () => {
  it('21자 → ok:false, too-long', () => {
    expect(validateNickname({ raw: 'a'.repeat(21) })).toEqual({ ok: false, reason: 'too-long' });
  });

  it('trim 후 길이로 판정한다 (앞뒤 공백 포함 22자라도 내부 20자면 ok)', () => {
    expect(validateNickname({ raw: ` ${'a'.repeat(20)} ` })).toEqual({
      ok: true,
      value: 'a'.repeat(20),
    });
  });
});

describe('닉네임 길이 상수', () => {
  it('MIN=1, MAX=20', () => {
    expect(NICKNAME_MIN_LENGTH).toBe(1);
    expect(NICKNAME_MAX_LENGTH).toBe(20);
  });
});
