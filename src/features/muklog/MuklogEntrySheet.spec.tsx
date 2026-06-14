// src/features/muklog/MuklogEntrySheet.spec.tsx
// 최소 입력 시트 — 장소명/카테고리/별점/메모/방문일, 장소명 빈→저장 비활성, 저장→createMuklog→onSaved
//   (plan §6.3 / §5 T9, AC2·AC3·AC12). useCreateMuklog 모킹으로 시트 동작만 검증.
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockUseCreateMuklog = jest.fn();
jest.mock('./useCreateMuklog', () => ({ useCreateMuklog: () => mockUseCreateMuklog() }));

// 내부 picker(uncontrolled 경로) 검증용 — expo-image-picker 모킹.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
import * as ImagePicker from 'expo-image-picker';

import { MuklogEntrySheet, type MuklogPlaceSearchControl } from './MuklogEntrySheet';
import { type MuklogEditInitial, type PlaceSearchItem } from './types';

const editInitial = (over?: Partial<MuklogEditInitial>): MuklogEditInitial => ({
  muklogId: 'mk-1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 4,
  memo: '인생 까르보나라',
  visitedAt: '2026-02-14',
  photos: [
    { storagePath: 'r1/mk-1/a.jpg', orderIndex: 0, uri: 'https://signed/a.jpg' },
    { storagePath: 'r1/mk-1/b.jpg', orderIndex: 1, uri: 'https://signed/b.jpg' },
  ],
  ...over,
});

const requestMock = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchMock = ImagePicker.launchImageLibraryAsync as jest.Mock;

const createMuklog = jest.fn();
const useCreateMuklogMock = mockUseCreateMuklog;

const onSaved = jest.fn();
const onClose = jest.fn();

const renderSheet = () =>
  renderWithTheme(
    <MuklogEntrySheet visible roomId="r1" onClose={onClose} onSaved={onSaved} />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  createMuklog.mockResolvedValue({ id: 'new-id' });
  useCreateMuklogMock.mockReturnValue({ createMuklog, loading: false, error: null });
  requestMock.mockResolvedValue({ granted: true });
  launchMock.mockResolvedValue({ canceled: true, assets: null });
});

describe('MuklogEntrySheet', () => {
  it('visible=false면 렌더하지 않는다', () => {
    renderWithTheme(
      <MuklogEntrySheet visible={false} roomId="r1" onClose={onClose} onSaved={onSaved} />,
    );
    expect(screen.queryByLabelText('장소 이름')).toBeNull();
  });

  it('장소명이 비면 저장 버튼이 비활성이다 (AC3)', () => {
    renderSheet();
    const save = screen.getByLabelText('저장');
    expect(save.props.accessibilityState?.disabled).toBe(true);
  });

  it('장소명 입력 후 저장 시 createMuklog(input)을 호출하고 onSaved를 부른다 (AC2·AC12)', async () => {
    renderSheet();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '트라토리아 보나');
    fireEvent.press(screen.getByLabelText('카테고리 파스타·양식'));
    fireEvent.press(screen.getByLabelText('별점 5점'));
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었다');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });

    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({
        roomId: 'r1',
        placeName: '트라토리아 보나',
        category: 'pasta',
        rating: 5,
        memo: '맛있었다',
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('저장 실패 시 인라인 에러를 표시하고 onSaved를 부르지 않는다(입력 보존)', async () => {
    createMuklog.mockRejectedValueOnce(new Error('PLACE_NAME_REQUIRED'));
    useCreateMuklogMock.mockReturnValue({
      createMuklog,
      loading: false,
      error: '장소 이름을 입력해 주세요.',
    });
    renderSheet();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), 'x');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });

    await waitFor(() => expect(screen.getByText('장소 이름을 입력해 주세요.')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('카테고리 칩 8종을 렌더한다', () => {
    renderSheet();
    expect(screen.getByLabelText('카테고리 파스타·양식')).toBeTruthy();
    expect(screen.getByLabelText('카테고리 이자카야')).toBeTruthy();
  });

  it('사진 필드(추가 타일)를 렌더하고 추가 탭 시 onAddPhoto를 호출한다 (⑤)', () => {
    const onAddPhoto = jest.fn();
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        photos={[]}
        onAddPhoto={onAddPhoto}
        onRemovePhoto={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId('photo-add-tile'));
    expect(onAddPhoto).toHaveBeenCalledTimes(1);
  });

  it('uncontrolled(추가 콜백 미주입)면 내부 picker로 선택→썸네일 표시→createMuklog input.photos로 전달', async () => {
    launchMock.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://a.jpg' }] });
    renderWithTheme(
      <MuklogEntrySheet visible roomId="r1" onClose={onClose} onSaved={onSaved} />,
    );
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');

    await act(async () => {
      fireEvent.press(screen.getByTestId('photo-add-tile'));
    });
    // 선택 후 썸네일 1장(N/5 hint 1/5).
    await waitFor(() => expect(screen.getByTestId('photo-thumb-0')).toBeTruthy());
    expect(screen.getByText('1/5')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ photos: [{ uri: 'file://a.jpg' }] }),
    });
  });

  it('uncontrolled 권한 거부 시 사진 권한 메시지를 인라인 표시한다', async () => {
    requestMock.mockResolvedValueOnce({ granted: false });
    renderWithTheme(
      <MuklogEntrySheet visible roomId="r1" onClose={onClose} onSaved={onSaved} />,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('photo-add-tile'));
    });
    await waitFor(() =>
      expect(screen.getByText('사진 접근 권한이 필요해요. 설정에서 허용해 주세요.')).toBeTruthy(),
    );
    expect(launchMock).not.toHaveBeenCalled();
  });

  it('photos가 주어지면 createMuklog input.photos로 전달한다 (경계: 시트→훅)', async () => {
    const photos = [{ uri: 'file://a.jpg' }, { uri: 'file://b.jpg' }];
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        photos={photos}
        onAddPhoto={jest.fn()}
        onRemovePhoto={jest.fn()}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });

    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ photos }),
    });
  });
});

describe('MuklogEntrySheet — 장소검색 controlled 골격 (muklog-place, ui-spec §5) [B]', () => {
  const placeItem = (over?: Partial<PlaceSearchItem>): PlaceSearchItem => ({
    kakaoPlaceId: 'k1',
    placeName: '트라토리아 보나',
    categoryName: '음식점 > 양식 > 이탈리안',
    categoryGroupCode: 'FD6',
    addressName: '서울 마포구 연남동 227-15',
    roadAddressName: '서울 마포구 월드컵북로 39',
    lat: 37.56,
    lng: 126.92,
    phone: '',
    ...over,
  });

  const searchControl = (over?: Partial<MuklogPlaceSearchControl>): MuklogPlaceSearchControl => ({
    query: '',
    onChangeQuery: jest.fn(),
    status: 'idle',
    results: [],
    ...over,
  });

  it('placeSearch 미주입이면 검색 영역이 없고 수동 입력만 보인다(회귀 안전)', () => {
    renderSheet();
    expect(screen.queryByLabelText('장소 검색')).toBeNull();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
  });

  it('placeSearch 주입 시 검색 입력 + 결과를 렌더하고, 결과 탭 시 onSelectPlace({item})을 호출한다', () => {
    const onSelectPlace = jest.fn();
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        placeSearch={searchControl({ status: 'ready', query: '보나', results: [placeItem()] })}
        onSelectPlace={onSelectPlace}
      />,
    );
    expect(screen.getByLabelText('장소 검색')).toBeTruthy();
    fireEvent.press(screen.getByTestId('place-result-0'));
    expect(onSelectPlace).toHaveBeenCalledWith({ item: placeItem() });
    // 검색 모드에선 수동 입력도 함께(폴백).
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
  });

  it('selectedPlace 주입 시 요약카드(장소명·📍주소)를 표시하고 수동 입력을 숨긴다(킷 토글)', () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        placeSearch={searchControl()}
        selectedPlace={{ placeName: '트라토리아 보나', category: 'pasta', roadAddress: '서울 마포구 월드컵북로 39' }}
      />,
    );
    expect(screen.getByTestId('place-selected-summary')).toBeTruthy();
    expect(screen.getByText('📍 서울 마포구 월드컵북로 39')).toBeTruthy();
    // 요약 모드 = 검색/수동 입력 숨김.
    expect(screen.queryByLabelText('장소 검색')).toBeNull();
    expect(screen.queryByLabelText('장소 이름')).toBeNull();
  });

  it('요약카드 "선택 해제" 탭 시 onClearPlace를 호출한다(plan D2)', () => {
    const onClearPlace = jest.fn();
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        selectedPlace={{ placeName: '보나' }}
        onClearPlace={onClearPlace}
      />,
    );
    fireEvent.press(screen.getByLabelText('장소 선택 해제'));
    expect(onClearPlace).toHaveBeenCalledTimes(1);
  });
});

describe('MuklogEntrySheet — 장소 자동채움 payload 합류 (muklog-place, T10·T11·§3.8) [C]', () => {
  // 컨테이너가 selectedPlace(PlaceSelection)를 주입한 상태 — 시트가 sync effect로 placeName/category/좌표를 흡수.
  const fullSelection = {
    placeName: '트라토리아 보나',
    category: 'pasta' as const,
    area: '연남동',
    address: '서울 마포구 연남동 227-15',
    roadAddress: '서울 마포구 월드컵북로 39',
    kakaoPlaceId: 'k1',
    lat: 37.56,
    lng: 126.92,
  };

  it('selectedPlace 자동채움 → 저장 시 createMuklog payload에 place 필드 + 자동선택 카테고리 합류 (T10·T9)', async () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        selectedPlace={fullSelection}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({
        placeName: '트라토리아 보나',
        category: 'pasta', // D1: 매핑 성공 카테고리 자동선택
        area: '연남동',
        address: '서울 마포구 연남동 227-15',
        roadAddress: '서울 마포구 월드컵북로 39',
        kakaoPlaceId: 'k1',
        lat: 37.56,
        lng: 126.92,
      }),
    });
  });

  it('자동채움 카테고리 매핑 실패(null) → 기존 칩 선택 보존(D1, 덮어쓰지 않음)', async () => {
    // 매핑 실패(category=null) selectedPlace 주입. 사용자가 직접 cafe 칩 선택 → 저장 시 cafe 보존(null로 덮이지 않음).
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        selectedPlace={{ ...fullSelection, category: null }}
      />,
    );
    fireEvent.press(screen.getByLabelText('카테고리 카페·디저트'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ placeName: '트라토리아 보나', category: 'cafe' }),
    });
  });

  it('수동입력 폴백(검색 0건) → 저장 시 place 필드는 NULL(좌표 nullable) (T11)', async () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        placeSearch={{
          query: '없는가게',
          onChangeQuery: jest.fn(),
          status: 'ready',
          results: [],
        }}
      />,
    );
    // 0건 안내 + 수동 입력 유지(폴백).
    expect(screen.getByTestId('place-search-empty')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '직접 입력 맛집');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({
        placeName: '직접 입력 맛집',
        kakaoPlaceId: null,
        address: null,
        roadAddress: null,
        lat: null,
        lng: null,
      }),
    });
  });

  it('검색 에러 → 인라인 안내 + 수동입력 보존(폴백 저장 가능) (T11)', () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        placeSearch={{
          query: '보나',
          onChangeQuery: jest.fn(),
          status: 'error',
          results: [],
          errorMessage: '장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.',
        }}
      />,
    );
    expect(screen.getByTestId('place-search-error')).toBeTruthy();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy(); // 입력 보존(수동 폴백)
  });

  it('편집 진입 시 initial place 필드를 보존해 재검색 없이 저장해도 좌표 손실 0 (§6)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        onSubmit={onSubmit}
        initial={editInitial({
          kakaoPlaceId: 'k-existing',
          address: '서울 마포구 연남동 227-15',
          roadAddress: '서울 마포구 월드컵북로 39',
          lat: 37.56,
          lng: 126.92,
        })}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      input: expect.objectContaining({
        kakaoPlaceId: 'k-existing',
        address: '서울 마포구 연남동 227-15',
        roadAddress: '서울 마포구 월드컵북로 39',
        lat: 37.56,
        lng: 126.92,
      }),
    });
  });
});

describe('MuklogEntrySheet — 편집 모드 (initial / onSubmit) [§5 ④]', () => {
  it('initial 주입 시 제목 "먹로그 편집" + 모든 필드를 프리필한다 (AC a)', () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('먹로그 편집')).toBeTruthy();
    expect(screen.getByLabelText('장소 이름').props.value).toBe('트라토리아 보나');
    expect(screen.getByLabelText('메모').props.value).toBe('인생 까르보나라');
    expect(screen.getByLabelText('방문일').props.value).toBe('2026-02-14');
    // 카테고리 pasta 칩이 선택 상태.
    expect(screen.getByLabelText('카테고리 파스타·양식').props.accessibilityState?.selected).toBe(true);
    // 저장 버튼 라벨은 "수정".
    expect(screen.getByLabelText('수정')).toBeTruthy();
  });

  it('existing 사진 썸네일을 표시하고 ×로 제거하면 슬롯이 줄어든다 (AC b)', () => {
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByTestId('photo-thumb-0')).toBeTruthy();
    expect(screen.getByTestId('photo-thumb-1')).toBeTruthy();
    expect(screen.getByText('2/5')).toBeTruthy();

    fireEvent.press(screen.getByTestId('photo-remove-0'));
    expect(screen.queryByTestId('photo-thumb-1')).toBeNull();
    expect(screen.getByText('1/5')).toBeTruthy();
  });

  it('편집 신규 사진 추가 시 내부 picker로 new 슬롯을 append한다(합산 5 컷)', async () => {
    launchMock.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://new.jpg' }] });
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={jest.fn()}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('photo-add-tile'));
    });
    await waitFor(() => expect(screen.getByText('3/5')).toBeTruthy());
  });

  it('저장(수정) 시 onSubmit(EditorPhoto 최종 배열)을 호출하고 onSaved를 부른다 (AC c)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={onSubmit}
      />,
    );
    // 첫 existing 사진 제거 → toDelete 후보. 장소명 수정.
    fireEvent.press(screen.getByTestId('photo-remove-0'));
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나 파스타');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      input: expect.objectContaining({
        muklogId: 'mk-1',
        roomId: 'r1',
        placeName: '보나 파스타',
        category: 'pasta',
        rating: 4,
        memo: '인생 까르보나라',
        visitedAt: '2026-02-14',
        // 첫 사진 제거 후 남은 existing 1장(b.jpg)만 최종 배열에.
        photos: [{ kind: 'existing', storagePath: 'r1/mk-1/b.jpg', uri: 'https://signed/b.jpg' }],
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('변경 없이 저장해도 onSubmit(동일 값)을 호출한다 (AC d, no-op reconcile)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={onSubmit}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      input: expect.objectContaining({
        placeName: '트라토리아 보나',
        photos: [
          { kind: 'existing', storagePath: 'r1/mk-1/a.jpg', uri: 'https://signed/a.jpg' },
          { kind: 'existing', storagePath: 'r1/mk-1/b.jpg', uri: 'https://signed/b.jpg' },
        ],
      }),
    });
  });

  it('편집 저장 실패(onSubmit reject) 시 submitError를 인라인 표시하고 onSaved 미호출(입력 보존)', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('UPDATE_FAILED'));
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={onSubmit}
        submitError="수정에 실패했어요. 다시 시도해 주세요."
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByText('수정에 실패했어요. 다시 시도해 주세요.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('편집 모드는 작성 useCreateMuklog를 호출하지 않는다(경로 분리)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEntrySheet
        visible
        roomId="r1"
        onClose={onClose}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={onSubmit}
      />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(createMuklog).not.toHaveBeenCalled();
  });
});
