// src/navigation/screens/MuklogDetailRoute.spec.tsx
// 상세 컨테이너 배선 — useRoute(muklogId) → useMuklog → MuklogDetailScreen props 전달(plan §4, ui-spec §2).
//   useMuklog state 그대로 전달, meId(useAuth)·meAvatarUrl(useProfile)·onBack(mockGoBack)·onRetry(refresh) 배선.
//   MuklogDetailScreen은 probe로 대체(props만 검증) — 비주얼은 자체 spec.
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams: { muklogId?: string } | undefined = { muklogId: 'm1' };
// useFocusEffect는 마운트 시 콜백 1회 실행(첫 포커스). refireFocus()로 재포커스(에디터 복귀)를 흉내낸다.
let lastFocusCallback: (() => void) | null = null;
const refireFocus = () => lastFocusCallback?.();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      lastFocusCallback = cb;
      cb();
    }, [cb]);
  },
}));

const mockUseMuklog = jest.fn();
const refresh = jest.fn();
const mockDeleteMuklog = jest.fn();
// ⚠️ FLAG-1: 편집이 시트 오버레이 → 풀스크린 에디터 라우트 이동으로 전환. 컨테이너는 useUpdateMuklog/장소훅/시트를 더는 안 씀.
jest.mock('@/features/muklog', () => ({
  useMuklog: (arg: unknown) => mockUseMuklog(arg),
  useDeleteMuklog: () => ({ deleteMuklog: mockDeleteMuklog, loading: false, error: null }),
}));

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
          <Text>{`canManage:${props.canManage}`}</Text>
          <Pressable accessibilityLabel="probe-back" onPress={props.onBack as () => void} />
          <Pressable accessibilityLabel="probe-retry" onPress={props.onRetry as () => void} />
          <Pressable accessibilityLabel="probe-edit" onPress={props.onEdit as () => void} />
          <Pressable
            accessibilityLabel="probe-delete"
            onPress={props.onConfirmDelete as () => void}
          />
        </>
      );
    },
  };
});

import { MuklogDetailRoute } from './MuklogDetailRoute';

// ready 상태 먹로그(작성자=meId 기본) — 편집/삭제 배선 테스트용.
const readyMuklog = (over?: Record<string, unknown>) => ({
  status: 'ready',
  muklog: {
    id: 'm1',
    roomId: 'r1',
    placeName: 'X',
    category: null,
    area: null,
    memo: null,
    rating: null,
    visitedAt: '2026-02-14',
    roadAddress: null,
    hasCoords: false,
    createdBy: 'me-uid',
    createdAt: '2026-02-14T00:00:00.000Z',
    // 각 photo는 자신의 storagePath를 보유(useMuklog zip) — Route가 인덱스 산술 없이 매핑.
    photos: [{ orderIndex: 0, storagePath: 'r1/m1/a.jpg', uri: 'http://signed/a' }],
    photoStoragePaths: ['r1/m1/a.jpg'],
    ...over,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  lastProps = {};
  mockRouteParams = { muklogId: 'm1' };
  mockUseMuklog.mockReturnValue({ state: { status: 'loading' }, refresh });
  mockUseAuth.mockReturnValue({ state: { status: 'authenticated', userId: 'me-uid' } });
  mockUseProfile.mockReturnValue({ state: { status: 'ready', profile: { nickname: '나', avatarUrl: 'http://a' } } });
  mockDeleteMuklog.mockResolvedValue(undefined);
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

describe('MuklogDetailRoute — 편집/삭제 배선 (plan §4·§5)', () => {
  it('작성자(createdBy===meId)면 canManage=true', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    render(<MuklogDetailRoute />);
    expect(screen.getByText('canManage:true')).toBeTruthy();
  });

  it('짝꿍 것(createdBy!==meId)이면 canManage=false', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog({ createdBy: 'partner' }), refresh });
    render(<MuklogDetailRoute />);
    expect(screen.getByText('canManage:false')).toBeTruthy();
  });

  it('loading/notFound면 canManage=false(먹로그 없음)', () => {
    mockUseMuklog.mockReturnValue({ state: { status: 'notFound' }, refresh });
    render(<MuklogDetailRoute />);
    expect(screen.getByText('canManage:false')).toBeTruthy();
  });

  it('onEdit → 풀스크린 에디터 라우트로 navigate(MuklogEditor, { roomId, muklogId }) (FLAG-1)', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    render(<MuklogDetailRoute />);
    fireEvent.press(screen.getByLabelText('probe-edit'));
    expect(mockNavigate).toHaveBeenCalledWith('MuklogEditor', { roomId: 'r1', muklogId: 'm1' });
  });

  it('재포커스(에디터 편집 후 복귀) 시 상세를 refresh한다(첫 포커스는 가드)', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    render(<MuklogDetailRoute />);
    expect(refresh).not.toHaveBeenCalled(); // 첫 포커스(마운트 로드)는 가드.
    act(() => {
      refireFocus();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('onConfirmDelete → useDeleteMuklog(photoStoragePaths) 호출 후 goBack', async () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    render(<MuklogDetailRoute />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-delete'));
    });

    expect(mockDeleteMuklog).toHaveBeenCalledWith({
      muklogId: 'm1',
      roomId: 'r1',
      photoPaths: ['r1/m1/a.jpg'],
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it('삭제 실패면 goBack하지 않는다(확인 시트 유지·재시도)', async () => {
    mockDeleteMuklog.mockRejectedValue(new Error('boom'));
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    render(<MuklogDetailRoute />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-delete'));
    });

    expect(mockDeleteMuklog).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
