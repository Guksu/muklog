// src/features/profile/avatarDefault.spec.ts
// 결정적 디폴트 아바타 유틸 명세 (plan §3.2 / §5-1 유틸, A5).
//   avatarUrl 없는 프로필에 userId 해시 → 안정적 이모지+컬러를 부여(빈 화면 없음, DB 저장 없음).
import { AVATAR_COLORS, AVATAR_EMOJIS, defaultAvatar } from './avatarDefault';

describe('AVATAR 팔레트 상수', () => {
  it('이모지와 컬러 팔레트 길이가 같다(인덱스 페어링 전제)', () => {
    expect(AVATAR_EMOJIS.length).toBe(AVATAR_COLORS.length);
  });

  it('팔레트가 비어있지 않다', () => {
    expect(AVATAR_EMOJIS.length).toBeGreaterThan(0);
  });

  it('컬러는 모두 #RRGGBB hex 형식이다(도메인 팔레트)', () => {
    AVATAR_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe('defaultAvatar', () => {
  it('팔레트 내의 {emoji, color}를 반환한다', () => {
    const result = defaultAvatar({ userId: 'user-abc' });
    expect(AVATAR_EMOJIS).toContain(result.emoji);
    expect(AVATAR_COLORS).toContain(result.color);
  });

  it('이모지와 컬러가 같은 인덱스로 페어링된다', () => {
    const result = defaultAvatar({ userId: 'pair-check' });
    const emojiIndex = (AVATAR_EMOJIS as readonly string[]).indexOf(result.emoji);
    expect(AVATAR_COLORS[emojiIndex]).toBe(result.color);
  });

  it('결정성: 같은 userId는 항상 같은 결과', () => {
    const first = defaultAvatar({ userId: 'stable-id-123' });
    const second = defaultAvatar({ userId: 'stable-id-123' });
    expect(second).toEqual(first);
  });

  it('다양성: 여러 userId는 2개 이상 서로 다른 인덱스로 분산된다', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'];
    const emojis = new Set(ids.map((id) => defaultAvatar({ userId: id }).emoji));
    expect(emojis.size).toBeGreaterThan(1);
  });

  it('폴백: 빈 문자열 userId → 팔레트 0번(throw 없음)', () => {
    const result = defaultAvatar({ userId: '' });
    expect(result.emoji).toBe(AVATAR_EMOJIS[0]);
    expect(result.color).toBe(AVATAR_COLORS[0]);
  });

  it('폴백: null/undefined userId → 팔레트 0번(throw 없음)', () => {
    expect(defaultAvatar({ userId: null }).emoji).toBe(AVATAR_EMOJIS[0]);
    expect(defaultAvatar({ userId: undefined }).emoji).toBe(AVATAR_EMOJIS[0]);
  });
});
