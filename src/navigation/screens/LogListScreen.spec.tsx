// src/navigation/screens/LogListScreen.spec.tsx
// 내 로그 목록 화면 — loading/error/empty/list 4분기 + 킷 mk-home 충실화(home-fidelity):
//   LogCard(사진 4칸 스트립 / +N / 통계행 / 빈카드) · 인사 헤드라인(합계) · EmptyLogs(히어로 + 두 갈래 카드).
// (plan AC2~AC6) useMyLogsContext·useCreateRoom·useNavigation 모킹. relativeTimeLabel/displayLogName 등 유틸은 실 구현.
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 errors/logName(displayLogName)은 실 구현 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  const logName = jest.requireActual('@/features/room/logName');
  return {
    ...errors,
    ...logName,
    useMyLogsContext: jest.fn(),
    useCreateRoom: jest.fn(),
    useLogPreviewUrls: jest.fn(() => ({ urls: {} })),
  };
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
const useLogPreviewUrlsMock = (
  jest.requireMock('@/features/room') as { useLogPreviewUrls: jest.Mock }
).useLogPreviewUrls;

const refresh = jest.fn();
const createRoom = jest.fn();

const log = (over?: Partial<{
  roomId: string;
  mode: string;
  memberCount: number;
  createdAt: string;
  joinedAt: string;
  name: string | null;
  previewPaths: string[];
  spotCount: number;
  lastMuklogAt: string | null;
}>) => ({
  roomId: 'r1',
  mode: 'couple',
  memberCount: 2,
  createdAt: '2026-06-10T00:00:00.000Z',
  joinedAt: '2026-06-10T01:00:00.000Z',
  name: null,
  previewPaths: [],
  spotCount: 0,
  lastMuklogAt: null,
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
  useLogPreviewUrlsMock.mockReturnValue({ urls: {} }); // 기본: 발급된 URL 없음.
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

describe('LogListScreen — LogCard 본문 분기(빈카드 / 스트립 / +N)', () => {
  it('spotCount===0이면 빈카드(킷 mk-home:63-71)를 보이고 통계행은 없다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 0 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('아직 기록한 맛집이 없어요')).toBeTruthy();
    expect(screen.getByText('이 로그를 열어 첫 맛집을 남겨보세요')).toBeTruthy();
    expect(screen.queryByText(/맛집 \d+곳/)).toBeNull();
    // 빈카드에는 사진 슬롯이 없다.
    expect(screen.queryByTestId('log-strip')).toBeNull();
  });

  it('spotCount>0이면 사진 스트립 + 통계행("맛집 N곳")을 보인다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 3, previewPaths: ['r1/a.jpg'] })] },
      refresh,
    });
    useLogPreviewUrlsMock.mockReturnValue({ urls: { 'r1/a.jpg': 'https://s/a' } });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByTestId('log-strip')).toBeTruthy();
    expect(screen.getByText('맛집 3곳')).toBeTruthy();
    expect(screen.queryByText('아직 기록한 맛집이 없어요')).toBeNull();
  });

  it('스트립은 항상 4칸이다 — 사진 1장이면 썸네일 1 + 빈 슬롯 3', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 1, previewPaths: ['r1/a.jpg'] })] },
      refresh,
    });
    useLogPreviewUrlsMock.mockReturnValue({ urls: { 'r1/a.jpg': 'https://s/a' } });
    renderWithTheme(<LogListScreen />);
    expect(screen.getAllByTestId('log-strip-thumb')).toHaveLength(1);
    expect(screen.getAllByTestId('log-strip-empty')).toHaveLength(3);
  });

  it('signed URL이 아직 없는 path는 점선 빈 슬롯으로 떨어진다(거짓 깨진 이미지 방지)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 2, previewPaths: ['r1/a.jpg', 'r1/b.jpg'] })] },
      refresh,
    });
    useLogPreviewUrlsMock.mockReturnValue({ urls: { 'r1/a.jpg': 'https://s/a' } }); // b는 미발급
    renderWithTheme(<LogListScreen />);
    expect(screen.getAllByTestId('log-strip-thumb')).toHaveLength(1);
    expect(screen.getAllByTestId('log-strip-empty')).toHaveLength(3);
  });

  it('spotCount>4면 4번째 슬롯에 "+{spotCount-4}" 오버레이를 보인다(킷 mk-home:77-83)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: {
        status: 'ready',
        logs: [log({ spotCount: 9, previewPaths: ['a', 'b', 'c', 'd', 'e'] })],
      },
      refresh,
    });
    useLogPreviewUrlsMock.mockReturnValue({
      urls: { a: 'https://s/a', b: 'https://s/b', c: 'https://s/c', d: 'https://s/d', e: 'https://s/e' },
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('+5')).toBeTruthy(); // 9 - 4
  });

  it('spotCount===4면 오버레이가 없다(more=0)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 4, previewPaths: ['a', 'b', 'c', 'd'] })] },
      refresh,
    });
    useLogPreviewUrlsMock.mockReturnValue({
      urls: { a: 'https://s/a', b: 'https://s/b', c: 'https://s/c', d: 'https://s/d' },
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });
});

describe('LogListScreen — 통계행 마지막 기록(상대시간)', () => {
  it('lastMuklogAt이 있으면 "마지막 기록 {상대시간}"을 보인다', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 2, lastMuklogAt: yesterday })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('마지막 기록 어제')).toBeTruthy();
  });

  it('lastMuklogAt이 null이면 "기록 없음"으로 폴백(거짓 시각 금지)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 2, lastMuklogAt: null })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('기록 없음')).toBeTruthy();
  });
});

describe('LogListScreen — 인사 헤드라인 + 합계(킷 mk-home:116-122)', () => {
  it('"{닉}님, 오늘은 어디 다녀왔어요?" 헤드라인을 보인다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ spotCount: 1 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('민지님, 오늘은\n어디 다녀왔어요?')).toBeTruthy();
  });

  it('전 로그 spotCount 합을 "함께 {Σ}곳"으로 보인다', () => {
    useMyLogsContextMock.mockReturnValue({
      state: {
        status: 'ready',
        logs: [
          log({ roomId: 'r1', spotCount: 3 }),
          log({ roomId: 'r2', spotCount: 5, createdAt: '2026-06-09T00:00:00.000Z' }),
        ],
      },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('8곳')).toBeTruthy(); // 3 + 5
    // 현 단순 캡션은 제거됨
    expect(screen.queryByText('둘만의 맛집 지도를 함께 채워가요.')).toBeNull();
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
});

describe('LogListScreen — 빈 상태(EmptyLogs 히어로 + 두 갈래, 킷 mk-home:136-181)', () => {
  it('인사("{닉}님, 먹로그를 시작해볼까요?")와 두 갈래 카드를 보인다', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('민지님,\n먹로그를 시작해볼까요?')).toBeTruthy();
    expect(screen.getByText('새 로그 만들기')).toBeTruthy();
    expect(screen.getByText('초대코드로 입장')).toBeTruthy();
  });

  it('"새 로그 만들기"를 누르면 createRoom→refresh를 호출한다(onCreate)', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByText('새 로그 만들기'));
    await waitFor(() => expect(createRoom).toHaveBeenCalledWith());
    expect(refresh).toHaveBeenCalled();
  });

  it('"초대코드로 입장"을 누르면 JoinLog로 이동한다(onJoin)', () => {
    useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
    renderWithTheme(<LogListScreen />);
    fireEvent.press(screen.getByText('초대코드로 입장'));
    expect(mockNavigate).toHaveBeenCalledWith(Routes.JoinLog);
  });
});

describe('LogListScreen — 카드 헤더(아바타/배지/이름/날짜/chevron)', () => {
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

  it('"YYYY.MM.DD 시작" 고정 포맷이다(sinceLabel Date.now 비결정 회피)', () => {
    useMyLogsContextMock.mockReturnValue({
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
    expect(screen.getAllByTestId('icon-chevron-right').length).toBeGreaterThan(0);
    expect(screen.queryByText('›')).toBeNull();
  });

  it('log.name이 있으면 카드 제목으로 이름을 그대로 표시한다 (T7·displayLogName)', () => {
    useMyLogsContextMock.mockReturnValue({
      state: { status: 'ready', logs: [log({ roomId: 'r1', name: '우리 맛집', memberCount: 2 })] },
      refresh,
    });
    renderWithTheme(<LogListScreen />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
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
