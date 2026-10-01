// src/features/profile/defaultNickname.spec.ts
// 닉네임 미설정 표시 폴백 — userId 기반 결정적 기본 닉네임(동물명+4자리 숫자) (#3).
//   결정성(같은 userId면 항상 같은 값) + 형식(한국어 동물명 + 4자리 숫자)을 단위 검증.
import { ANIMAL_NAMES, defaultNickname } from './defaultNickname';

describe('defaultNickname (#3)', () => {
  it('한국어 동물명 + 4자리 숫자 형식을 반환한다', () => {
    const value = defaultNickname({ userId: 'user-1' });
    // 끝 4자리는 숫자, 앞부분은 팔레트의 동물명 중 하나.
    const match = /^(.+?)(\d{4})$/.exec(value);
    expect(match).not.toBeNull();
    const [, name, digits] = match as RegExpExecArray;
    expect(ANIMAL_NAMES).toContain(name);
    expect(digits).toHaveLength(4);
  });

  it('같은 userId면 항상 같은 값을 반환한다 (결정적)', () => {
    expect(defaultNickname({ userId: 'abc-123' })).toBe(defaultNickname({ userId: 'abc-123' }));
    expect(defaultNickname({ userId: 'zzz-999' })).toBe(defaultNickname({ userId: 'zzz-999' }));
  });

  it('userId가 다르면(일반적으로) 다른 값을 반환한다 (분산)', () => {
    const a = defaultNickname({ userId: 'aaaaaaaa-aaaa' });
    const b = defaultNickname({ userId: 'bbbbbbbb-bbbb' });
    expect(a).not.toBe(b);
  });

  it('빈/null/undefined userId도 throw 없이 결정적 폴백을 반환한다', () => {
    expect(() => defaultNickname({ userId: '' })).not.toThrow();
    expect(() => defaultNickname({ userId: null })).not.toThrow();
    expect(() => defaultNickname({ userId: undefined })).not.toThrow();
    // 같은(빈) 키 → 같은 값.
    expect(defaultNickname({ userId: '' })).toBe(defaultNickname({ userId: null }));
  });

  // join-push(plan AC23 · R9): 서버 이식본(supabase/functions/_shared/defaultNickname.ts)과 같은 값 — 푸시 문구의 닉네임 폴백이
  //   앱 화면 표기와 같아야 한다. 원본을 바꾸면 이식본도 바꾸고 deno test(_shared/defaultNickname.test.ts)를 돌린다.
  it('고정 값: caller-uid → 오소리4294, joiner-uid → 펭귄6650, u1 → 코알라3788, 빈 키 → 수달1000 (서버 이식본과 같음)', () => {
    expect(defaultNickname({ userId: 'caller-uid' })).toBe('오소리4294');
    expect(defaultNickname({ userId: 'joiner-uid' })).toBe('펭귄6650');
    expect(defaultNickname({ userId: 'u1' })).toBe('코알라3788');
    expect(defaultNickname({ userId: '' })).toBe('수달1000');
  });

  it('동물명 팔레트는 한국어이고 충분히(>=15개) 다양하다', () => {
    expect(ANIMAL_NAMES.length).toBeGreaterThanOrEqual(15);
    ANIMAL_NAMES.forEach((name) => {
      expect(/^[가-힣]+$/.test(name)).toBe(true);
    });
  });
});
