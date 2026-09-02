// src/features/muklog/MuklogEditor.spec.tsx
// 먹로그 에디터(풀스크린, FLAG-1) — 장소명/카테고리/별점/메모/방문일, 장소명 빈→저장 비활성(SubBar.right),
//   저장→createMuklog→onSaved (plan §6.3 / §5 T9, AC2·AC3·AC12). useCreateMuklog 모킹으로 폼 동작만 검증.
//   ⚠️ 시트(MuklogEntrySheet)→풀스크린 전환: visible 제거, onClose→onBack. 폼/저장/사진/장소 로직은 불변.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { SWAP_TRANSITION_TEST_ID } from '@/components/SwapTransition';
import { renderWithTheme } from '@/test/renderWithTheme';
import { spacing, typography } from '@/theme';

const mockUseCreateMuklog = jest.fn();
jest.mock('../useCreateMuklog', () => ({ useCreateMuklog: () => mockUseCreateMuklog() }));

// 내부 picker(uncontrolled 경로) 검증용 — expo-image-picker 모킹.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
import * as ImagePicker from 'expo-image-picker';

import { MEMO_INPUT_LINES, memoBoxHeight } from './memoBoxHeight';
import { MuklogEditor, type MuklogPlaceSearchControl } from './MuklogEditor';
import { formatVisitedDate } from '../formatVisitedDate';
import { type MuklogEditInitial, type PlaceSearchItem } from '../types';
import { todayLocalDate } from '../validate';

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
const onBack = jest.fn();

const renderEditor = () =>
  renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} />);

beforeEach(() => {
  jest.clearAllMocks();
  createMuklog.mockResolvedValue({ id: 'new-id' });
  useCreateMuklogMock.mockReturnValue({ createMuklog, loading: false, error: null });
  requestMock.mockResolvedValue({ granted: true });
  launchMock.mockResolvedValue({ canceled: true, assets: null });
});

describe('MuklogEditor', () => {
  it('작성 모드 타이틀("새 먹로그")과 장소 입력을 렌더한다', () => {
    renderEditor();
    expect(screen.getByText('새 먹로그')).toBeTruthy();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
  });

  it('장소명이 비면 저장 버튼(SubBar)이 비활성이다 (AC3)', () => {
    renderEditor();
    const save = screen.getByLabelText('저장');
    expect(save.props.accessibilityState?.disabled).toBe(true);
  });

  it('메모가 5자 미만이면 저장 비활성 + 힌트 표시(메모 필수·최소 5자)', () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛'); // 1자 < 5
    expect(screen.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('memo-hint')).toBeTruthy();
  });

  it('메모 5자 이상이면 저장 활성(장소명도 있을 때)', () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 5자
    expect(screen.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false);
  });

  it('장소명 입력 후 저장 시 createMuklog(input)을 호출하고 onSaved를 부른다 (AC2·AC12)', async () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '트라토리아 보나');
    fireEvent.press(screen.getByLabelText('카테고리 파스타·양식'));
    fireEvent.press(screen.getByLabelText('별점 5점'));
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요');

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
        memo: '맛있었어요',
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
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), 'x');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });

    await waitFor(() => expect(screen.getByText('장소 이름을 입력해 주세요.')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('카테고리 칩 8종을 렌더한다', () => {
    renderEditor();
    expect(screen.getByLabelText('카테고리 파스타·양식')).toBeTruthy();
    expect(screen.getByLabelText('카테고리 이자카야')).toBeTruthy();
  });

  it('사진 필드(추가 타일)를 렌더하고 추가 탭 시 onAddPhoto를 호출한다 (⑤)', () => {
    const onAddPhoto = jest.fn();
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자(저장 게이팅 충족)

    await act(async () => {
      fireEvent.press(screen.getByTestId('photo-add-tile'));
    });
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
    renderEditor();
    await act(async () => {
      fireEvent.press(screen.getByTestId('photo-add-tile'));
    });
    await waitFor(() =>
      expect(screen.getByText('사진 접근 권한이 필요해요. 설정에서 허용해 주세요.')).toBeTruthy(),
    );
    expect(launchMock).not.toHaveBeenCalled();
  });

  it('photos가 주어지면 createMuklog input.photos로 전달한다 (경계: 에디터→훅)', async () => {
    const photos = [{ uri: 'file://a.jpg' }, { uri: 'file://b.jpg' }];
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        photos={photos}
        onAddPhoto={jest.fn()}
        onRemovePhoto={jest.fn()}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자(저장 게이팅 충족)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });

    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ photos }),
    });
  });
});

describe('MuklogEditor — 장소검색 controlled 골격 (muklog-place, ui-spec §5) [B]', () => {
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
    renderEditor();
    expect(screen.queryByLabelText('장소 검색')).toBeNull();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
  });

  it('placeSearch 주입 시 searchBtn → 풀스크린 검색뷰 → 결과 탭 시 onSelectPlace({item}) (FLAG-1b)', () => {
    const onSelectPlace = jest.fn();
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={searchControl({ status: 'ready', query: '보나', results: [placeItem()] })}
        onSelectPlace={onSelectPlace}
      />,
    );
    // 폼: searchBtn(인라인 검색/결과 아님)
    expect(screen.getByLabelText('장소 검색하기')).toBeTruthy();
    expect(screen.queryByTestId('place-result-0')).toBeNull();
    // searchBtn → 풀스크린 검색뷰(입력바 + 결과)
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(screen.getByLabelText('장소 검색')).toBeTruthy();
    fireEvent.press(screen.getByTestId('place-result-0'));
    expect(onSelectPlace).toHaveBeenCalledWith({ item: placeItem() });
  });

  it('selectedPlace 주입 시 요약카드(장소명·📍주소)를 표시하고 수동 입력을 숨긴다(킷 토글)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={searchControl()}
        selectedPlace={{ placeName: '트라토리아 보나', category: 'pasta', roadAddress: '서울 마포구 월드컵북로 39' }}
      />,
    );
    expect(screen.getByTestId('place-selected-summary')).toBeTruthy();
    expect(screen.getByText('📍 서울 마포구 월드컵북로 39')).toBeTruthy();
    expect(screen.queryByLabelText('장소 검색')).toBeNull();
    expect(screen.queryByLabelText('장소 이름')).toBeNull();
  });

  it('요약카드엔 "선택 해제"가 없고 "변경"만 있다(단일 액션·사용자 요청)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        selectedPlace={{ placeName: '보나' }}
        onClearPlace={jest.fn()}
      />,
    );
    expect(screen.queryByText('선택 해제')).toBeNull();
    expect(screen.queryByLabelText('장소 선택 해제')).toBeNull();
    expect(screen.getByLabelText('장소 변경')).toBeTruthy();
  });
});

describe('MuklogEditor — 장소 자동채움 payload 합류 (muklog-place, T10·T11·§3.8) [C]', () => {
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
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} selectedPlace={fullSelection} />,
    );
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({
        placeName: '트라토리아 보나',
        category: 'pasta',
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
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        selectedPlace={{ ...fullSelection, category: null }}
      />,
    );
    fireEvent.press(screen.getByLabelText('카테고리 카페·디저트'));
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ placeName: '트라토리아 보나', category: 'cafe' }),
    });
  });

  it('검색 0건 시 검색뷰 "직접 입력" → 검색어를 장소명 채택(좌표 NULL) 저장 (T11, FLAG-1b)', async () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={{
          query: '없는가게',
          onChangeQuery: jest.fn(),
          status: 'ready',
          results: [],
        }}
        onClearPlace={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(screen.getByTestId('place-search-empty')).toBeTruthy();
    // §4.2 직접 입력 → 검색어('없는가게')를 장소명으로 채택, 폼 복귀.
    fireEvent.press(screen.getByLabelText('직접 입력'));
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({
        placeName: '없는가게',
        kakaoPlaceId: null,
        address: null,
        roadAddress: null,
        lat: null,
        lng: null,
      }),
    });
  });

  it('검색 에러 → 검색뷰 인라인 안내 + "직접 입력" 폴백 노출 (T11, FLAG-1b)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(screen.getByTestId('place-search-error')).toBeTruthy();
    // PlaceSearchView: 검색어 있고 (0건 || 에러)면 "직접 입력" 폴백 노출(§4.2). 탭→검색어 장소명 채택.
    expect(screen.getByLabelText('직접 입력')).toBeTruthy();
  });

  it('편집 진입 시 initial place 필드를 보존해 재검색 없이 저장해도 좌표 손실 0 (§6)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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

describe('MuklogEditor — 편집 모드 (initial / onSubmit) [§5 ④]', () => {
  it('initial 주입 시 제목 "먹로그 편집" + 모든 필드를 프리필한다 (AC a)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('먹로그 편집')).toBeTruthy();
    expect(screen.getByLabelText('장소 이름').props.value).toBe('트라토리아 보나');
    expect(screen.getByLabelText('메모').props.value).toBe('인생 까르보나라');
    // T-MIG: 방문일 TextInput 제거 → 탭형 날짜 행 표시 단언(킷 fmtDate withDow). 저장 계약은 :498에서 회귀 가드.
    expect(screen.getByLabelText('방문일 2026.02.14 (토), 선택')).toBeTruthy();
    expect(screen.getByLabelText('카테고리 파스타·양식').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByLabelText('수정')).toBeTruthy();
  });

  it('existing 사진 썸네일을 표시하고 ×로 제거하면 슬롯이 줄어든다 (AC b)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        initial={editInitial()}
        onSubmit={onSubmit}
      />,
    );
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
        photos: [{ kind: 'existing', storagePath: 'r1/mk-1/b.jpg', uri: 'https://signed/b.jpg' }],
      }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('변경 없이 저장해도 onSubmit(동일 값)을 호출한다 (AC d, no-op reconcile)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
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

describe('MuklogEditor — 장소검색 풀스크린 스왑 상태머신 (FLAG-1b)', () => {
  const ctrl = (over?: Partial<MuklogPlaceSearchControl>): MuklogPlaceSearchControl => ({
    query: '',
    onChangeQuery: jest.fn(),
    status: 'idle',
    results: [],
    ...over,
  });

  it('searchBtn 탭 → 검색뷰로 스왑(폼 숨김), 검색 취소 시 폼 복귀', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} placeSearch={ctrl()} />,
    );
    // 폼 상태: searchBtn + 폼 필드(별점) 존재.
    expect(screen.getByLabelText('장소 검색하기')).toBeTruthy();
    expect(screen.getByLabelText('별점 1점')).toBeTruthy();
    // searchBtn → 검색뷰(PlaceSearchView): 입력바 노출, 폼(searchBtn/카테고리) 숨김.
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(screen.getByLabelText('장소 검색')).toBeTruthy();
    expect(screen.queryByLabelText('장소 검색하기')).toBeNull();
    expect(screen.queryByText('카테고리')).toBeNull();
    // 검색 취소(PlaceSearchView backLabel) → 폼 복귀.
    fireEvent.press(screen.getByLabelText('검색 취소'));
    expect(screen.getByLabelText('장소 검색하기')).toBeTruthy();
  });

  it('선택됨(placeChosen) 상태에서 "변경" 탭 → 검색뷰 재진입', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={ctrl()}
        selectedPlace={{ placeName: '보나', roadAddress: '서울 마포구 월드컵북로 39' }}
      />,
    );
    expect(screen.getByTestId('place-selected-summary')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('장소 변경'));
    expect(screen.getByLabelText('장소 검색')).toBeTruthy();
  });

  it('placeSearch 미주입이면 searchBtn 없이 수동 입력만(회귀 안전)', () => {
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} />);
    expect(screen.queryByLabelText('장소 검색하기')).toBeNull();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
  });
});

describe('MuklogEditor — 킷 정합 (editor-fidelity, mk-log:400·449·418)', () => {
  // AC1 — 저장 성공 시 토스트(신규/편집 분기, positive). 실패 시 토스트 없음.
  it('작성 저장 성공 시 "맛집을 기록했어요" 토스트를 표시한다 (AC1)', async () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(screen.getByText('맛집을 기록했어요')).toBeTruthy());
  });

  it('편집 저장 성공 시 "기록을 수정했어요" 토스트를 표시한다 (AC1)', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'mk-1' });
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={editInitial()} onSubmit={onSubmit} />,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText('수정'));
    });
    await waitFor(() => expect(screen.getByText('기록을 수정했어요')).toBeTruthy());
  });

  it('작성 저장 실패 시 토스트를 표시하지 않는다 (AC1)', async () => {
    createMuklog.mockRejectedValueOnce(new Error('PLACE_NAME_REQUIRED'));
    useCreateMuklogMock.mockReturnValue({
      createMuklog,
      loading: false,
      error: '장소 이름을 입력해 주세요.',
    });
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('맛집을 기록했어요')).toBeNull();
    expect(screen.queryByText('기록을 수정했어요')).toBeNull();
  });

  // AC2 — 별점 보조 텍스트(미선택 placeholder / 선택 시 n.0).
  it('별점 미선택(0) 시 보조 텍스트 "어땠어요?"를 표시한다 (AC2)', () => {
    renderEditor();
    expect(screen.getByText('어땠어요?')).toBeTruthy();
  });

  it('별점 선택 시 보조 텍스트가 "{n.0}"로 갱신된다 (AC2)', () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(screen.getByText('4.0')).toBeTruthy();
    expect(screen.queryByText('어땠어요?')).toBeNull();
  });

  // AC3 — 미선택 검색 버튼 카피.
  it('장소 미선택 검색 버튼 라벨이 "맛집 이름을 검색해요"다 (AC3)', () => {
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={{ query: '', onChangeQuery: jest.fn(), status: 'idle', results: [] }}
      />,
    );
    expect(screen.getByText('맛집 이름을 검색해요')).toBeTruthy();
    expect(screen.queryByText('장소 검색 (카카오)')).toBeNull();
  });
});

describe('MuklogEditor — 방문일 캘린더 시트 배선 (date-picker T4)', () => {
  // AC4.1 — 방문일 TextInput 제거 → 탭형 날짜 행(button).
  it('방문일 영역에 TextInput("방문일")이 없고 탭형 날짜 행(button)이 있다', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={editInitial()} onSubmit={jest.fn()} />,
    );
    expect(screen.queryByLabelText('방문일')).toBeNull(); // 구 TextInput label 부재
    const row = screen.getByLabelText('방문일 2026.02.14 (토), 선택');
    expect(row.props.accessibilityRole).toBe('button');
  });

  // AC4.2 — 행에 현재 visitedAt 포맷 표시(withDow).
  it('편집 프리필 visitedAt을 "YYYY.MM.DD (요일)"로 행에 표시한다', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={editInitial()} onSubmit={jest.fn()} />,
    );
    expect(screen.getByText('2026.02.14 (토)')).toBeTruthy();
  });

  // AC4.3 — 행 탭 → DatePickerSheet 오픈.
  it('날짜 행 탭 → DatePickerSheet(방문일 선택)가 열린다', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={editInitial()} onSubmit={jest.fn()} />,
    );
    expect(screen.queryByText('방문일 선택')).toBeNull();
    fireEvent.press(screen.getByLabelText('방문일 2026.02.14 (토), 선택'));
    expect(screen.getByText('방문일 선택')).toBeTruthy();
    expect(screen.getByText('2026년 2월')).toBeTruthy();
  });

  // AC4.4 — 시트 선택 → 행 표시 갱신 + 시트 닫힘.
  it('시트에서 날짜 선택 → 행 표시 갱신 후 시트가 닫힌다', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={editInitial()} onSubmit={jest.fn()} />,
    );
    fireEvent.press(screen.getByLabelText('방문일 2026.02.14 (토), 선택'));
    fireEvent.press(screen.getByTestId('date-cell-10')); // 2026-02-10(화), 과거라 선택 가능
    expect(screen.getByLabelText('방문일 2026.02.10 (화), 선택')).toBeTruthy();
    expect(screen.queryByText('방문일 선택')).toBeNull(); // 선택 후 onClose
  });

  // AC4.5 — 선택 후 저장(작성) → createMuklog payload visitedAt = 시트 ISO(YYYY-MM-DD).
  it('작성: 시트에서 1일 선택 후 저장하면 createMuklog payload.visitedAt이 그 ISO다', async () => {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(screen.getByLabelText('메모'), '맛있었어요'); // 메모 필수 ≥5자(저장 게이팅 충족)
    fireEvent.press(screen.getByLabelText(`방문일 ${formatVisitedDate({ visitedAt: todayLocalDate(), withDow: true })}, 선택`));
    fireEvent.press(screen.getByTestId('date-cell-1')); // 이번 달 1일(과거/오늘)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    expect(createMuklog).toHaveBeenCalledWith({
      input: expect.objectContaining({ visitedAt: firstOfMonth }),
    });
  });

  // AC4.6 — 작성 기본 진입 시 행이 today 포맷 표시(빈값 아님).
  it('작성 기본 진입 시 날짜 행이 오늘(todayLocalDate) 포맷을 표시한다', () => {
    renderEditor();
    const todayLabel = formatVisitedDate({ visitedAt: todayLocalDate(), withDow: true });
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });
});

// ── 메모 입력 고정 높이 (memo-max-height, plan §6-1 S1~S8) ─────────────────────────────
//   킷 <textarea rows={4}> + resize:none 번역 = minHeight==maxHeight 고정 박스 + 내부 스크롤.
//   실제 렌더 픽셀·스크롤 제스처는 RNTL이 계산하지 않으므로 스타일/props 계약만 단언(나머지는 디바이스 스모크).
describe('MuklogEditor — 메모 입력 고정 높이 (memo-max-height)', () => {
  const memoInput = () => screen.getByLabelText('메모');
  const memoStyle = () => StyleSheet.flatten(memoInput().props.style) as Record<string, unknown>;

  // 화면이 실제로 쓰는 것과 같은 출처(토큰·상수·hairline)로 기대값을 계산 — 하드코딩 125 금지.
  const expectedHeight = memoBoxHeight({
    lineHeight: typography.memoInput.lineHeight,
    lines: MEMO_INPUT_LINES,
    paddingVertical: spacing[14],
    borderWidth: StyleSheet.hairlineWidth,
  });

  it('S1: minHeight === maxHeight === memoBoxHeight(...)로 고정된다 (minHeight 96 폐기)', () => {
    renderEditor();
    const style = memoStyle();
    expect(style.minHeight).toBe(expectedHeight);
    expect(style.maxHeight).toBe(expectedHeight);
    expect(style.minHeight).not.toBe(96);
  });

  it('S2: 킷 타이포 토큰(memoInput 15/24 Medium) + textAlignVertical top이 적용된다', () => {
    renderEditor();
    const style = memoStyle();
    expect(style.fontSize).toBe(15);
    expect(style.lineHeight).toBe(24);
    expect(style.fontFamily).toBe('SUIT-Medium');
    expect(style.textAlignVertical).toBe('top');
  });

  it('S3: multiline 유지 · numberOfLines 제거 · maxLength 500 유지', () => {
    renderEditor();
    const props = memoInput().props;
    expect(props.multiline).toBe(true);
    expect(props.numberOfLines).toBeUndefined();
    expect(props.maxLength).toBe(500);
  });

  it('S4: 4줄을 넘는 입력 후에도 박스 높이가 변하지 않는다 (내부 스크롤로 흡수)', () => {
    renderEditor();
    fireEvent.changeText(memoInput(), '가'.repeat(300));
    const style = memoStyle();
    expect(style.minHeight).toBe(expectedHeight);
    expect(style.maxHeight).toBe(expectedHeight);
  });

  it('S5: 500자 입력 → 저장 payload memo가 500자 전문이다 (저장 제한 회귀 0)', async () => {
    const memo500 = '가'.repeat(500);
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.changeText(memoInput(), memo500);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('저장'));
    });
    await waitFor(() => expect(createMuklog).toHaveBeenCalledTimes(1));
    const payload = createMuklog.mock.calls[0][0].input;
    expect(payload.memo).toHaveLength(500);
    expect(payload.memo).toBe(memo500);
  });

  it('S6: 빈 메모면 힌트가 보이고 저장이 비활성이다 (기존 게이팅 유지)', () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    expect(screen.getByTestId('memo-hint')).toBeTruthy();
    expect(screen.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true);
  });

  it('S7: 편집 진입 시 긴 메모 프리필이 잘리지 않고 전문 그대로 들어간다', () => {
    const longMemo = '맛있었어요 '.repeat(50).slice(0, 400);
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        initial={editInitial({ memo: longMemo })}
        onSubmit={jest.fn()}
      />,
    );
    expect(memoInput().props.value).toBe(longMemo);
    const style = memoStyle();
    expect(style.maxHeight).toBe(expectedHeight);
  });

  it('S8: 메모 전용 높이 제약이 장소명 입력으로 새지 않는다', () => {
    renderEditor();
    const placeStyle = StyleSheet.flatten(screen.getByLabelText('장소 이름').props.style) as Record<string, unknown>;
    expect(placeStyle.minHeight).toBeUndefined();
    expect(placeStyle.maxHeight).toBeUndefined();
  });
});

describe('MuklogEditor — 폼↔검색 전환 배선 (motion-pass-1 D1, 백로그 U54)', () => {
  const ctrl = (over?: Partial<MuklogPlaceSearchControl>): MuklogPlaceSearchControl => ({
    query: '',
    onChangeQuery: jest.fn(),
    status: 'idle',
    results: [],
    ...over,
  });

  const searchResult = (): PlaceSearchItem => ({
    kakaoPlaceId: 'k1',
    placeName: '트라토리아 보나',
    categoryName: '음식점 > 양식 > 이탈리안',
    categoryGroupCode: 'FD6',
    addressName: '서울 마포구 연남동 227-15',
    roadAddressName: '서울 마포구 월드컵북로 39',
    lat: 37.56,
    lng: 126.92,
    phone: '',
  });

  it('검색 진입 직후에도 결과 행 탭이 동작한다(전환이 입력을 막지 않는다)', () => {
    const onSelectPlace = jest.fn();
    renderWithTheme(
      <MuklogEditor
        roomId="r1"
        onBack={onBack}
        onSaved={onSaved}
        placeSearch={ctrl({ status: 'ready', query: '보나', results: [searchResult()] })}
        onSelectPlace={onSelectPlace}
      />,
    );
    // 폼 → 검색뷰(전진) 전환 직후 결과 행이 즉시 눌린다.
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(screen.getByTestId(SWAP_TRANSITION_TEST_ID)).toBeTruthy();
    fireEvent.press(screen.getByTestId('place-result-0'));
    expect(onSelectPlace).toHaveBeenCalledWith({ item: searchResult() });
    // 복귀(뒤) 전환 후에도 폼이 그대로 조회된다.
    expect(screen.getByLabelText('메모')).toBeTruthy();
  });

  it('에디터 최초 마운트에는 추가 페이드가 없다(스택 전환 위 이중 모션 방지)', () => {
    renderWithTheme(
      <MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} placeSearch={ctrl()} />,
    );
    const wrapper = StyleSheet.flatten(
      screen.getByTestId(SWAP_TRANSITION_TEST_ID).props.style,
    ) as Record<string, unknown>;
    expect(wrapper.opacity).toBe(1);
  });

  it('placeSearch가 없어도(null 방어) 폼이 렌더된다', () => {
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} />);
    expect(screen.getByTestId(SWAP_TRANSITION_TEST_ID)).toBeTruthy();
    expect(screen.getByLabelText('장소 이름')).toBeTruthy();
    expect(screen.queryByLabelText('장소 검색')).toBeNull();
  });
});
