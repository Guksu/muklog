// src/navigation/screens/RoomCreatedRoute.spec.tsx
// 생성 완료 컨테이너 배선 — useRoute(roomId, code) → RoomCreatedScreen에 code/onEnter/onLater 주입(FLAG-3).
//   "로그 열기" → replace(LogScreen, {roomId}) / "나중에" → goBack. RoomCreatedScreen은 probe로 대체.
//   invite-share(U72, plan R10 — AC11): 카드 "공유"·"복사" → useInviteShare의 shareInvite·copyInviteCode({ code: route.params.code }).
//     useInviteShare는 대역 — 실 배럴(@/features/room)을 불러오지 않는다(공유 시트·토스트 동작은 useInviteShare.spec).
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
  useRoute: () => ({ params: { roomId: 'r1', code: 'MK7P3A' } }),
}));

const mockShareInvite = jest.fn();
const mockCopyInviteCode = jest.fn();
jest.mock('@/features/room', () => ({
  useInviteShare: () => ({ shareInvite: mockShareInvite, copyInviteCode: mockCopyInviteCode }),
}));

jest.mock('../RoomCreatedScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoomCreatedScreen: (props: Record<string, unknown>) => (
      <>
        <Text>{`code:${props.inviteCode}`}</Text>
        <Pressable accessibilityLabel="probe-enter" onPress={props.onEnter as () => void} />
        <Pressable accessibilityLabel="probe-later" onPress={props.onLater as () => void} />
        <Pressable accessibilityLabel="probe-share" onPress={props.onShare as () => void} />
        <Pressable accessibilityLabel="probe-copy" onPress={props.onCopy as () => void} />
      </>
    ),
  };
});

import { RoomCreatedRoute } from './RoomCreatedRoute';

beforeEach(() => {
  jest.clearAllMocks();
  mockShareInvite.mockResolvedValue(undefined);
  mockCopyInviteCode.mockResolvedValue(undefined);
});

describe('RoomCreatedRoute', () => {
  it('route params의 code를 RoomCreatedScreen.inviteCode로 전달한다', () => {
    render(<RoomCreatedRoute />);
    expect(screen.getByText('code:MK7P3A')).toBeTruthy();
  });

  it('"로그 열기"(onEnter) → replace(LogScreen, { roomId })', () => {
    render(<RoomCreatedRoute />);
    fireEvent.press(screen.getByLabelText('probe-enter'));
    expect(mockReplace).toHaveBeenCalledWith('LogScreen', { roomId: 'r1' });
  });

  it('"나중에"(onLater) → goBack(홈 복귀)', () => {
    render(<RoomCreatedRoute />);
    fireEvent.press(screen.getByLabelText('probe-later'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('카드 "공유"(onShare) → shareInvite({ code: route.params.code }) 1회, 복사는 부르지 않는다 (AC11)', () => {
    render(<RoomCreatedRoute />);
    fireEvent.press(screen.getByLabelText('probe-share'));
    expect(mockShareInvite.mock.calls).toStrictEqual([[{ code: 'MK7P3A' }]]);
    expect(mockCopyInviteCode).not.toHaveBeenCalled();
  });

  it('카드 "복사"(onCopy) → copyInviteCode({ code: route.params.code }) 1회, 공유는 부르지 않는다 (AC11)', () => {
    render(<RoomCreatedRoute />);
    fireEvent.press(screen.getByLabelText('probe-copy'));
    expect(mockCopyInviteCode.mock.calls).toStrictEqual([[{ code: 'MK7P3A' }]]);
    expect(mockShareInvite).not.toHaveBeenCalled();
  });

  it('공유·복사는 화면 이동을 일으키지 않는다(축하 화면에 머문다)', () => {
    render(<RoomCreatedRoute />);
    fireEvent.press(screen.getByLabelText('probe-share'));
    fireEvent.press(screen.getByLabelText('probe-copy'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
