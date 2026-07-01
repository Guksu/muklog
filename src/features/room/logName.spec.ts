// src/features/room/logName.spec.ts
// 로그 이름 정규화/검증/폴백 유틸 — 순수 단위 (plan §3.4·§5-1, 결정2·결정4).
import { displayLogName, isLogNameTooLong, LOG_NAME_MAX_LENGTH, normalizeLogName } from './logName';

describe('LOG_NAME_MAX_LENGTH', () => {
  it('20 — DB rename_room char_length·입력 maxLength 와 단일 출처(C-LEN)', () => {
    expect(LOG_NAME_MAX_LENGTH).toBe(20);
  });
});

describe('normalizeLogName — trim 후 빈/공백이면 null', () => {
  it('정상 문자열은 그대로', () => {
    expect(normalizeLogName({ input: '우리 맛집' })).toBe('우리 맛집');
  });

  it('앞뒤 공백은 trim한다', () => {
    expect(normalizeLogName({ input: '  우리 맛집  ' })).toBe('우리 맛집');
  });

  it('공백만 있으면 null(폴백 복귀)', () => {
    expect(normalizeLogName({ input: '   ' })).toBeNull();
  });

  it('빈 문자열이면 null', () => {
    expect(normalizeLogName({ input: '' })).toBeNull();
  });

  it('탭·개행 공백도 trim해 빈이면 null', () => {
    expect(normalizeLogName({ input: '\t\n ' })).toBeNull();
  });

  it('내부 공백은 보존한다', () => {
    expect(normalizeLogName({ input: '  맛 집  ' })).toBe('맛 집');
  });
});

describe('isLogNameTooLong — 정규화 후 코드포인트 기준 20 초과 여부', () => {
  it('19자는 false', () => {
    expect(isLogNameTooLong({ input: 'a'.repeat(19) })).toBe(false);
  });

  it('20자는 false(경계)', () => {
    expect(isLogNameTooLong({ input: 'a'.repeat(20) })).toBe(false);
  });

  it('21자는 true', () => {
    expect(isLogNameTooLong({ input: 'a'.repeat(21) })).toBe(true);
  });

  it('앞뒤 공백은 trim 후 길이로 판단(20자+공백 → false)', () => {
    expect(isLogNameTooLong({ input: `  ${'a'.repeat(20)}  ` })).toBe(false);
  });

  it('공백만이면 false(정규화 null)', () => {
    expect(isLogNameTooLong({ input: '   ' })).toBe(false);
  });

  it('이모지는 코드포인트로 1씩 카운트한다([...str].length, surrogate pair 함정 회피)', () => {
    // 😀 는 surrogate pair(String.length=2)지만 코드포인트는 1 → 20개 false / 21개 true.
    expect(isLogNameTooLong({ input: '😀'.repeat(20) })).toBe(false);
    expect(isLogNameTooLong({ input: '😀'.repeat(21) })).toBe(true);
  });
});

describe('displayLogName — name 우선, 없으면 본인 닉 기반 폴백 (결정2 B\')', () => {
  it('name이 있으면 name을 그대로 표시', () => {
    expect(displayLogName({ name: '우리 맛집', memberCount: 2, selfNickname: '민' })).toBe('우리 맛집');
  });

  it('name=null & 솔로(memberCount<2) & 닉="민" → "민의 기록"', () => {
    expect(displayLogName({ name: null, memberCount: 1, selfNickname: '민' })).toBe('민의 기록');
  });

  it('name=null & 커플(memberCount>=2) & 닉="민" → "민 · 짝꿍"(파트너는 "짝꿍" 고정)', () => {
    expect(displayLogName({ name: null, memberCount: 2, selfNickname: '민' })).toBe('민 · 짝꿍');
  });

  it('name=null & 솔로 & 닉 null → 안전 폴백 "내 로그"', () => {
    expect(displayLogName({ name: null, memberCount: 1, selfNickname: null })).toBe('내 로그');
  });

  it('name=null & 커플 & 닉 null → 안전 폴백 "우리 로그"', () => {
    expect(displayLogName({ name: null, memberCount: 2, selfNickname: null })).toBe('우리 로그');
  });

  it('name=null & 솔로 & 닉 빈 문자열 → 안전 폴백 "내 로그"', () => {
    expect(displayLogName({ name: null, memberCount: 1, selfNickname: '' })).toBe('내 로그');
  });

  it('name 빈 문자열("")도 방어적으로 폴백 처리한다', () => {
    expect(displayLogName({ name: '', memberCount: 2, selfNickname: '민' })).toBe('민 · 짝꿍');
  });
});
