// src/features/muklog/useUpdateMuklog.spec.ts
// 먹로그 수정 훅 명세 (plan §3.3 / §7 작업③, §7-1 "useUpdateMuklog").
//   동작: normalizeMuklogInput(앱 1차) → muklogs.update(필드, created_by/room_id 미포함).select('id').single()
//         → planPhotoReconcile → 삭제(행 delete → Storage remove) → 신규 업로드 → reindex(update) 순.
//   롤백 없음(기존 보존 우선). 부분 실패는 best-effort + error 세팅 + throw.
//   supabase from/storage + uploadMuklogPhotos 모킹 — 우리 코드의 호출/순서만 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock('./uploadMuklogPhotos', () => ({ uploadMuklogPhotos: jest.fn() }));

import { supabase } from '@/lib/supabase';
import { type EditorPhoto, type ExistingPhoto } from './types';
import { uploadMuklogPhotos } from './uploadMuklogPhotos';
import { useUpdateMuklog } from './useUpdateMuklog';

const fromMock = supabase.from as jest.Mock;
const storageFromMock = supabase.storage.from as jest.Mock;
const uploadMock = uploadMuklogPhotos as jest.Mock;

// muklogs.update(...).eq(...).select(...).single() 체이닝 빌더.
const updateMock = jest.fn();
const updateEqMock = jest.fn();
const updateSelectMock = jest.fn();
const updateSingleMock = jest.fn();

// muklog_photos delete(.in()) / update(.eq()) 체이닝.
const photosDeleteInMock = jest.fn();
const photosDeleteMock = jest.fn((..._a: unknown[]) => ({
  in: (...a: unknown[]) => photosDeleteInMock(...a),
}));
const photosUpdateEqMock = jest.fn();
const photosUpdateMock = jest.fn((..._a: unknown[]) => ({
  eq: (...a: unknown[]) => photosUpdateEqMock(...a),
}));

// storage.remove 스파이.
const removeMock = jest.fn();

const buildMuklogsUpdate = () => {
  const builder: Record<string, unknown> = {};
  builder.update = (...a: unknown[]) => {
    updateMock(...a);
    return builder;
  };
  builder.eq = (...a: unknown[]) => {
    updateEqMock(...a);
    return builder;
  };
  builder.select = (...a: unknown[]) => {
    updateSelectMock(...a);
    return builder;
  };
  builder.single = (...a: unknown[]) => {
    updateSingleMock(...a);
    return Promise.resolve(updateSingleMock.mock.results.at(-1)?.value);
  };
  return builder;
};

const existing = ({ path, order }: { path: string; order: number }): ExistingPhoto => ({
  storagePath: path,
  orderIndex: order,
  uri: `signed://${path}`,
});
const keepSlot = ({ path }: { path: string }): EditorPhoto => ({
  kind: 'existing',
  storagePath: path,
  uri: `signed://${path}`,
});
const newSlot = ({ uri }: { uri: string }): EditorPhoto => ({ kind: 'new', uri });

const baseInput = {
  muklogId: 'm1',
  roomId: 'r1',
  placeName: '어니언',
  category: 'cafe' as string | null,
  area: null as string | null,
  rating: 4 as number | null,
  memo: '좋았다' as string | null,
  visitedAt: '2026-02-14' as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // muklogs 업데이트는 성공 1행({id:'m1'}) 기본.
  updateSingleMock.mockReturnValue({ data: { id: 'm1' }, error: null });
  fromMock.mockImplementation((table: string) => {
    if (table === 'muklogs') return buildMuklogsUpdate();
    if (table === 'muklog_photos') {
      return {
        delete: (...a: unknown[]) => photosDeleteMock(...a),
        update: (...a: unknown[]) => photosUpdateMock(...a),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  storageFromMock.mockReturnValue({ remove: (...a: unknown[]) => removeMock(...a) });
  removeMock.mockResolvedValue({ error: null });
  photosDeleteInMock.mockResolvedValue({ error: null });
  photosUpdateEqMock.mockResolvedValue({ error: null });
  uploadMock.mockResolvedValue({ uploadedPaths: [] });
});

describe('useUpdateMuklog', () => {
  it('텍스트만 변경(사진 동일) → muklogs.update(필드, created_by/room_id 미포함) + reconcile no-op → {id}', async () => {
    const { result } = renderHook(() => useUpdateMuklog());
    let res: { id: string } | undefined;
    await act(async () => {
      res = await result.current.updateMuklog({
        input: { ...baseInput, photos: [keepSlot({ path: 'a' })] },
        initialPhotos: [existing({ path: 'a', order: 0 })],
      });
    });

    expect(fromMock).toHaveBeenCalledWith('muklogs');
    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({
      place_name: '어니언',
      category: 'cafe',
      area: null,
      rating: 4,
      memo: '좋았다',
      visited_at: '2026-02-14',
    });
    // 위변조 차단: created_by/room_id는 payload에 없다.
    expect(payload).not.toHaveProperty('created_by');
    expect(payload).not.toHaveProperty('room_id');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'm1');
    expect(updateSelectMock).toHaveBeenCalledWith('id');

    // reconcile no-op: 삭제/업로드/reindex 모두 미호출.
    expect(photosDeleteMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(photosUpdateMock).not.toHaveBeenCalled();
    expect(res).toEqual({ id: 'm1' });
  });

  it('사진 추가/삭제 혼합 → 삭제(행 delete→Storage remove) → 신규 업로드 → reindex 순으로 호출', async () => {
    // initial [a(0), b(1)] → next [b(0 유지/reindex), new(1)]. a 삭제.
    const callOrder: string[] = [];
    photosDeleteInMock.mockImplementation(async () => {
      callOrder.push('delete-row');
      return { error: null };
    });
    removeMock.mockImplementation(async () => {
      callOrder.push('storage-remove');
      return { error: null };
    });
    uploadMock.mockImplementation(async () => {
      callOrder.push('upload');
      return { uploadedPaths: ['r1/m1/new.jpg'] };
    });
    photosUpdateEqMock.mockImplementation(async () => {
      callOrder.push('reindex');
      return { error: null };
    });

    const { result } = renderHook(() => useUpdateMuklog());
    await act(async () => {
      await result.current.updateMuklog({
        input: { ...baseInput, photos: [keepSlot({ path: 'b' }), newSlot({ uri: 'file://n' })] },
        initialPhotos: [existing({ path: 'a', order: 0 }), existing({ path: 'b', order: 1 })],
      });
    });

    // 삭제: muklog_photos.delete().in('storage_path', ['a']) + storage.remove(['a']).
    expect(photosDeleteInMock).toHaveBeenCalledWith('storage_path', ['a']);
    expect(removeMock).toHaveBeenCalledWith(['a']);
    // 신규 업로드: b(order 0) 뒤 new가 order 1 → startOrderIndex 사용.
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'r1',
        muklogId: 'm1',
        photos: [{ uri: 'file://n' }],
        startOrderIndex: 1,
      }),
    );
    // reindex: b를 order 0으로 update.
    expect(photosUpdateMock).toHaveBeenCalledWith({ order_index: 0 });
    // 실행 순서: 삭제(행→Storage) → 업로드 → reindex.
    expect(callOrder).toEqual(['delete-row', 'storage-remove', 'upload', 'reindex']);
  });

  it('update 0행이면 throw + error 세팅, reconcile 미실행 (RLS 거부)', async () => {
    updateSingleMock.mockReturnValue({ data: null, error: null });
    const { result } = renderHook(() => useUpdateMuklog());

    await act(async () => {
      await expect(
        result.current.updateMuklog({
          input: { ...baseInput, photos: [newSlot({ uri: 'file://n' })] },
          initialPhotos: [],
        }),
      ).rejects.toThrow();
    });

    expect(result.current.error).toBeTruthy();
    // reconcile은 시작하지 않는다(필드 update 실패 → 빠른 실패).
    expect(uploadMock).not.toHaveBeenCalled();
    expect(photosDeleteMock).not.toHaveBeenCalled();
  });

  it('update error면 throw + mapMuklogError 메시지', async () => {
    updateSingleMock.mockReturnValue({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useUpdateMuklog());
    await act(async () => {
      await expect(
        result.current.updateMuklog({
          input: { ...baseInput, photos: [] },
          initialPhotos: [],
        }),
      ).rejects.toThrow();
    });
    expect(result.current.error).toBeTruthy();
  });

  it('신규 업로드 실패 → throw + error, 필드 update는 보존(롤백 없음)', async () => {
    uploadMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));
    const { result } = renderHook(() => useUpdateMuklog());

    await act(async () => {
      await expect(
        result.current.updateMuklog({
          input: { ...baseInput, photos: [newSlot({ uri: 'file://n' })] },
          initialPhotos: [],
        }),
      ).rejects.toThrow();
    });

    // 필드 update는 이미 호출됨(보존). 롤백(muklogs delete) 호출 없음.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeTruthy();
  });

  it('placeName 빈값 → normalizeMuklogInput throw, update 미호출', async () => {
    const { result } = renderHook(() => useUpdateMuklog());
    await act(async () => {
      await expect(
        result.current.updateMuklog({
          input: { ...baseInput, placeName: '   ', photos: [] },
          initialPhotos: [],
        }),
      ).rejects.toThrow();
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rating 0(미평가)으로 변경 → null로 update', async () => {
    const { result } = renderHook(() => useUpdateMuklog());
    await act(async () => {
      await result.current.updateMuklog({
        input: { ...baseInput, rating: 0, photos: [] },
        initialPhotos: [],
      });
    });
    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.rating).toBeNull();
  });
});
