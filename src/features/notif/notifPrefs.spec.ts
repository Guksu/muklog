// src/features/notif/notifPrefs.spec.ts
// 알림 설정 영속 순수 유틸 — T1. 키 스키마·안전 파싱(손상 폴백)·기본 on(D4)·라운드트립.
import {
  DEFAULT_NOTIF_PREFS,
  NOTIF_PREFS_KEY_PREFIX,
  notifPrefsKey,
  parseNotifPrefs,
  resolveLogEnabled,
  serializeNotifPrefs,
  type NotifPrefs,
} from './notifPrefs';

describe('notifPrefsKey', () => {
  it('user_id 스코프 키를 prefix:userId 형태로 만든다(D5)', () => {
    expect(notifPrefsKey({ userId: 'u1' })).toBe(`${NOTIF_PREFS_KEY_PREFIX}:u1`);
    expect(notifPrefsKey({ userId: 'u1' })).toBe('muklog:notif-prefs:v1:u1');
  });

  it('userId가 다르면 키가 격리된다', () => {
    expect(notifPrefsKey({ userId: 'a' })).not.toBe(notifPrefsKey({ userId: 'b' }));
  });
});

describe('parseNotifPrefs', () => {
  it('raw=null이면 DEFAULT(master:true, perLog:{})를 반환한다', () => {
    expect(parseNotifPrefs({ raw: null })).toEqual(DEFAULT_NOTIF_PREFS);
  });

  it('손상된 JSON이면 throw 없이 DEFAULT를 반환한다', () => {
    expect(() => parseNotifPrefs({ raw: '잘못된json{' })).not.toThrow();
    expect(parseNotifPrefs({ raw: '잘못된json{' })).toEqual(DEFAULT_NOTIF_PREFS);
  });

  it('JSON이 객체가 아니면(예: 숫자/배열) DEFAULT를 반환한다', () => {
    expect(parseNotifPrefs({ raw: '42' })).toEqual(DEFAULT_NOTIF_PREFS);
    expect(parseNotifPrefs({ raw: '[1,2]' })).toEqual({ master: true, perLog: {} });
  });

  it('정상 JSON이면 master/perLog를 복원한다', () => {
    expect(parseNotifPrefs({ raw: JSON.stringify({ master: false, perLog: { r1: false } }) })).toEqual(
      { master: false, perLog: { r1: false } },
    );
  });

  it('누락 필드는 기본값으로 보강한다(master 누락→true, perLog 누락→{})', () => {
    expect(parseNotifPrefs({ raw: JSON.stringify({ perLog: { r1: true } }) })).toEqual({
      master: true,
      perLog: { r1: true },
    });
    expect(parseNotifPrefs({ raw: JSON.stringify({ master: false }) })).toEqual({
      master: false,
      perLog: {},
    });
  });

  it('perLog의 비-boolean 값은 제외한다(손상 값 방어)', () => {
    expect(
      parseNotifPrefs({ raw: JSON.stringify({ master: true, perLog: { r1: true, r2: 'x', r3: 1 } }) }),
    ).toEqual({ master: true, perLog: { r1: true } });
  });
});

describe('resolveLogEnabled (D4)', () => {
  const prefs: NotifPrefs = { master: true, perLog: { on: true, off: false } };

  it('키가 있으면 그 값을 반환한다', () => {
    expect(resolveLogEnabled({ prefs, roomId: 'on' })).toBe(true);
    expect(resolveLogEnabled({ prefs, roomId: 'off' })).toBe(false);
  });

  it('키가 없으면 기본 true를 반환한다(신규 로그 기본 on)', () => {
    expect(resolveLogEnabled({ prefs, roomId: 'unknown' })).toBe(true);
  });
});

describe('serialize ↔ parse 라운드트립', () => {
  it('직렬화→파싱이 동일하다', () => {
    const prefs: NotifPrefs = { master: false, perLog: { r1: false, r2: true } };
    expect(parseNotifPrefs({ raw: serializeNotifPrefs({ prefs }) })).toEqual(prefs);
  });
});
