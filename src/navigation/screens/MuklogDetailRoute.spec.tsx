// src/navigation/screens/MuklogDetailRoute.spec.tsx
// 상세 컨테이너 배선 — useRoute(muklogId) → useMuklog → MuklogDetailScreen props 전달(plan §4, ui-spec §2).
//   useMuklog state 그대로 전달, meId(useAuth)·meAvatarUrl(useProfile)·onBack(mockGoBack)·onRetry(refresh) 배선.
//   MuklogDetailScreen은 probe로 대체(props만 검증) — 비주얼은 자체 spec.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockGoBack = jest.fn();
let mockRouteParams: { muklogId?: string } | undefined = { muklogId: 'm1' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockUseMuklog = jest.fn();
const refresh = jest.fn();
jest.mock('@/features/muklog', () => ({ useMuklog: (a: unknown) => mockUseMuklog(a) }));

const mockUseAuth = jest.fn();
jest.mock('@/features/auth', () => ({ useAuth: () => mockUseAuth() }));

const mockUseProfile = jest.fn();
jest.mock('@/features/profile', () => ({ useProfile: (a: unknown) => mockUseProfile(a) }));

// MuklogDetailScreen probe — 받은 props를 외부로 노출(렌더 트리에 직렬화).
let lastProps: Record<string, unknown> = {};
jest.mock('./MuklogDetailScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    MuklogDetailScreen: (props: Record<string, unknown>) => {
      lastProps = props;
      return (
        <>
          <Text>{`status:${(props.state as { status: string }).status}`}</Text>
          <Text>{`meId:${props.meId}`}</Text>
          <Text>{`avatar:${props.meAvatarUrl}`}</Text>
          <Pressable accessibilityLabel="probe-back" onPress={props.onBack as () => void} />
          <Pressable accessibilityLabel="probe-retry" onPress={props.onRetry as () => void} />
        </>
      );
    },
  };
});

import { MuklogDetailRoute } from './MuklogDetailRoute';

beforeEach(() => {
  jest.clearAllMocks();
  lastProps = {};
  mockRouteParams = { muklogId: 'm1' };
  mockUseMuklog.mockReturnValue({ state: { status: 'loading' }, refresh });
  mockUseAuth.mockReturnValue({ state: { status: 'authenticated', userId: 'me-uid' } });
  mockUseProfile.mockReturnValue({ state: { status: 'ready', profile: { nickname: '나', avatarUrl: 'http://a' } } });
});

describe('MuklogDetailRoute', () => {
  it('route params의 muklogId로 useMuklog를 호출한다', () => {
    render(<MuklogDetailRoute />);
    expect(mockUseMuklog).toHaveBeenCalledWith({ muklogId: 'm1' });
  });

  it('muklogId 누락 시 빈 문자열로 안전 조회한다(→ 0행 notFound)', () => {
    mockRouteParams = undefined;
    render(<MuklogDetailRoute />);
    expect(mockUseMuklog).toHaveBeenCalledWith({ muklogId: '' });
  });

  it('useMuklog state를 화면에 그대로 전달한다(ready 통과)', () => {
    mockUseMuklog.mockReturnValue({
      state: { status: 'ready', muklog: { id: 'm1', placeName: 'X', photos: [] } },
      refresh,
    });
    render(<MuklogDetailRoute />);
    expect(screen.getByText('status:ready')).toBeTruthy();
    expect((lastProps.state as { status: string }).status).toBe('ready');
  });

  it('useAuth userId를 meId로, 본인 useProfile avatarUrl을 meAvatarUrl로 전달한다', () => {
    render(<MuklogDetailRoute />);
    expect(mockUseProfile).toHaveBeenCalledWith({ userId: 'me-uid' });
    expect(screen.getByText('meId:me-uid')).toBeTruthy();
    expect(screen.getByText('avatar:http://a')).toBeTruthy();
  });

  it('미인증이면 meId는 빈 문자열, 프로필 미준비면 meAvatarUrl은 null', () => {
    mockUseAuth.mockReturnValue({ state: { status: 'unauthenticated' } });
    mockUseProfile.mockReturnValue({ state: { status: 'loading' } });
    render(<MuklogDetailRoute />);
    expect(screen.getByText('meId:')).toBeTruthy();
    expect(screen.getByText('avatar:null')).toBeTruthy();
  });

  it('onBack은 navigation.goBack, onRetry는 useMuklog.refresh를 호출한다', () => {
    render(<MuklogDetailRoute />);
    fireEvent.press(screen.getByLabelText('probe-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText('probe-retry'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
