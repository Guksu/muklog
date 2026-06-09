// src/navigation/screens/OnboardingScreen.spec.tsx
// 화면 핵심 흐름 — step 전이, 입력 정규화 반영, 입장/생성 호출 계약, 전이(reset+refresh), 에러 노출.
// (plan §5-1 (6), C5·C8) 훅/네비/clipboard는 모킹, 정규화 유틸은 실 구현 사용.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// @/features/room: code.ts의 실 유틸은 사용하고(정규화 반영 검증), 훅 3종만 모킹.
jest.mock('@/features/room', () => {
  const code = jest.requireActual('@/features/room/code');
  return {
    ...code,
    useCreateRoom: jest.fn(),
    useJoinRoom: jest.fn(),
    useMembershipContext: jest.fn(),
  };
});

// 네비게이션: reset만 필요(type import는 런타임 소거).
// jest.mock 팩토리 호이스팅 제약 → 변수명 mock 프리픽스 필요.
const mockNavReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockNavReset }),
}));

// 클립보드: 우리 코드의 호출만 검증(SDK 내부 동작 미검증).
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));

import * as Clipboard from 'expo-clipboard';
import { useCreateRoom, useJoinRoom, useMembershipContext } from '@/features/room';
import { OnboardingScreen } from './OnboardingScreen';

const useCreateRoomMock = useCreateRoom as jest.Mock;
const useJoinRoomMock = useJoinRoom as jest.Mock;
const useMembershipContextMock = useMembershipContext as jest.Mock;
const setStringAsync = Clipboard.setStringAsync as jest.Mock;

const refresh = jest.fn();
const createRoom = jest.fn();
const joinRoom = jest.fn();

// 훅 반환 기본값을 케이스에서 덮어쓸 수 있게 헬퍼로 구성.
const setupHooks = (overrides?: {
  create?: Partial<{ loading: boolean; error: string | null }>;
  join?: Partial<{ loading: boolean; error: string | null }>;
}) => {
  useCreateRoomMock.mockReturnValue({
    createRoom,
    loading: overrides?.create?.loading ?? false,
    error: overrides?.create?.error ?? null,
  });
  useJoinRoomMock.mockReturnValue({
    joinRoom,
    loading: overrides?.join?.loading ?? false,
    error: overrides?.join?.error ?? null,
  });
  useMembershipContextMock.mockReturnValue({ state: { status: 'no-room' }, refresh });
};

beforeEach(() => {
  mockNavReset.mockReset();
  setStringAsync.mockClear();
  refresh.mockReset();
  createRoom.mockReset();
  joinRoom.mockReset();
  useCreateRoomMock.mockReset();
  useJoinRoomMock.mockReset();
  useMembershipContextMock.mockReset();
  setupHooks();
});

describe('OnboardingScreen — choose step', () => {
  it('초기 렌더에 "방 만들기"·"초대코드 입력" 버튼이 보인다', () => {
    renderWithTheme(<OnboardingScreen />);
    expect(screen.getByText('방 만들기')).toBeTruthy();
    expect(screen.getByText('초대코드 입력')).toBeTruthy();
  });

  it('"초대코드 입력"을 누르면 join step(입장 버튼)으로 전이한다', () => {
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('초대코드 입력'));
    expect(screen.getByText('입장')).toBeTruthy();
    expect(screen.getByText('받은 6자리 초대코드를 입력하세요')).toBeTruthy();
  });
});

describe('OnboardingScreen — join step', () => {
  const goToJoin = () => {
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('초대코드 입력'));
    return screen.getByPlaceholderText('─'.repeat(6));
  };

  it('입력이 정규화되어 화면에 반영된다 (소문자→대문자, 혼동문자 제거)', () => {
    const input = goToJoin();
    fireEvent.changeText(input, 'ab0o1icd'); // 0,O,1,I 제거 → ABCD
    expect(input.props.value).toBe('ABCD');
  });

  it('6자 미만이면 "입장"이 비활성, 6자면 활성', () => {
    const input = goToJoin();
    fireEvent.changeText(input, 'ABC');
    expect(screen.getByRole('button', { name: '입장' }).props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(input, 'ABCDEF');
    expect(screen.getByRole('button', { name: '입장' }).props.accessibilityState.disabled).toBe(false);
  });

  it('6자 입력 후 "입장" → joinRoom({code}) 호출, 성공 시 reset(RoomTabs)+refresh (C8)', async () => {
    joinRoom.mockResolvedValueOnce({ roomId: 'r1' });
    const input = goToJoin();
    fireEvent.changeText(input, 'ABCDEF');
    fireEvent.press(screen.getByRole('button', { name: '입장' }));

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalledWith({ code: 'ABCDEF' });
    });
    expect(mockNavReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'RoomTabs' }] });
    expect(refresh).toHaveBeenCalled();
  });

  it('joinError가 있으면 인라인 메시지를 노출하고 join step을 유지한다', () => {
    setupHooks({ join: { error: '초대코드를 다시 확인해 주세요.' } });
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('초대코드 입력'));

    expect(screen.getByText('초대코드를 다시 확인해 주세요.')).toBeTruthy();
    expect(screen.getByText('입장')).toBeTruthy(); // step 유지
  });
});

describe('OnboardingScreen — create-result step', () => {
  it('"방 만들기" 성공 시 코드 표시 + "방으로 가기" 노출', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF' });
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('방 만들기'));

    await waitFor(() => {
      expect(screen.getByText('ABCDEF')).toBeTruthy();
    });
    expect(screen.getByText('방으로 가기')).toBeTruthy();
  });

  it('"코드 복사" → Clipboard.setStringAsync(코드) 호출 + 라벨 "복사됨"으로 전환', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF' });
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('방 만들기'));
    await waitFor(() => screen.getByText('코드 복사'));

    fireEvent.press(screen.getByText('코드 복사'));
    await waitFor(() => {
      expect(setStringAsync).toHaveBeenCalledWith('ABCDEF');
    });
    expect(screen.getByText('복사됨')).toBeTruthy();
  });

  it('create-result에서 "방으로 가기" → reset(RoomTabs)+refresh', async () => {
    createRoom.mockResolvedValueOnce({ roomId: 'r1', inviteCode: 'ABCDEF' });
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('방 만들기'));
    await waitFor(() => screen.getByText('방으로 가기'));

    fireEvent.press(screen.getByText('방으로 가기'));
    expect(mockNavReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'RoomTabs' }] });
    expect(refresh).toHaveBeenCalled();
  });

  it('create 실패 시 createError 메시지를 노출하고 choose step을 유지한다', async () => {
    createRoom.mockRejectedValueOnce(new Error('CODE_GENERATION_FAILED'));
    setupHooks({ create: { error: '코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.' } });
    renderWithTheme(<OnboardingScreen />);
    fireEvent.press(screen.getByText('방 만들기'));

    await waitFor(() => {
      expect(screen.getByText('코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.')).toBeTruthy();
    });
    // choose step 유지(코드 표시 안 됨)
    expect(screen.queryByText('방으로 가기')).toBeNull();
  });
});
