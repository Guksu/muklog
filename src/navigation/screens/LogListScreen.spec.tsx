// src/navigation/screens/LogListScreen.spec.tsx
// 내 로그 목록 화면 — loading/error/empty/list 4분기 + ui-redesign 충실화(카드 골격·하단 CTA·빈상태).
// (plan §4.5 / §5 T8, C2·C9·C10·C11) useMyLogsContext·useCreateRoom·useNavigation 모킹. formatLogDate 등 유틸은 실 구현.
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 errors/logName(displayLogName)은 실 구현 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  const logName = jest.requireActual('@/features/room/logName');
  return { ...errors, ...logName, useMyLogsContext: jest.fn(), useCreateRoom: jest.fn() };
});

// 본인 프로필(카드/CTA 닉네임 표시)
jest.mock('@/features/profile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

const mockNavigate = jest.fn();
// useFocusEffect: 마운트 시 콜백 1회 실행(첫 포커스). refireFocus로 재포커스(로그 삭제/나가기 후 복귀) 흉내.
let lastFocusCb: (() => void) | null = null;
const refireFocus = () => lastFocusCb?.();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    const ReactLib = require('react');
    ReactLib.useEffect(() => {
      lastFocusCb = cb;
      cb();
    }, [cb]);
  },
}));

import { useMyLogsContext, useCreateRoom } from '@/features/room';
import { useProfile } from '@/features/profile';
import { useAuth } from '@/features/auth';
import { LogListScreen } from './LogListScreen';
import { Routes } from '../routes';

const useMyLogsContextMock = useMyLogsContext as jest.Mock;
const useCreateRoomMock = useCreateRoom as jest.Mock;
const useProfileMock = useProfile as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

const refresh = jest.fn();
const createRoom = jest.fn();

const log = (over?: Partial<{
  roomId: string;
  mode: string;
  memberCount: number;
  createdAt: string;
  joinedAt: string;
  name: string | null;
}>) => ({
  roomId: 'r1',
  mode: 'couple',
  memberCount: 2,
  createdAt: '2026-06-10T00:00:00.000Z',
  joinedAt: '2026-06-10T01:00:00.000Z',
  name: null,
  ...over,
});

const setupCommon = () => {
  useAuthMock.mockReturnValue({ state: { status: 'authenticated', userId: 'u1' }, retry: jest.fn() });
  useProfileMock.mockReturnValue({
    state: { status: 'ready', profile: { nickname: '민지', avatarUrl: null } },
    refresh: jest.fn(),
  });
  useCreateRoomMock.mockReturnValue({ createRoom, loading: false, error: null });
};

beforeEach(() => {
  jest.clearAllMocks();
  refresh.mockReset();
  createRoom.mockReset();
  setupCommon();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('LogListScreen — 포커스 재조회(로그 삭제/나가기 후 정합)', () => {
  it('첫 포커스(마운트)에선 refresh를 호출하지 않는다(Provider 초기 로드와 중복 방지)', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [log()] }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('재포커스(다른 화면서 복귀) 시 refresh로 목록을 갱신한다 — 삭제된 로그가 즉시 빠진다', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [log()] }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(refresh).not.toHaveBeenCalled();
    refireFocus();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('LogListScreen — 상태 분기', () => {
  it('loading이면 스피너(testID loglist-loading)를 표시한다', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'loading' }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByTestId('loglist-loading')).toBeTruthy();
  });

  it('error면 메시지 + "다시 시도"를 표시하고, 누르면 refresh를 호출한다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'error', message: '로그 목록을 불러오지 못했어요. 다시 시도해 주세요.' },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('로그 목록을 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });

  it('ready & 빈 배열이면 빈 상태(에러 아님)를 표시한다 (C9)', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('아직 로그가 없어요')).toBeTruthy();
    // mk-home EmptyLogs 재현: "로그 만들기" primary 버튼 노출
    expect(screen.getByText('로그 만들기')).toBeTruthy();
  });

  it('빈 상태의 "로그 만들기"를 누르면 createRoom→refresh를 호출한다', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByText('로그 만들기'));
    await waitFor(() => expect(createRoom).toHaveBeenCalledWith());
    expect(refresh).toHaveBeenCalled();
  });
});

describe('LogListScreen — 카드(list)', () => {
  it('멤버 2명이면 "둘이" 배지, 1명이면 "혼자" 배지를 보인다 (C2 파생)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: {
        status: 'ready',
        logs: [
          log({ roomId: 'r1', memberCount: 2 }),
          log({ roomId: 'r2', memberCount: 1, createdAt: '2026-06-09T00:00:00.000Z' }),
        ],
      },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('둘이')).toBeTruthy();
    expect(screen.getByText('혼자')).toBeTruthy();
  });

  it('커플 로그면 본인 디폴트 아바타 + 익명 파트너 아바타(🙂)를 겹쳐 보인다 (B4)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', memberCount: 2 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    // 본인=userId 디폴트 아바타(url 없음), 파트너=익명.
    expect(screen.getByTestId('avatar-default')).toBeTruthy();
    expect(screen.getByTestId('avatar-anonymous')).toBeTruthy();
  });

  it('솔로 로그면 파트너 아바타가 없다 (B4)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', memberCount: 1 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.queryByTestId('avatar-anonymous')).toBeNull();
  });

  it('커플 카드도 "YYYY.MM.DD 시작" 고정 포맷이다(sinceLabel Date.now 비결정 회피, 솔로와 통일)', () => {
    useMyLogsContextMock.mockReturnValue({
      // memberCount 2 = 커플. 킷은 "함께한 지 N일"이나 RN은 결정적 "시작" 포맷으로 통일.
      state: { status: 'ready', logs: [log({ memberCount: 2, createdAt: '2026-06-10T00:00:00.000Z' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('2026.06.10 시작')).toBeTruthy();
    expect(screen.queryByText(/함께한 지/)).toBeNull();
  });

  it('카드를 누르면 LogScreen으로 roomId를 전달하며 이동한다 (C10)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r-tap' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByLabelText('로그 열기'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.LogScreen, { roomId: 'r-tap' });
  });

  it('카드에 텍스트 글리프(›) 대신 chevron-right 아이콘을 쓴다 (AC-9)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByTestId('icon-chevron-right')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
  });

  it('카드 푸터에 count-free 중립 카피를 표시한다(거짓 카운트 단언 없음, QA Q9)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('맛집을 기록해보세요')).toBeTruthy();
    // 거짓 음성("없어요") 카피는 제거됨.
    expect(screen.queryByText('아직 기록한 맛집이 없어요')).toBeNull();
  });

  it('log.name이 있으면 카드 제목으로 이름을 그대로 표시한다 (T7·displayLogName)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', name: '우리 맛집', memberCount: 2 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
    // 이름이 있으면 폴백("민지 ♥ 짝꿍")은 안 보인다.
    expect(screen.queryByText('민지 ♥ 짝꿍')).toBeNull();
  });

  it('log.name=null & 커플이면 "{본인닉} ♥ 짝꿍" 폴백 제목을 표시한다 (T7)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', name: null, memberCount: 2 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('민지 ♥ 짝꿍')).toBeTruthy();
  });

  it('log.name=null & 솔로면 "{본인닉}의 기록" 폴백 제목을 표시한다 (T7)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', name: null, memberCount: 1 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('민지의 기록')).toBeTruthy();
  });

  it('카드 하단에 "새 로그 시작하기" CTA가 있고, 누르면 createRoom→refresh를 호출한다', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r2', inviteCode: 'ZZZZZZ', mode: 'couple' });
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1' })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByText('새 로그 시작하기'));
    await waitFor(() => expect(createRoom).toHaveBeenCalledWith());
    expect(refresh).toHaveBeenCalled();
  });
});
