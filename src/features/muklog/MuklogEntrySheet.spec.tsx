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

import { MuklogEntrySheet } from './MuklogEntrySheet';

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
