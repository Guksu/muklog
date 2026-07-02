// src/features/room/code.spec.ts
// 초대코드 입력 정규화·완성판정·charset 상수 명세 테스트 (plan §5-1 (1), C6).
import {
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  isInviteCodeComplete,
  normalizeInviteCodeInput,
} from './code';

describe('normalizeInviteCodeInput', () => {
  it('소문자를 대문자로 변환한다', () => {
    expect(normalizeInviteCodeInput({ raw: 'abcdef' })).toBe('ABCDEF');
  });

  it('혼동문자(0/O/1/I)·공백을 제거하고 앞 6자로 컷한다', () => {
    // 0,O,1,I,공백 제거 → A B C D E F G → 앞 6자 = ABCDEF
    expect(normalizeInviteCodeInput({ raw: ' ab0o1i cdefg ' })).toBe('ABCDEF');
  });

  it('6자를 초과하면 앞 6자만 남긴다', () => {
    const result = normalizeInviteCodeInput({ raw: 'ABCDEFGH' });
    expect(result).toBe('ABCDEF');
    expect(result).toHaveLength(INVITE_CODE_LENGTH);
  });

  it('허용문자가 하나도 없으면 빈 문자열을 반환한다', () => {
    expect(normalizeInviteCodeInput({ raw: '0011OOII' })).toBe('');
  });

  it('허용 숫자(2~9)는 남기고 특수문자는 제거한다', () => {
    expect(normalizeInviteCodeInput({ raw: 'A2-B3@C4' })).toBe('A2B3C4');
  });
});

describe('isInviteCodeComplete', () => {
  it('정확히 6자일 때만 true', () => {
    expect(isInviteCodeComplete({ code: 'ABCDEF' })).toBe(true);
  });

  it('5자는 false', () => {
    expect(isInviteCodeComplete({ code: 'ABCDE' })).toBe(false);
  });

  it('빈 문자열은 false', () => {
    expect(isInviteCodeComplete({ code: '' })).toBe(false);
  });

  it('7자는 false (=== 6 이므로)', () => {
    expect(isInviteCodeComplete({ code: 'ABCDEFG' })).toBe(false);
  });
});

describe('초대코드 상수 (C6 — SQL charset과 동일성의 클라 측 표현)', () => {
  it('INVITE_CODE_LENGTH는 6', () => {
    expect(INVITE_CODE_LENGTH).toBe(6);
  });

  it('charset에 혼동문자 0/O/1/I가 포함되지 않는다', () => {
    expect(INVITE_CODE_CHARSET).not.toContain('0');
    expect(INVITE_CODE_CHARSET).not.toContain('O');
    expect(INVITE_CODE_CHARSET).not.toContain('1');
    expect(INVITE_CODE_CHARSET).not.toContain('I');
  });

  it('charset 길이는 32 (A-Z 24자 + 2-9 8자)', () => {
    expect(INVITE_CODE_CHARSET).toHaveLength(32);
  });
});
