// src/features/room/code.spec.ts
// 초대코드 입력 정규화·완성판정·charset 상수 명세 테스트 (plan §5-1 (1), C6).
//   invite-share(U73): 문장째 붙여넣기 추출(extractInviteCode)·입력 변경 해석(resolveInviteCodeInput) — plan R1, AC14·AC15.
import {
  extractInviteCode,
  INVITE_CODE_CHARSET,
  INVITE_CODE_LENGTH,
  isInviteCodeComplete,
  normalizeInviteCodeInput,
  resolveInviteCodeInput,
} from './code';

// 보내는 쪽 공유 메시지(plan AC1)와 같은 글자 — 이 파일은 inviteMessage에 의존하지 않도록 원문을 그대로 적는다(왕복은 inviteMessage.spec).
const STORE_URL = 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594';
const messageWith = ({ code }: { code: string }) => `먹로그에서 우리 맛집 같이 기록해요\n초대코드: ${code}\n앱 받기: ${STORE_URL}`;

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

describe('extractInviteCode (invite-share U73, AC14)', () => {
  it('공유 메시지 전체(3줄·링크 포함)에서 코드를 뽑는다', () => {
    expect(extractInviteCode({ text: messageWith({ code: 'K7P3AB' }) })).toBe('K7P3AB');
  });

  it('"초대코드: K7P3AB"처럼 라벨이 붙은 글에서 코드를 뽑는다', () => {
    expect(extractInviteCode({ text: '초대코드: K7P3AB' })).toBe('K7P3AB');
  });

  it('앞뒤 공백·줄바꿈·소문자를 정리해 뽑는다', () => {
    expect(extractInviteCode({ text: ' k7p3ab\n' })).toBe('K7P3AB');
  });

  it('빈 글이면 null', () => {
    expect(extractInviteCode({ text: '' })).toBeNull();
  });

  it.each(['K7P3', '안녕하세요', '0O1I 초대', 'ABCDE'])('허용 문자가 6자 미만인 %j는 null', (text) => {
    expect(extractInviteCode({ text })).toBeNull();
  });

  it('허용 문자가 정확히 6자면 코드로 인정한다', () => {
    expect(extractInviteCode({ text: 'ABCDEF' })).toBe('ABCDEF');
  });

  it('7자 이상이면 앞 6자(기존 정규화 규칙)', () => {
    expect(extractInviteCode({ text: 'K7P3ABQ' })).toBe('K7P3AB');
  });

  it('메시지가 두 개 이어 붙어 있으면 첫 코드', () => {
    expect(extractInviteCode({ text: `${messageWith({ code: 'K7P3AB' })}\n${messageWith({ code: 'Q9W8E7' })}` })).toBe('K7P3AB');
  });
});

describe('resolveInviteCodeInput (invite-share U73, AC15 — plan §4.2 표)', () => {
  // [prev(입력란의 현재 값), raw(입력란이 보낸 새 원문), 기대값, 설명]
  const rows: [string, string, string, string][] = [
    ['', 'k', 'K', '한 글자 입력(소문자 → 대문자)'],
    ['K7P3A', 'K7P3AB', 'K7P3AB', '마지막 한 글자로 완성'],
    ['K7P', 'K7', 'K7', '지우기'],
    ['', messageWith({ code: 'K7P3AB' }), 'K7P3AB', '빈 값에 공유 메시지째 붙여넣기'],
    ['K7', `K7초대코드: Q9W8E7`, 'Q9W8E7', '일부 입력 뒤 붙여넣기 → 교체(이어 붙인 K7Q9W8이 아님)'],
    ['K7P3AB', `K7P3AB${messageWith({ code: 'Q9W8E7' })}`, 'Q9W8E7', '6자 찬 상태에서 메시지 붙여넣기 → 교체'],
    ['K7P3AB', 'K7PQ9W8E73AB', 'Q9W8E7', '커서가 가운데일 때 붙여넣기(Android) → 교체'],
    ['K7P3AB', '초대코드: Q9W8E7', 'Q9W8E7', '전체 선택 후 붙여넣기 → 교체'],
    ['K7P3AB', 'K7P3ABX', 'K7P3AB', '6자 뒤 한 글자 더 → 무시(기존)'],
    ['K7', 'K7안녕', 'K7', '코드 없는 여러 글자 → 정규화(값 불변)'],
    ['K7', 'K7P3AB', 'K7P3AB', '짧은 조각(P3AB) → 이어 붙임'],
    ['ABC', 'ABC0', 'ABC', '허용 안 되는 글자 → 값 불변'],
  ];

  it.each(rows)('prev %j + raw %j → %j (%s)', (prev, raw, expected) => {
    expect(resolveInviteCodeInput({ prev, raw })).toBe(expected);
  });

  // 삽입분 판정 경계 — 앞·뒤 공통 부분을 둘 다 걷어 내야 맞는 경우를 따로 잠근다.
  it('커서가 맨 앞일 때 붙여넣기 → 뒤에 남은 옛 값은 삽입분이 아니다', () => {
    expect(resolveInviteCodeInput({ prev: 'ABC', raw: 'K7P3ABABC' })).toBe('K7P3AB');
  });

  it('가운데에 짧은 조각을 붙이면 코드로 보지 않고 기존 정규화(앞 6자)를 쓴다', () => {
    // 삽입분은 'Q9W'(3자)뿐 — 뒤의 옛 글자 '3AB'까지 삽입분으로 보면 'Q9W3AB'라는 틀린 코드로 교체된다.
    expect(resolveInviteCodeInput({ prev: 'K7P3AB', raw: 'K7PQ9W3AB' })).toBe('K7PQ9W');
  });

  it('붙여넣은 글이 옛 값과 같은 글자로 시작해도 삽입분만 본다', () => {
    expect(resolveInviteCodeInput({ prev: 'K7P', raw: 'K7PK7P3AB' })).toBe('K7P3AB');
  });

  it('아주 긴 붙여넣기도 6자 이하로 끝난다', () => {
    const result = resolveInviteCodeInput({ prev: '', raw: `${'가'.repeat(5000)} ${messageWith({ code: 'K7P3AB' })} ${'Z'.repeat(5000)}` });
    expect(result).toBe('K7P3AB');
  });
});
