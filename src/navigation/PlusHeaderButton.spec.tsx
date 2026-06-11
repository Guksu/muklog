// src/navigation/PlusHeaderButton.spec.tsx
// 헤더 +버튼 — 액션시트(AddSheet) 토글 + 생성/입장 분기 (plan §6.3 / §5 T7, AC6·AC7·AC8·AC9).
//   ⚠️ spec 갱신(의도적): 기존 "단일 생성, 화면 전환 없음" → "액션시트 + 생성 시 LogScreen navigate".
//   useCreateRoom·useMyLogsContext·navigation·Alert 모킹. errors는 실 구현(mapRoomError 메시지).
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 errors는 실 구현(mapRoomError) 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  return { ...errors, useCreateRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { useCreateRoom, useMyLogsContext } from '@/features/room';
import { PlusHeaderButton } from './PlusHeaderButton';

const useCreateRoomMock = useCreateRoom as jest.Mock;
const useMyLogsContextMock = useMyLogsContext as jest.Mock;

const createRoom = jest.fn();
const refresh = jest.fn();

const setupHooks = (overrides?: { creating?: boolean }) => {
  useCreateRoomMock.mockReturnValue({
    createRoom,
    loading: overrides?.creating ?? false,
    error: null,
  });
  useMyLogsContextMock.mockReturnValue({ state: { status: 'ready', logs: [] }, refresh });
};

const openSheet = () => {
  fireEvent.press(screen.getByLabelText('로그 만들기'));
};

beforeEach(() => {
  jest.clearAllMocks();
  createRoom.mockReset();
  refresh.mockReset();
  mockNavigate.mockReset();
  setupHooks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('PlusHeaderButton — 액션시트 + 생성/입장 분기', () => {
  it('plus 아이콘을 렌더한다(텍스트 글리프 아님)', () => {
    renderWithTheme(<PlusHeaderButton />);
    expect(screen.getByTestId('icon-plus')).toBeTruthy();
    expect(screen.queryByText('+')).toBeNull();
  });

  it('+ 탭 시 시트에 "새 로그 만들기"·"초대코드로 입장" 2개 액션이 보인다 (AC6)', () => {
    renderWithTheme(<PlusHeaderButton />);
    expect(screen.queryByText('새 로그 만들기')).toBeNull();
    openSheet();
    expect(screen.getByText('새 로그 만들기')).toBeTruthy();
    expect(screen.getByText('초대코드로 입장')).toBeTruthy();
  });

  it('"새 로그 만들기" → createRoom() → 성공 시 LogScreen navigate + refresh() (AC7)', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    renderWithTheme(<PlusHeaderButton />);

    openSheet();
    fireEvent.press(screen.getByText('새 로그 만들기'));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith();
    });
    expect(refresh).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('LogScreen', { roomId: 'r1' });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('생성 실패 시 Alert(매핑 메시지) + navigate/refresh 미발생 (AC9)', async () => {
    createRoom.mockRejectedValueOnce(new Error('CODE_GENERATION_FAILED'));
    renderWithTheme(<PlusHeaderButton />);

    openSheet();
    fireEvent.press(screen.getByText('새 로그 만들기'));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalled();
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[1]).toBe('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('"초대코드로 입장" → JoinLog 라우트로 navigate (AC8)', () => {
    renderWithTheme(<PlusHeaderButton />);

    openSheet();
    fireEvent.press(screen.getByText('초대코드로 입장'));

    expect(mockNavigate).toHaveBeenCalledWith('JoinLog');
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('creating(loading) 중에는 +버튼이 비활성이라 시트가 열리지 않는다', () => {
    setupHooks({ creating: true });
    renderWithTheme(<PlusHeaderButton />);

    fireEvent.press(screen.getByLabelText('로그 만들기'));
    expect(screen.queryByText('새 로그 만들기')).toBeNull();
  });
});
