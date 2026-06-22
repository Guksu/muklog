// src/features/notif/useNotifPrefs.ts
// 알림 설정 영속 훅(push-send §4 — 로컬→서버 이전). 인터페이스(state/setMaster/setLogEnabled) 보존.
//
// 생산자: notification_prefs(master_enabled, 행 부재=on) + notification_pref_rooms(room override, 부재=on) — RLS 본인만.
// 소비자: NotifSettingsScreen(master/perLog 토글). resolveLogEnabled(부재=true)는 화면에서 매핑.
// 정책: 마운트(또는 userId 변경) 시 두 테이블 1회 read → ready. 폴링·Realtime 금지(비용 가드레일).
//   set* 은 낙관적으로 state 갱신 후 upsert(await). 쓰기 실패는 console.warn + 낙관적 UI 유지(best-effort, last-write-wins).
//   ⚠️ 서버 prefs 가 발송을 게이팅한다(list_room_push_targets) — 발신자는 수신자 로컬 설정을 못 읽으므로 서버가 단일 출처.
//   ⚠️ 본인 행만 R/W(RLS user_id=auth.uid()). 토큰/타인 설정 미노출.
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { DEFAULT_NOTIF_PREFS, type NotifPrefs } from './notifPrefs';

export type NotifPrefsState = { status: 'loading' } | { status: 'ready'; prefs: NotifPrefs };

/**
 * 알림 설정(master/perLog)을 서버 영속하며 토글 setter 를 제공하는 훅.
 * @param userId 인증된 사용자 id(= auth.uid()). 변경 시 재read.
 * @returns state(loading/ready)와 setMaster/setLogEnabled(낙관적 갱신 + 서버 upsert)
 */
export const useNotifPrefs = ({ userId }: { userId: string }) => {
  const [state, setState] = useState<NotifPrefsState>({ status: 'loading' });
  const mountedRef = useRef(true);
  // 최신 prefs 참조 — setLogEnabled 가 기존 perLog 에 머지할 때 stale state 를 피한다.
  const prefsRef = useRef<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  useEffect(
    function loadNotifPrefsOnUser() {
      mountedRef.current = true;
      const readPrefs = async () => {
        // 두 테이블 병렬 read. 실패는 best-effort — DEFAULT(기본 on)로 폴백(크래시 금지).
        const [masterRes, roomsRes] = await Promise.all([
          supabase
            .from('notification_prefs')
            .select('master_enabled')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase.from('notification_pref_rooms').select('room_id, enabled').eq('user_id', userId),
        ]);
        if (!mountedRef.current) return;

        const masterRow = (masterRes?.error ? null : masterRes?.data) as
          | { master_enabled?: boolean }
          | null;
        const master = typeof masterRow?.master_enabled === 'boolean' ? masterRow.master_enabled : true;

        const perLog: Record<string, boolean> = {};
        if (!roomsRes?.error && Array.isArray(roomsRes?.data)) {
          for (const row of roomsRes.data as { room_id?: string; enabled?: boolean }[]) {
            if (typeof row.room_id === 'string' && typeof row.enabled === 'boolean') {
              perLog[row.room_id] = row.enabled;
            }
          }
        }

        const prefs: NotifPrefs = { master, perLog };
        prefsRef.current = prefs;
        setState({ status: 'ready', prefs });
      };
      void readPrefs();
      return function cleanupNotifPrefs() {
        mountedRef.current = false;
      };
    },
    // userId 변경 시에만 재read(폴링 방지).
    [userId],
  );

  // 낙관적 갱신 후 서버 upsert(await). 실패(throw 또는 { error })는 warn + 낙관적 UI 유지(best-effort).
  const setMaster = ({ enabled }: { enabled: boolean }) => {
    const next: NotifPrefs = { ...prefsRef.current, master: enabled };
    prefsRef.current = next;
    setState({ status: 'ready', prefs: next });
    const writeMaster = async () => {
      try {
        const { error } = await supabase
          .from('notification_prefs')
          .upsert({ user_id: userId, master_enabled: enabled }, { onConflict: 'user_id' });
        if (error) throw error;
      } catch (error) {
        console.warn('[useNotifPrefs] 마스터 설정 저장 실패(낙관적 UI 유지):', error);
      }
    };
    void writeMaster();
  };

  const setLogEnabled = ({ roomId, enabled }: { roomId: string; enabled: boolean }) => {
    const prev = prefsRef.current;
    const next: NotifPrefs = { ...prev, perLog: { ...prev.perLog, [roomId]: enabled } };
    prefsRef.current = next;
    setState({ status: 'ready', prefs: next });
    const writeRoom = async () => {
      try {
        const { error } = await supabase
          .from('notification_pref_rooms')
          .upsert({ user_id: userId, room_id: roomId, enabled }, { onConflict: 'user_id,room_id' });
        if (error) throw error;
      } catch (error) {
        console.warn('[useNotifPrefs] 로그별 설정 저장 실패(낙관적 UI 유지):', error);
      }
    };
    void writeRoom();
  };

  return { state, setMaster, setLogEnabled };
};
