// src/features/notif/useNotifPrefs.ts
// 알림 설정 영속 훅 (notif-settings plan §4.2). 로컬 AsyncStorage read/write 캡슐화(D1).
//
// 생산자: AsyncStorage(user-scoped 키, D5). 소비자: NotifSettingsScreen(master/perLog 토글).
// 정책: 마운트(또는 userId 변경) 시 getItem 1회 read → ready. 폴링 금지(비용 가드레일).
//   set* 은 낙관적으로 state 갱신 후 setItem(await). 쓰기 실패는 console.warn + UI 유지(best-effort).
//   설정 소스를 이 훅으로 캡슐화 → 발송 스프린트에서 로컬→DB 교체 용이(D1).
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_NOTIF_PREFS,
  notifPrefsKey,
  parseNotifPrefs,
  serializeNotifPrefs,
  type NotifPrefs,
} from './notifPrefs';

export type NotifPrefsState = { status: 'loading' } | { status: 'ready'; prefs: NotifPrefs };

/**
 * 알림 설정(master/perLog)을 로컬 영속하며 토글 setter를 제공하는 훅.
 * @param userId 인증된 사용자 id — 영속 키 스코프(D5). 변경 시 재read.
 * @returns state(loading/ready)와 setMaster/setLogEnabled(낙관적 갱신 + 영속)
 */
export const useNotifPrefs = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<NotifPrefsState>({ status: 'loading' });
  const mountedRef = useRef(true);
  // 최신 prefs 참조 — setLogEnabled가 기존 perLog에 머지할 때 stale state를 피한다.
  const prefsRef = useRef<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  useEffect(
    function loadNotifPrefsOnUser() {
      mountedRef.current = true;
      const readPrefs = async () => {
        const raw = await AsyncStorage.getItem(notifPrefsKey({ userId }));
        if (!mountedRef.current) return;
        const prefs = parseNotifPrefs({ raw });
        prefsRef.current = prefs;
        setState({ status: 'ready', prefs });
      };
      void readPrefs();
      return function cleanupNotifPrefs() {
        mountedRef.current = false;
      };
    },
    // userId 변경 시에만 재read(폴링 방지). 키는 userId에서 파생되므로 원시 의존만 둔다.
    [userId],
  );

  // 낙관적 갱신 + 영속(await). 쓰기 실패는 warn하고 UI는 유지(best-effort, last-write-wins).
  const persist = async ({ next }: { next: NotifPrefs }) => {
    prefsRef.current = next;
    setState({ status: 'ready', prefs: next });
    try {
      await AsyncStorage.setItem(notifPrefsKey({ userId }), serializeNotifPrefs({ prefs: next }));
    } catch (error) {
      console.warn('[useNotifPrefs] 설정 저장 실패(낙관적 UI 유지):', error);
    }
  };

  const setMaster = ({ enabled }: { enabled: boolean }) => {
    void persist({ next: { ...prefsRef.current, master: enabled } });
  };

  const setLogEnabled = ({ roomId, enabled }: { roomId: string; enabled: boolean }) => {
    const prev = prefsRef.current;
    void persist({ next: { ...prev, perLog: { ...prev.perLog, [roomId]: enabled } } });
  };

  return { state, setMaster, setLogEnabled };
};
