// src/features/muklog/useCreateMuklog.spec.ts
// 먹로그 생성 훅 — auth.getUser()로 created_by 확보 + insert(row).select('id').single() 계약,
//   앱단 검증(장소명 빈→insert 미호출), 에러 토큰→한국어 메시지+throw, loading/error 전이.
//   (plan §5.3 / §5 T6, AC2·AC3·AC8) supabase 모킹으로 클라 계약만 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
// 사진 업로드는 별도 단위(uploadMuklogPhotos.spec)에서 검증 → 여기선 모킹해 연동/롤백만 본다.
jest.mock('./uploadMuklogPhotos', () => ({ uploadMuklogPhotos: jest.fn() }));

import { supabase } from '@/lib/supabase';
import { uploadMuklogPhotos } from './uploadMuklogPhotos';
import { useCreateMuklog } from './useCreateMuklog';

const getUserMock = supabase.auth.getUser as jest.Mock;
const fromMock = supabase.from as jest.Mock;
const uploadMock = uploadMuklogPhotos as jest.Mock;
const singleMock = jest.fn();
const selectMock = jest.fn();
const insertMock = jest.fn();
// muklog 롤백 delete(.eq()) 스파이.
const deleteEqMock = jest.fn();
const deleteMock = jest.fn((...__a: unknown[]) => ({ eq: (...a: unknown[]) => deleteEqMock(...a) }));

// insert(row).select('id').single() 체이닝 빌더. delete().eq()도 같은 from 더블에 노출.
const wireInsert = ({ data, error }: { data: unknown; error: unknown }) => {
  singleMock.mockResolvedValueOnce({ data, error });
  selectMock.mockReturnValue({ single: (...a: unknown[]) => singleMock(...a) });
  insertMock.mockReturnValue({ select: (...a: unknown[]) => selectMock(...a) });
  fromMock.mockReturnValue({
    insert: (...a: unknown[]) => insertMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
  });
};

const validInput = {
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  memo: '맛있었다',
  visitedAt: '2026-02-14',
};

beforeEach(() => {
  getUserMock.mockReset();
  singleMock.mockReset();
  selectMock.mockReset();
  insertMock.mockReset();
  fromMock.mockReset();
  deleteEqMock.mockReset();
  deleteMock.mockClear();
  uploadMock.mockReset();
  deleteEqMock.mockResolvedValue({ error: null });
  uploadMock.mockResolvedValue({ uploadedPaths: [] });
  getUserMock.mockResolvedValue({ data: { user: { id: 'u9' } }, error: null });
});

describe('useCreateMuklog', () => {
  it('insert에 created_by=내 uid를 채워 호출하고 {id}를 반환한다 (AC2·AC8)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createMuklog({ input: validInput });
    });

    expect(fromMock).toHaveBeenCalledWith('muklogs');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'r1',
        place_name: '트라토리아 보나',
        category: 'pasta',
        rating: 5,
        visited_at: '2026-02-14',
        created_by: 'u9',
      }),
    );
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(created).toEqual({ id: 'new-id' });
  });

  it('장소 선택값(place 필드)을 insert row에 실어 저장한다 (muklog-place §3.8 / T9)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());
    await act(async () => {
      await result.current.createMuklog({
        input: {
          ...validInput,
          kakaoPlaceId: '26338954',
          address: '서울 마포구 연남동 227-15',
          roadAddress: '서울 마포구 동교로 123',
          lat: 37.561,
          lng: 126.925,
        },
      });
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kakao_place_id: '26338954',
        address: '서울 마포구 연남동 227-15',
        road_address: '서울 마포구 동교로 123',
        lat: 37.561,
        lng: 126.925,
      }),
    );
  });

  it('장소 선택 없이 수동입력 폴백 → place 필드는 NULL로 insert (좌표 nullable)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());
    await act(async () => {
      await result.current.createMuklog({ input: validInput });
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kakao_place_id: null,
        address: null,
        road_address: null,
        lat: null,
        lng: null,
      }),
    );
  });

  it('장소명이 비면 앱단에서 차단하고 insert를 호출하지 않는다 (AC3)', async () => {
    wireInsert({ data: { id: 'x' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());

    await act(async () => {
      await expect(
        result.current.createMuklog({ input: { ...validInput, placeName: '   ' } }),
      ).rejects.toThrow('PLACE_NAME_REQUIRED');
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('장소 이름을 입력해 주세요.');
  });

  it('인증 사용자 없으면 insert 미호출 + 에러 세팅', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    wireInsert({ data: { id: 'x' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());

    await act(async () => {
      await expect(result.current.createMuklog({ input: validInput })).rejects.toThrow();
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('트리거/RLS 에러는 한국어 메시지로 매핑하고 throw한다 (AC3 강제)', async () => {
    wireInsert({ data: null, error: new Error('PLACE_NAME_REQUIRED') });
    const { result } = renderHook(() => useCreateMuklog());

    await act(async () => {
      await expect(result.current.createMuklog({ input: validInput })).rejects.toThrow();
    });
    expect(result.current.error).toBe('장소 이름을 입력해 주세요.');
  });

  // 사진 연동(muklog-photos §5 ④)
  it('사진 0장이면 업로드를 호출하지 않고 기존대로 {id}만 반환한다 (경계)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createMuklog({ input: { ...validInput, photos: [] } });
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(created).toEqual({ id: 'new-id' });
  });

  it('photos 미지정(undefined)이면 업로드 미호출 (기존 호출부 호환)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const { result } = renderHook(() => useCreateMuklog());

    await act(async () => {
      await result.current.createMuklog({ input: validInput });
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('사진 2장이면 muklog insert 후 uploadMuklogPhotos를 roomId/muklogId/photos로 호출한다', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    const photos = [{ uri: 'a' }, { uri: 'b' }];
    const { result } = renderHook(() => useCreateMuklog());

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createMuklog({ input: { ...validInput, photos } });
    });

    expect(uploadMock).toHaveBeenCalledWith({ roomId: 'r1', muklogId: 'new-id', photos });
    expect(created).toEqual({ id: 'new-id' });
  });

  it('사진 업로드 실패 시 방금 만든 muklog를 delete로 롤백하고 throw한다 (일관성 §6)', async () => {
    wireInsert({ data: { id: 'new-id' }, error: null });
    uploadMock.mockRejectedValueOnce(new Error('PHOTO_UPLOAD_FAILED'));
    const photos = [{ uri: 'a' }];
    const { result } = renderHook(() => useCreateMuklog());

    await act(async () => {
      await expect(
        result.current.createMuklog({ input: { ...validInput, photos } }),
      ).rejects.toThrow();
    });

    // 롤백: from('muklogs').delete().eq('id','new-id') — muklogs_delete_own RLS 사용.
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'new-id');
    expect(result.current.error).toBe('사진 업로드에 실패했어요. 다시 시도해 주세요.');
  });
});
