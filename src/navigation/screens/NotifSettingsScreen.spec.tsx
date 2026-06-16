// src/navigation/screens/NotifSettingsScreen.spec.tsx
// 알림 설정 컨테이너 배선 — T4/T5/T6/T8. 훅(notif/auth/profile/room)·navigation만 모킹, View·유틸은 실제.
//   진입 타이틀·마스터 초기값/토글·로그별 매핑(displayLogName·resolveLogEnabled)·마스터 게이트·빈/로딩.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/notif/useNotifPrefs', () => ({ useNotifPrefs: jest.fn() }));
jest.mock('@/features/profile', () => ({ useProfile: jest.fn() }));
// ⚠️ 배럴 requireActual은 supabase→AsyncStorage를 끌어오므로 순수 모듈(logName)만 requireActual.
jest.mock('@/features/room', () => {
  const logName = jest.requireActual('@/features/room/logName');
  return { useMyLogsContext: jest.fn(), displayLogName: logName.displayLogName };
});

import { useAuth } from '@/features/auth';
import { useNotifPrefs } from '@/features/notif/useNotifPrefs';
import { useProfile } from '@/features/profile';
import { useMyLogsContext } from '@/features/room';
import { NotifSettingsScreen } from './NotifSettingsScreen';

const useAuthMock = useAuth as jest.Mock;
const useNotifPrefsMock = useNotifPrefs as jest.Mock;
const useProfileMock = useProfile as jest.Mock;
const useMyLogsContextMock = useMyLogsContext as jest.Mock;

const setMaster = jest.fn();
const setLogEnabled = jest.fn();

type SetupArgs = {
  prefs?: { master: boolean; perLog: Record<string, boolean> };
  prefsLoading?: boolean;
  logs?: { roomId: string; name: string | null; memberCount: number }[];
  logsStatus?: 'loading' | 'ready' | 'error';
  nickname?: string | null;
};

const setup = ({
  prefs = { master: true, perLog: {} },
  prefsLoading = false,
  logs = [],
  logsStatus = 'ready',
  nickname = '민',
}: SetupArgs = {}) => {
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' } });
  useNotifPrefsMock.mockReturnValue({
    state: prefsLoading ? { status: 'loading' } : { status: 'ready', prefs },
    setMaster,
    setLogEnabled,
  });
  useProfileMock.mockReturnValue({ state: { status: 'ready', profile: { nickname, avatarUrl: null } } });
  const myLogsState =
    logsStatus === 'ready'
      ? { status: 'ready', logs: logs.map((l) => ({ ...l, mode: 'couple', createdAt: '', joinedAt: '' })) }
      : logsStatus === 'loading'
        ? { status: 'loading' }
        : { status: 'error', message: 'x' };
  useMyLogsContextMock.mockReturnValue({ state: myLogsState, refresh: jest.fn() });
  return renderWithTheme(<NotifSettingsScreen />);
};

beforeEach(() => {
  mockGoBack.mockClear();
  setMaster.mockClear();
  setLogEnabled.mockClear();
});

describe('NotifSettingsScreen — 마스터 (T4)', () => {
  it('진입 시 "알림 설정" 타이틀을 렌더하고 뒤로 버튼 탭 시 goBack 한다', () => {
    setup();
    expect(screen.getByText('알림 설정')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('마스터 스위치 초기값은 영속값(prefs.master)이다', () => {
    setup({ prefs: { master: false, perLog: {} } });
    const master = screen.getByLabelText('새 먹로그 알림');
    expect(master.props.accessibilityState.checked).toBe(false);
  });

  it('마스터 스위치 탭 → setMaster({enabled:!master}) 호출', () => {
    setup({ prefs: { master: true, perLog: {} } });
    fireEvent.press(screen.getByLabelText('새 먹로그 알림'));
    expect(setMaster).toHaveBeenCalledWith({ enabled: false });
  });

  it('prefs 로딩 중에도 DEFAULT(master on)로 렌더(크래시 없음)', () => {
    setup({ prefsLoading: true });
    expect(screen.getByLabelText('새 먹로그 알림').props.accessibilityState.checked).toBe(true);
  });
});

describe('NotifSettingsScreen — 로그별 (T5)', () => {
  const twoLogs = [
    { roomId: 'r1', name: '맛집노트', memberCount: 1 },
    { roomId: 'r2', name: null, memberCount: 2 },
  ];

  it('로그 2건 → 행 2개, 로그명은 displayLogName 결과(name 우선/커플 폴백)', () => {
    setup({ logs: twoLogs });
    expect(screen.getByText('맛집노트')).toBeTruthy();
    // r2: name null + 커플 + 닉 '민' → "민 ♥ 짝꿍"
    expect(screen.getByText('민 ♥ 짝꿍')).toBeTruthy();
  });

  it('로그별 스위치 초기값 = resolveLogEnabled (영속 false면 off, 미존재면 on)', () => {
    setup({ logs: twoLogs, prefs: { master: true, perLog: { r1: false } } });
    expect(screen.getByLabelText('맛집노트 알림').props.accessibilityState.checked).toBe(false); // 명시 false
    expect(screen.getByLabelText('민 ♥ 짝꿍 알림').props.accessibilityState.checked).toBe(true); // 미존재 → on
  });

  it('로그별 스위치 탭 → setLogEnabled({roomId, enabled}) (해당 roomId만)', () => {
    setup({ logs: twoLogs });
    fireEvent.press(screen.getByLabelText('맛집노트 알림'));
    expect(setLogEnabled).toHaveBeenCalledWith({ roomId: 'r1', enabled: false });
  });
});

describe('NotifSettingsScreen — 마스터 게이트 (T6)', () => {
  it('마스터 off → 로그별 스위치 disabled(탭해도 setLogEnabled 미호출)', () => {
    setup({ logs: [{ roomId: 'r1', name: '맛집노트', memberCount: 1 }], prefs: { master: false, perLog: {} } });
    const logSwitch = screen.getByLabelText('맛집노트 알림');
    expect(logSwitch.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(logSwitch);
    expect(setLogEnabled).not.toHaveBeenCalled();
  });
});

describe('NotifSettingsScreen — 빈/로딩/에러 (T8)', () => {
  it('로그 0건 → 빈 안내 + 마스터는 정상 동작', () => {
    setup({ logs: [] });
    expect(screen.getByText('아직 참여한 로그가 없어요')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('새 먹로그 알림'));
    expect(setMaster).toHaveBeenCalled();
  });

  it('로그 loading → 로딩 인디케이터 표시', () => {
    setup({ logsStatus: 'loading' });
    expect(screen.getByTestId('notif-logs-loading')).toBeTruthy();
  });

  it('로그 error → 빈 안내로 흡수(크래시 없음, 마스터 동작)', () => {
    setup({ logsStatus: 'error' });
    expect(screen.getByText('아직 참여한 로그가 없어요')).toBeTruthy();
    expect(screen.getByLabelText('새 먹로그 알림')).toBeTruthy();
  });
});
