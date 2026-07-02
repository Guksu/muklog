// src/navigation/screens/RoomCreatedRoute.spec.tsx
// 생성 완료 컨테이너 배선 — useRoute(roomId, code) → RoomCreatedScreen에 code/onEnter/onLater 주입(FLAG-3).
//   "로그 열기" → replace(LogScreen, {roomId}) / "나중에" → goBack. RoomCreatedScreen은 probe로 대체.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace, goBack: mockGoBack }),
  useRoute: () => ({ params: { roomId: 'r1', code: 'MK7P3A' } }),
}));

jest.mock('../RoomCreatedScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoomCreatedScreen: (props: Record<string, unknown>) => (
      <>
        <Text>{`code:${props.inviteCode}`}</Text>
        <Pressable accessibilityLabel="probe-enter" onPress={props.onEnter as () => void} />
        <Pressable accessibilityLabel="probe-later" onPress={props.onLater as () => void} />
      </>
    ),
  };
});

import { RoomCreatedRoute } from './RoomCreatedRoute';

beforeEach(() => {
  jest.clearAllMocks();
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
});
