// src/navigation/screens/MuklogEditorRoute.spec.tsx
// 에디터 컨테이너 배선 — useRoute(roomId, muklogId?) → 작성/편집 분기(FLAG-1).
//   작성: muklogId 없음 → MuklogEditor(initial 없음), onBack/onSaved=goBack.
//   편집: muklogId 있음 → useMuklog 프리필(loading/error 처리), ready 시 MuklogEditor(initial) + onSubmit=useUpdateMuklog(initialPhotos).
//   MuklogEditor는 probe로 대체(비주얼은 자체 spec).
import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockGoBack = jest.fn();
let mockRouteParams: { roomId: string; muklogId?: string } = { roomId: 'r1' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockUseMuklog = jest.fn();
const refresh = jest.fn();
const mockUpdateMuklog = jest.fn();
let lastEditorProps: Record<string, unknown> = {};
jest.mock('@/features/muklog', () => {
  const { Pressable, Text } = require('react-native');
  return {
    useMuklog: (arg: unknown) => mockUseMuklog(arg),
    useUpdateMuklog: () => ({ updateMuklog: mockUpdateMuklog, loading: false, error: null }),
    usePlaceSearch: () => ({ query: '', setQuery: jest.fn(), status: 'idle', results: [], errorMessage: null }),
    usePlaceSelection: () => ({ selectedPlace: null, selectPlace: jest.fn(), clearPlace: jest.fn() }),
    // MuklogEditor probe — initial 유무(작성/편집) + onBack/onSaved/onSubmit 배선만 노출.
    MuklogEditor: (props: Record<string, unknown>) => {
      lastEditorProps = props;
      return (
        <>
          <Text>{`editor:${props.initial ? 'edit' : 'create'}`}</Text>
          <Pressable accessibilityLabel="probe-back" onPress={props.onBack as () => void} />
          <Pressable accessibilityLabel="probe-saved" onPress={props.onSaved as () => void} />
          <Pressable
            accessibilityLabel="probe-submit"
            onPress={async () => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 테스트 probe: 명명 파라미터 타입은 jest.mock hoist가 거부.
              const onSubmit = props.onSubmit as Function;
              await onSubmit({
                input: {
                  muklogId: 'm1',
                  roomId: 'r1',
                  placeName: '바뀐이름',
                  category: null,
                  area: null,
                  rating: null,
                  memo: null,
                  visitedAt: '2026-02-14',
                  photos: [],
                  kakaoPlaceId: null,
                  address: null,
                  roadAddress: null,
                  lat: null,
                  lng: null,
                },
              });
            }}
          />
        </>
      );
    },
  };
});

import { MuklogEditorRoute } from './MuklogEditorRoute';

const readyMuklog = () => ({
  status: 'ready' as const,
  muklog: {
    id: 'm1',
    roomId: 'r1',
    placeName: '트라토리아 보나',
    category: 'pasta',
    area: '연남동',
    rating: 4,
    memo: '메모',
    visitedAt: '2026-02-14',
    kakaoPlaceId: 'k1',
    address: '서울 마포구 연남동 227-15',
    roadAddress: '서울 마포구 월드컵북로 39',
    lat: 37.56,
    lng: 126.92,
    photos: [{ storagePath: 'r1/m1/a.jpg', orderIndex: 0, uri: 'http://signed/a' }],
    photoStoragePaths: ['r1/m1/a.jpg'],
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  lastEditorProps = {};
  mockRouteParams = { roomId: 'r1' };
  mockUseMuklog.mockReturnValue({ state: { status: 'loading' }, refresh });
  mockUpdateMuklog.mockResolvedValue({ id: 'm1' });
});

describe('MuklogEditorRoute — 작성 모드(muklogId 없음)', () => {
  it('initial 없는 MuklogEditor를 렌더한다(작성)', () => {
    renderWithTheme(<MuklogEditorRoute />);
    expect(screen.getByText('editor:create')).toBeTruthy();
  });

  it('onBack/onSaved 모두 goBack을 호출한다', () => {
    renderWithTheme(<MuklogEditorRoute />);
    fireEvent.press(screen.getByLabelText('probe-back'));
    fireEvent.press(screen.getByLabelText('probe-saved'));
    expect(mockGoBack).toHaveBeenCalledTimes(2);
  });

  it('작성 모드는 useMuklog(프리필 조회)를 호출하지 않는다', () => {
    renderWithTheme(<MuklogEditorRoute />);
    expect(mockUseMuklog).not.toHaveBeenCalled();
  });
});

describe('MuklogEditorRoute — 편집 모드(muklogId 있음)', () => {
  beforeEach(() => {
    mockRouteParams = { roomId: 'r1', muklogId: 'm1' };
  });

  it('프리필 조회 중에는 로딩만 표시한다(에디터 미마운트)', () => {
    mockUseMuklog.mockReturnValue({ state: { status: 'loading' }, refresh });
    renderWithTheme(<MuklogEditorRoute />);
    expect(screen.getByTestId('editor-prefill-loading')).toBeTruthy();
    expect(screen.queryByText('editor:edit')).toBeNull();
  });

  it('조회 실패/notFound면 에러 + 돌아가기를 표시한다', () => {
    mockUseMuklog.mockReturnValue({ state: { status: 'notFound' }, refresh });
    renderWithTheme(<MuklogEditorRoute />);
    expect(screen.getByLabelText('돌아가기')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('돌아가기'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('ready 시 initial을 가진 MuklogEditor(편집)를 렌더한다', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    renderWithTheme(<MuklogEditorRoute />);
    expect(screen.getByText('editor:edit')).toBeTruthy();
    const initial = lastEditorProps.initial as { placeName: string; photos: unknown[] };
    expect(initial.placeName).toBe('트라토리아 보나');
    expect(initial.photos).toEqual([
      { storagePath: 'r1/m1/a.jpg', orderIndex: 0, uri: 'http://signed/a' },
    ]);
  });

  it('onSubmit → useUpdateMuklog(input + initialPhotos) 호출', async () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    renderWithTheme(<MuklogEditorRoute />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-submit'));
    });

    expect(mockUpdateMuklog).toHaveBeenCalledTimes(1);
    const arg = mockUpdateMuklog.mock.calls[0][0] as {
      input: { placeName: string };
      initialPhotos: { storagePath: string; orderIndex: number }[];
    };
    expect(arg.input.placeName).toBe('바뀐이름');
    expect(arg.initialPhotos).toEqual([
      { storagePath: 'r1/m1/a.jpg', orderIndex: 0, uri: 'http://signed/a' },
    ]);
  });

  it('onSaved → goBack(상세 복귀)', () => {
    mockUseMuklog.mockReturnValue({ state: readyMuklog(), refresh });
    renderWithTheme(<MuklogEditorRoute />);
    fireEvent.press(screen.getByLabelText('probe-saved'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
