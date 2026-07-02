// src/navigation/screens/MuklogEditorRoute.spec.tsx
// 에디터 컨테이너 배선 — useRoute(roomId, muklogId?) → 작성/편집 분기(FLAG-1).
//   작성: muklogId 없음 → MuklogEditor(initial 없음), onBack/onSaved=goBack.
//   편집: muklogId 있음 → useMuklog 프리필(loading/error 처리), ready 시 MuklogEditor(initial) + onSubmit=useUpdateMuklog(initialPhotos).
//   MuklogEditor는 probe로 대체(비주얼은 자체 spec).
import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockGoBack = jest.fn();
type EditorRouteParams = {
  roomId: string;
  muklogId?: string;
  prefill?: Record<string, unknown>;
  fromWishlistId?: string;
};
let mockRouteParams: EditorRouteParams = { roomId: 'r1' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// 위시 "다녀왔어요" 생성 성공 후 삭제(B6) — 컨테이너가 호출만 검증, 훅은 자체 spec.
const mockRemoveWishlist = jest.fn();
jest.mock('@/features/wishlist', () => ({
  useRemoveWishlist: () => ({ removeWishlist: mockRemoveWishlist, loading: false, error: null }),
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
    // 위시 prefill 시드 검증을 위해 initial 인자를 그대로 selectedPlace로 반영(실 훅 동작과 동일 계약).
    usePlaceSelection: (arg: { initial?: unknown } = {}) => ({
      selectedPlace: arg?.initial ?? null,
      selectPlace: jest.fn(),
      clearPlace: jest.fn(),
    }),
    // MuklogEditor probe — initial 유무(작성/편집) + selectedPlace(prefill 시드) + onBack/onSaved/onSubmit 배선 노출.
    MuklogEditor: (props: Record<string, unknown>) => {
      lastEditorProps = props;
      const sel = props.selectedPlace as { placeName?: string } | null;
      return (
        <>
          <Text>{`editor:${props.initial ? 'edit' : 'create'}`}</Text>
          <Text>{`selected:${sel?.placeName ?? 'none'}`}</Text>
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
  mockRemoveWishlist.mockResolvedValue(undefined);
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

  it('prefill(위시 출처)이 없으면 일반 작성 — onSaved 시 removeWishlist 미호출, goBack만', async () => {
    renderWithTheme(<MuklogEditorRoute />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-saved'));
    });
    expect(mockRemoveWishlist).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('MuklogEditorRoute — 위시 "다녀왔어요" prefill(muklogId 없음 + prefill 있음, TC-5/B5·B6)', () => {
  const prefill = {
    placeName: '성수동 베이커리',
    category: 'cafe',
    area: '성수동',
    roadAddress: '서울 성동구 연무장길 1',
    lat: 37.544,
    lng: 127.055,
    kakaoPlaceId: '12345',
  };

  it('prefill을 selectedPlace로 시드해 생성 모드 + 프리필로 진입한다 (B5)', () => {
    mockRouteParams = { roomId: 'r1', prefill, fromWishlistId: 'w1' };
    renderWithTheme(<MuklogEditorRoute />);
    // 생성 모드(initial 없음)이지만 selectedPlace(prefill)로 폼이 채워진다.
    expect(screen.getByText('editor:create')).toBeTruthy();
    expect(screen.getByText('selected:성수동 베이커리')).toBeTruthy();
    expect(mockUseMuklog).not.toHaveBeenCalled();
  });

  it('생성 성공(onSaved) 시 fromWishlistId 위시를 removeWishlist({id})로 삭제하고 goBack한다 (B6)', async () => {
    mockRouteParams = { roomId: 'r1', prefill, fromWishlistId: 'w1' };
    renderWithTheme(<MuklogEditorRoute />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-saved'));
    });
    expect(mockRemoveWishlist).toHaveBeenCalledWith({ id: 'w1' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('removeWishlist 실패해도 먹로그 생성 우선 — 위시 보존 + goBack 진행(데이터 손실 0)', async () => {
    mockRemoveWishlist.mockRejectedValueOnce(new Error('boom'));
    mockRouteParams = { roomId: 'r1', prefill, fromWishlistId: 'w1' };
    renderWithTheme(<MuklogEditorRoute />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-saved'));
    });
    expect(mockRemoveWishlist).toHaveBeenCalledWith({ id: 'w1' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
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
