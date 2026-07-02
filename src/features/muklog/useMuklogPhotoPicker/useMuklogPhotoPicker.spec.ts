// src/features/muklog/useMuklogPhotoPicker.spec.ts
// 사진 picker 상태 훅 명세 (plan §5 ⑤, §6, ui-spec §3.1).
//   addPhotos: 권한 요청 → 다중 선택(최대 5 제한) → photos 상태 추가. removePhoto: index 제거.
//   6장+ 반환 시 앞 5장만, 권한 거부 시 미실행+에러, 취소 시 변화 없음.
//   expo-image-picker 모킹 — 우리 코드의 호출/상태 갱신만 검증(네이티브 동작은 디바이스 스모크).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

import * as ImagePicker from 'expo-image-picker';
import { useMuklogPhotoPicker } from './useMuklogPhotoPicker';

const requestMock = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchMock = ImagePicker.launchImageLibraryAsync as jest.Mock;

const assets = (uris: string[]) => ({ canceled: false, assets: uris.map((uri) => ({ uri })) });

beforeEach(() => {
  jest.clearAllMocks();
  requestMock.mockResolvedValue({ granted: true });
});

describe('useMuklogPhotoPicker', () => {
  it('초기 photos는 빈 배열', () => {
    const { result } = renderHook(() => useMuklogPhotoPicker());
    expect(result.current.photos).toEqual([]);
  });

  it('addPhotos: 선택 2장을 photos에 추가한다', async () => {
    launchMock.mockResolvedValueOnce(assets(['a', 'b']));
    const { result } = renderHook(() => useMuklogPhotoPicker());

    await act(async () => {
      await result.current.addPhotos();
    });
    expect(result.current.photos).toEqual([{ uri: 'a' }, { uri: 'b' }]);
  });

  it('권한 거부 시 picker 미실행 + 에러 토큰 throw', async () => {
    requestMock.mockResolvedValueOnce({ granted: false });
    const { result } = renderHook(() => useMuklogPhotoPicker());

    await act(async () => {
      await expect(result.current.addPhotos()).rejects.toThrow('PERMISSION_DENIED');
    });
    expect(launchMock).not.toHaveBeenCalled();
    expect(result.current.photos).toEqual([]);
  });

  it('취소 시 변화 없음(에러 아님)', async () => {
    launchMock.mockResolvedValueOnce({ canceled: true, assets: null });
    const { result } = renderHook(() => useMuklogPhotoPicker());

    await act(async () => {
      await result.current.addPhotos();
    });
    expect(result.current.photos).toEqual([]);
  });

  it('총합이 5장을 넘으면 앞에서 5장까지만 채택한다 (경계)', async () => {
    launchMock.mockResolvedValueOnce(assets(['a', 'b', 'c', 'd', 'e', 'f']));
    const { result } = renderHook(() => useMuklogPhotoPicker());

    await act(async () => {
      await result.current.addPhotos();
    });
    expect(result.current.photos.map((p) => p.uri)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('이미 3장일 때 3장 더 고르면 합쳐서 5장까지만(앞 2장 채택)', async () => {
    launchMock.mockResolvedValueOnce(assets(['a', 'b', 'c']));
    const { result } = renderHook(() => useMuklogPhotoPicker());
    await act(async () => {
      await result.current.addPhotos();
    });

    launchMock.mockResolvedValueOnce(assets(['d', 'e', 'f']));
    await act(async () => {
      await result.current.addPhotos();
    });
    expect(result.current.photos.map((p) => p.uri)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('removePhoto: 해당 index를 제거한다', async () => {
    launchMock.mockResolvedValueOnce(assets(['a', 'b', 'c']));
    const { result } = renderHook(() => useMuklogPhotoPicker());
    await act(async () => {
      await result.current.addPhotos();
    });

    act(() => {
      result.current.removePhoto({ index: 1 });
    });
    expect(result.current.photos.map((p) => p.uri)).toEqual(['a', 'c']);
  });

  it('reset: photos를 비운다(저장 성공 후 초기화용)', async () => {
    launchMock.mockResolvedValueOnce(assets(['a']));
    const { result } = renderHook(() => useMuklogPhotoPicker());
    await act(async () => {
      await result.current.addPhotos();
    });

    act(() => {
      result.current.reset();
    });
    expect(result.current.photos).toEqual([]);
  });

  it('launchImageLibraryAsync를 다중선택(images, allowsMultipleSelection, selectionLimit 5)으로 호출한다', async () => {
    launchMock.mockResolvedValueOnce(assets(['a']));
    const { result } = renderHook(() => useMuklogPhotoPicker());
    await act(async () => {
      await result.current.addPhotos();
    });
    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
      }),
    );
  });
});
