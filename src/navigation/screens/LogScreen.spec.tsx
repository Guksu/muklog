// src/navigation/screens/LogScreen.spec.tsx
// 로그 진입(B2) — useRoom 조회 → 헤더(아바타 겹침+로그명) + 초대영역(솔로 InviteCodeCard / 커플 컴팩트 코드행) 분기.
//   로딩/에러/roomId 누락 방어 + MuklogList 마운트. (plan §5 B2 / §6.1). ⚠️ AC3: 커플도 코드 노출(plan §118).
import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockParams: { current: unknown } = { current: { roomId: 'r1' } };
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams.current }),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

// safe-area: 헤더 top inset 동적 반영(킷 MK_STATUS_PAD=56 고정 → insets.top 번역) 검증용으로 가변 모킹.
//   네이티브 헤더 OFF(headerShown:false)로 사라진 top inset을 자체 헤더가 보전하는지 lock.
const mockTopInset: { current: number } = { current: 0 };
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: mockTopInset.current, bottom: 0, left: 0, right: 0 }),
  };
});

// 배럴 모킹: useRoom만 모킹(supabase 비유입). 나머지 순수 export는 실 구현 유지.
jest.mock('@/features/room', () => {
  const actual = jest.requireActual('@/features/room/code');
  return { ...actual, useRoom: jest.fn() };
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

// auth: meId 제공(작성자 라벨 파생용). MuklogList는 더블로 대체(supabase 비유입, 자체 spec에서 검증).
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ state: { status: 'authenticated', userId: 'me-uid' } }),
}));

// 본인 프로필(헤더 로그명/아바타). 배럴만 모킹 — Avatar의 avatarDefault(서브모듈)는 실 구현 사용.
jest.mock('@/features/profile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/muklog', () => {
  const { View, Text } = require('react-native');
  return {
    MuklogList: ({ roomId, meId }: { roomId: string; meId: string }) => (
      <View accessibilityLabel="muklog-list">
        <Text>{`list:${roomId}:${meId}`}</Text>
      </View>
    ),
  };
});

import { fireEvent } from '@testing-library/react-native';

import { useRoom } from '@/features/room';
import { useProfile } from '@/features/profile';
import { LogScreen } from './LogScreen';

const useRoomMock = useRoom as jest.Mock;
const useProfileMock = useProfile as jest.Mock;
const refresh = jest.fn();

const setRoomState = (state: unknown) => {
  useRoomMock.mockReturnValue({ state, refresh });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGoBack.mockClear();
  mockTopInset.current = 0;
  mockParams.current = { roomId: 'r1' };
  setRoomState({ status: 'loading' });
  useProfileMock.mockReturnValue({
    state: { status: 'ready', profile: { nickname: '민지', avatarUrl: null } },
    refresh: jest.fn(),
  });
});

describe('LogScreen', () => {
  it('roomId가 없으면(직접 진입) 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = {};
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('params 자체가 undefined여도 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = undefined;
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('loading 상태면 로더를 표시한다', () => {
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByTestId('logscreen-loading')).toBeTruthy();
  });

  it('error 상태면 메시지 + 다시 시도 버튼을 표시하고 코드를 노출하지 않는다 (AC5)', () => {
    setRoomState({ status: 'error', message: '이 로그에 접근할 권한이 없어요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('이 로그에 접근할 권한이 없어요.')).toBeTruthy();
    expect(screen.getByLabelText('다시 시도')).toBeTruthy();
  });

  it('솔로(memberCount=1)면 💌 초대 배너(헤딩+설명+InviteCode 코드)와 "{닉}의 기록" 로그명을 표시한다 (AC1·B2·킷 mk-log:33-45)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('ABCDEF')).toBeTruthy();
    // 킷 배너: 헤딩 + 설명문(이전 "초대코드로 짝꿍을 초대하세요" 평문 교체).
    expect(screen.getByText('연인을 초대해보세요')).toBeTruthy();
    expect(
      screen.getByText('이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요.'),
    ).toBeTruthy();
    expect(screen.getByText('💌')).toBeTruthy();
    expect(screen.getByText('민지의 기록')).toBeTruthy();
  });

  it('커플(memberCount=2)이면 컴팩트 코드 행(코드+복사)과 "{닉} ♥ 짝꿍" 로그명을 표시한다 (B2)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    // B2: 커플은 코드를 숨기지 않고 컴팩트 1줄로 노출(plan §118).
    expect(screen.getByText('초대코드 ABCDEF')).toBeTruthy();
    expect(screen.getByLabelText('초대코드 복사')).toBeTruthy();
    expect(screen.getByText('민지 ♥ 짝꿍')).toBeTruthy();
    expect(screen.queryByText('둘이 함께 기록 중이에요')).toBeNull();
  });

  it('ready면 placeholder 대신 MuklogList(roomId·meId 전달)를 마운트한다 (T11 통합)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.queryByText('맛집 기록은 곧 추가돼요 🍽️')).toBeNull();
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
    expect(screen.getByText('list:r1:me-uid')).toBeTruthy();
  });

  it('커플이어도 MuklogList를 동일하게 마운트한다 (커플/솔로 무관)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
  });

  // 회귀(픽스4 헤더): 네이티브 헤더 headerShown:false로 끄면서 사라진 top inset을 자체 헤더가 보전.
  //   킷 MK_STATUS_PAD=56(시뮬레이터 근사 고정)을 RN에선 useSafeAreaInsets().top으로 동적 번역해야 노치/다이나믹 아일랜드 미겹침.
  //   HomeHeader와 동일 패턴(insets.top + spacing[8])을 lock — inset이 커지면 paddingTop도 그만큼 커진다.
  it('헤더 paddingTop이 safe-area top inset을 반영한다 (회귀: 노치/다이나믹 아일랜드 겹침)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });

    mockTopInset.current = 0;
    const { unmount } = renderWithTheme(<LogScreen />);
    const padNoInset = StyleSheet.flatten(screen.getByTestId('logscreen-header').props.style).paddingTop;
    unmount();

    const inset = 59;
    mockTopInset.current = inset;
    renderWithTheme(<LogScreen />);
    const padWithInset = StyleSheet.flatten(screen.getByTestId('logscreen-header').props.style).paddingTop;

    // inset>0이면 paddingTop이 정확히 그만큼(=inset) 커진다(상수 베이스 + insets.top).
    expect(padWithInset).toBe(padNoInset + inset);
  });

  it('헤더에 뒤로가기 버튼이 있고 탭하면 navigation.goBack을 호출한다 (킷 mk-log:19)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    const back = screen.getByLabelText('뒤로 가기');
    expect(back).toBeTruthy();
    fireEvent.press(back);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
