// src/navigation/PlusHeaderButton.spec.tsx
// 헤더 +버튼 — 단일 "로그 생성" 액션(액션시트 없음, join UI는 log-invite로 트리밍).
//   누르면 바로 createRoom()→성공 시 refresh(), 실패 시 Alert. creating 중 비활성. (plan §4.4 / §5 T7, C11)
// useCreateRoom·useMyLogsContext·Alert 모킹. errors는 실 구현(mapRoomError 메시지).
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// 배럴 모킹: 순수 errors는 실 구현(mapRoomError) 사용, 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  return { ...errors, useCreateRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

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

beforeEach(() => {
  jest.clearAllMocks();
  createRoom.mockReset();
  refresh.mockReset();
  setupHooks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('PlusHeaderButton — 로그 생성 단일 액션', () => {
  it('accessibilityLabel "로그 만들기" 버튼을 렌더한다', () => {
    renderWithTheme(<PlusHeaderButton />);
    expect(screen.getByLabelText('로그 만들기')).toBeTruthy();
  });

  it('누르면 액션시트 없이 바로 createRoom()을 호출하고 성공 시 refresh()한다 (C11)', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    renderWithTheme(<PlusHeaderButton />);

    fireEvent.press(screen.getByLabelText('로그 만들기'));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith();
    });
    expect(refresh).toHaveBeenCalled();
    // 단일 액션 → 액션시트(Alert) 미사용(성공 경로)
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('생성 실패 시 refresh 미호출 + 에러 Alert(매핑 메시지)를 띄운다', async () => {
    createRoom.mockRejectedValueOnce(new Error('CODE_GENERATION_FAILED'));
    renderWithTheme(<PlusHeaderButton />);

    fireEvent.press(screen.getByLabelText('로그 만들기'));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalled();
    });
    expect(refresh).not.toHaveBeenCalled();
    const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[1]).toBe('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('creating(loading) 중에는 버튼이 비활성이라 createRoom을 호출하지 않는다', () => {
    setupHooks({ creating: true });
    renderWithTheme(<PlusHeaderButton />);

    fireEvent.press(screen.getByLabelText('로그 만들기'));
    expect(createRoom).not.toHaveBeenCalled();
  });
});
