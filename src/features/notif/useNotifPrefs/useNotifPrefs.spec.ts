// src/features/notif/useNotifPrefs.spec.ts
// 알림 설정 영속 훅(push-send §4 — 로컬→서버 이전). 마운트 1회 서버 read(폴링 없음)·복원·낙관적 upsert·실패 폴백.
//   생산자: notification_prefs(master) + notification_pref_rooms(perLog override) — RLS 본인만.
//   소비자: NotifSettingsScreen(master/perLog 토글). 부재 = 기본 on(master true, perLog 빈).
//   ⚠️ 토큰/타인 설정 미노출 — 본인 행만 R/W(RLS). 폴링·Realtime 0(비용 가드레일).
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useNotifPrefs } from './useNotifPrefs';

const fromMock = supabase.from as jest.Mock;

// notification_prefs.select().eq().maybeSingle() 와 notification_pref_rooms.select().eq() 읽기,
// 그리고 각 테이블 upsert() 를 테이블명으로 분기해 모킹한다.
type MasterRow = { master_enabled: boolean } | null;
type RoomRow = { room_id: string; enabled: boolean };

const wire = ({
  masterRow,
  roomRows,
  masterReadError,
  roomsReadError,
}: {
  masterRow?: MasterRow;
  roomRows?: RoomRow[];
  masterReadError?: boolean;
  roomsReadError?: boolean;
} = {}) => {
  const masterUpsert = jest.fn().mockResolvedValue({ error: null });
  const roomsUpsert = jest.fn().mockResolvedValue({ error: null });

  fromMock.mockImplementation((table: string) => {
    if (table === 'notification_prefs') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve(
                masterReadError
                  ? { data: null, error: new Error('READ_FAILED') }
                  : { data: masterRow ?? null, error: null },
              ),
          }),
        }),
        upsert: (...args: unknown[]) => masterUpsert(...args),
      };
    }
    // notification_pref_rooms
    return {
      select: () => ({
        eq: () =>
          Promise.resolve(
            roomsReadError
              ? { data: null, error: new Error('READ_FAILED') }
              : { data: roomRows ?? [], error: null },
          ),
      }),
      upsert: (...args: unknown[]) => roomsUpsert(...args),
    };
  });

  return { masterUpsert, roomsUpsert };
};

beforeEach(() => {
  fromMock.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('useNotifPrefs — 마운트 서버 read', () => {
  it('마운트 시 두 테이블을 각각 1회 조회한다(폴링 없음)', async () => {
    wire();
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const tables = fromMock.mock.calls.map((c) => c[0]);
    expect(tables.filter((t) => t === 'notification_prefs').length).toBe(1);
    expect(tables.filter((t) => t === 'notification_pref_rooms').length).toBe(1);
  });

  it('행 부재 → DEFAULT(master:true, perLog:{})로 ready 전이(기본 on)', async () => {
    wire({ masterRow: null, roomRows: [] });
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: true, perLog: {} } });
  });

  it('서버 행이 있으면 master/perLog 를 복원한다', async () => {
    wire({ masterRow: { master_enabled: false }, roomRows: [{ room_id: 'r1', enabled: false }] });
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({
      status: 'ready',
      prefs: { master: false, perLog: { r1: false } },
    });
  });

  it('읽기 실패 → DEFAULT(기본 on)로 ready 전이(크래시 금지, best-effort)', async () => {
    wire({ masterReadError: true, roomsReadError: true });
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: true, perLog: {} } });
  });
});

describe('useNotifPrefs — setMaster/setLogEnabled', () => {
  it('setMaster(false) → state 즉시 false + notification_prefs upsert(user_id, master_enabled:false)', async () => {
    const { masterUpsert } = wire();
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setMaster({ enabled: false });
    });

    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: false, perLog: {} } });
    expect(masterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', master_enabled: false }),
      expect.anything(),
    );
  });

  it('setLogEnabled(r1,false) → perLog.r1=false 반영 + notification_pref_rooms upsert, master 불변', async () => {
    const { roomsUpsert } = wire({ roomRows: [{ room_id: 'r2', enabled: false }] });
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setLogEnabled({ roomId: 'r1', enabled: false });
    });

    expect(result.current.state).toEqual({
      status: 'ready',
      prefs: { master: true, perLog: { r2: false, r1: false } },
    });
    expect(roomsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', room_id: 'r1', enabled: false }),
      expect.anything(),
    );
  });

  it('upsert 가 reject 해도 state 는 낙관적으로 유지되고 warn 한다(throw 미전파)', async () => {
    const { masterUpsert } = wire();
    masterUpsert.mockRejectedValueOnce(new Error('NETWORK'));
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setMaster({ enabled: false });
    });

    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: false, perLog: {} } });
    expect(console.warn).toHaveBeenCalled();
  });

  it('upsert 가 { error } 를 반환해도 낙관적 state 유지 + warn(best-effort)', async () => {
    const { masterUpsert } = wire();
    masterUpsert.mockResolvedValueOnce({ error: new Error('RLS') });
    const { result } = renderHook(() => useNotifPrefs({ userId: 'u1' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => {
      result.current.setMaster({ enabled: false });
    });

    expect(result.current.state).toEqual({ status: 'ready', prefs: { master: false, perLog: {} } });
    expect(console.warn).toHaveBeenCalled();
  });
});
