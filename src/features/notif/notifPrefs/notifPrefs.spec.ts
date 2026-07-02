// src/features/notif/notifPrefs.spec.ts
// 알림 설정 도메인 형/해석 순수 유틸 (push-send §4). 로컬 영속 폐기 후 남은 책임: 기본값·로그별 enabled 해석.
import { DEFAULT_NOTIF_PREFS, resolveLogEnabled, type NotifPrefs } from './notifPrefs';

describe('DEFAULT_NOTIF_PREFS', () => {
  it('기본은 마스터 on, perLog 빈 맵(부재=on)', () => {
    expect(DEFAULT_NOTIF_PREFS).toEqual({ master: true, perLog: {} });
  });
});

describe('resolveLogEnabled (D4)', () => {
  const prefs: NotifPrefs = { master: true, perLog: { on: true, off: false } };

  it('키가 있으면 그 값을 반환한다', () => {
    expect(resolveLogEnabled({ prefs, roomId: 'on' })).toBe(true);
    expect(resolveLogEnabled({ prefs, roomId: 'off' })).toBe(false);
  });

  it('키가 없으면 기본 true를 반환한다(신규 로그 기본 on, 서버 부재=on 과 동일)', () => {
    expect(resolveLogEnabled({ prefs, roomId: 'unknown' })).toBe(true);
  });
});
