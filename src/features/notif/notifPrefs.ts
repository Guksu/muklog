// src/features/notif/notifPrefs.ts
// 알림 설정 도메인 형/해석 순수 유틸 (push-send §4 — 로컬 영속 폐기, 서버 이전).
//   영속 위치 = 서버(notification_prefs/notification_pref_rooms, useNotifPrefs). 이 파일은 더 이상 AsyncStorage 를
//   다루지 않는다(로컬 키/파서/직렬화 제거). 남는 책임은 형(NotifPrefs)·기본값·로그별 enabled 해석(resolveLogEnabled).
//   resolveLogEnabled 는 perLog 키 부재 시 기본 on(D4) — 서버 RPC coalesce(npr.enabled,true) 와 동일 의미.

/** 메모리 형. master=마스터 스위치, perLog=roomId→enabled 맵(부재=기본 on). 서버 두 테이블을 복원한 형. */
export type NotifPrefs = {
  master: boolean;
  perLog: Record<string, boolean>;
};

/** 기본값 — 마스터 on, 로그별 맵 비어있음(미존재 키는 on으로 해석). 서버 행 부재 시 폴백. */
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { master: true, perLog: {} };

/**
 * 특정 로그의 enabled 를 해석한다 — perLog 에 키가 없으면 기본 true(D4, 서버 부재=on 과 동일).
 * @param prefs 현재 메모리 형
 * @param roomId 조회할 로그 id
 * @returns 키가 있으면 그 값, 없으면 true
 */
export const resolveLogEnabled = ({
  prefs,
  roomId,
}: {
  prefs: NotifPrefs;
  roomId: string;
}): boolean => (roomId in prefs.perLog ? prefs.perLog[roomId] : true);
