// src/navigation/useStartLogFlow/useStartLogFlow.spec.tsx
// 로그 시작 플로우 단일 출처 훅 명세 (ux-entry-trust §5 T1, U1).
//   "어디서 만들든 초대코드를 한 번 본다" = createRoom → refresh → RoomCreated 축하화면.
//   두 소비처(PlusHeaderButton·LogListScreen)가 이 훅만 쓰므로 여기서 계약을 잠근다.
//   useCreateRoom·useMyLogsContext·navigate·Alert 모킹. errors(mapRoomError)는 실 구현.
import { Alert } from 'react-native';
import { renderHook } from '@testing-library/react-native';

// 배럴 모킹: 순수 errors는 실 구현(mapRoomError 메시지), 훅/컨텍스트만 모킹(supabase 비유입).
jest.mock('@/features/room', () => {
  const errors = jest.requireActual('@/features/room/errors');
  return { ...errors, useCreateRoom: jest.fn(), useMyLogsContext: jest.fn() };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { useCreateRoom, useMyLogsContext } from '@/features/room';
import { Routes } from '../routes';
import { useStartLogFlow } from './useStartLogFlow';

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
  refresh.mockResolvedValue(undefined);
  mockNavigate.mockReset();
  setupHooks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('useStartLogFlow — createLog(생성 → 갱신 → 축하화면)', () => {
  it('createRoom()을 무인자로 호출하고 refresh 후 RoomCreated로 초대코드를 넘긴다', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    const { result } = renderHook(() => useStartLogFlow());

    await result.current.createLog();

    expect(createRoom).toHaveBeenCalledWith();
    expect(refresh).toHaveBeenCalledTimes(1);
    // ⚠️ 경계면: useCreateRoom의 inviteCode → 라우트 파라미터 code로 이름이 바뀌는 유일한 지점.
    expect(mockNavigate).toHaveBeenCalledWith(Routes.RoomCreated, {
      roomId: 'r1',
      code: 'ABCDEF',
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('생성 → 갱신 → 이동 순서를 지킨다(목록이 최신인 채로 복귀)', async () => {
    const order: string[] = [];
    createRoom.mockImplementationOnce(async () => {
      order.push('createRoom');
      return { roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' };
    });
    refresh.mockImplementationOnce(async () => {
      order.push('refresh');
    });
    mockNavigate.mockImplementationOnce(() => {
      order.push('navigate');
    });
    const { result } = renderHook(() => useStartLogFlow());

    await result.current.createLog();

    expect(order).toEqual(['createRoom', 'refresh', 'navigate']);
  });

  it('createRoom 실패 시 Alert(매핑 메시지)만 발생하고 refresh·navigate는 없다', async () => {
    createRoom.mockRejectedValueOnce(new Error('CODE_GENERATION_FAILED'));
    const { result } = renderHook(() => useStartLogFlow());

    await result.current.createLog();

    expect(refresh).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('로그를 만들지 못했어요');
    expect(lastCall?.[1]).toBe('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('refresh가 reject해도(방어적) Alert 1회로 흡수하고 navigate하지 않는다', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF', mode: 'couple' });
    refresh.mockRejectedValueOnce(new Error('LIST_FAILED'));
    const { result } = renderHook(() => useStartLogFlow());

    await result.current.createLog();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('createLog()가 반환한 promise는 reject하지 않는다(호출부 void 안전)', async () => {
    createRoom.mockRejectedValueOnce(new Error('CODE_GENERATION_FAILED'));
    const { result } = renderHook(() => useStartLogFlow());

    await expect(result.current.createLog()).resolves.toBeUndefined();
  });
});

describe('useStartLogFlow — goToJoin / creating', () => {
  it('goToJoin()은 JoinLog로만 이동하고 생성하지 않는다', () => {
    const { result } = renderHook(() => useStartLogFlow());

    result.current.goToJoin();

    expect(mockNavigate).toHaveBeenCalledWith(Routes.JoinLog);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('useCreateRoom.loading을 creating으로 그대로 노출한다(소비처 비활성 판단 근거)', () => {
    setupHooks({ creating: true });
    const { result } = renderHook(() => useStartLogFlow());

    expect(result.current.creating).toBe(true);
  });

  it('기본 상태에서는 creating이 false다', () => {
    const { result } = renderHook(() => useStartLogFlow());

    expect(result.current.creating).toBe(false);
  });
});
