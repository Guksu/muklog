// src/features/muklog/uploadMuklogPhotos.spec.ts
// 사진 순차 업로드 함수 명세 (plan §3.5 / §5 ③, §5-1, AC).
//   N장: processMuklogPhoto → arrayBuffer → storage.upload(path, jpeg, upsert:false)
//        → muklog_photos.insert({ muklog_id, storage_path, order_index: i }).
//   중간 실패 시 throw + 이미 올린 파일(storage.remove) + insert된 행(delete) best-effort 정리(orphan 방지).
//   supabase storage/from + manipulator + fetch 모킹 — 우리 코드의 호출/정리만 검증(외부 SDK 동작 X).
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn() }, from: jest.fn() },
}));
jest.mock('../photoImage', () => ({
  processMuklogPhoto: jest.fn(async ({ uri }: { uri: string }) => ({ uri: `${uri}#processed` })),
}));
jest.mock('../photoPath', () => ({
  MUKLOG_PHOTOS_BUCKET: 'muklog-photos',
  buildMuklogPhotoPath: ({
    roomId,
    muklogId,
    fileId,
  }: {
    roomId: string;
    muklogId: string;
    fileId: string;
  }) => `${roomId}/${muklogId}/${fileId}.jpg`,
  createPhotoFileId: jest.fn(),
}));

import { supabase } from '@/lib/supabase';
import { processMuklogPhoto } from '../photoImage';
import { createPhotoFileId } from '../photoPath';
import { uploadMuklogPhotos } from './uploadMuklogPhotos';

const storageFromMock = supabase.storage.from as jest.Mock;
const fromMock = supabase.from as jest.Mock;
const processMock = processMuklogPhoto as jest.Mock;
const fileIdMock = createPhotoFileId as jest.Mock;

// storage.from(bucket) 더블 — upload/remove 스파이.
const uploadMock = jest.fn();
const removeMock = jest.fn();
// from('muklog_photos') 더블 — insert / delete(.in()) 스파이.
const photosInsertMock = jest.fn();
const photosDeleteInMock = jest.fn();
const photosDeleteMock = jest.fn((...__a: unknown[]) => ({
  in: (...a: unknown[]) => photosDeleteInMock(...a),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // arrayBuffer 본문은 fetch().arrayBuffer()로 읽으므로 global fetch 모킹.
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  }));
  // fileId는 호출 순서대로 f0,f1,f2...
  let n = 0;
  fileIdMock.mockImplementation(() => `f${n++}`);
  storageFromMock.mockReturnValue({
    upload: (...a: unknown[]) => uploadMock(...a),
    remove: (...a: unknown[]) => removeMock(...a),
  });
  fromMock.mockReturnValue({
    insert: (...a: unknown[]) => photosInsertMock(...a),
    delete: (...a: unknown[]) => photosDeleteMock(...a),
  });
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  photosInsertMock.mockResolvedValue({ error: null });
  photosDeleteInMock.mockResolvedValue({ error: null });
});

describe('uploadMuklogPhotos', () => {
  it('0장이면 upload/insert 미호출, uploadedPaths:[] 반환 (경계)', async () => {
    const result = await uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos: [] });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(photosInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ uploadedPaths: [] });
  });

  it('3장이면 upload 3회 + muklog_photos.insert 3회(order_index 0,1,2)', async () => {
    const photos = [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }];
    const result = await uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos });

    expect(processMock).toHaveBeenCalledTimes(3);
    expect(uploadMock).toHaveBeenCalledTimes(3);
    // 경로 첫 세그먼트=roomId, JPEG·upsert:false.
    expect(uploadMock).toHaveBeenNthCalledWith(
      1,
      'r1/m1/f0.jpg',
      expect.anything(),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
    expect(photosInsertMock).toHaveBeenCalledTimes(3);
    expect(photosInsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ muklog_id: 'm1', storage_path: 'r1/m1/f0.jpg', order_index: 0 }),
    );
    expect(photosInsertMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ storage_path: 'r1/m1/f2.jpg', order_index: 2 }),
    );
    expect(result.uploadedPaths).toEqual(['r1/m1/f0.jpg', 'r1/m1/f1.jpg', 'r1/m1/f2.jpg']);
  });

  it('2번째 upload 실패 시 throw + 올린 1장 storage.remove(orphan 정리)', async () => {
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('storage boom') });
    const photos = [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }];

    await expect(
      uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos }),
    ).rejects.toThrow();

    // 3번째는 시작하지 않음(순차 중단).
    expect(uploadMock).toHaveBeenCalledTimes(2);
    // 이미 올린 1장(f0) best-effort 정리.
    expect(removeMock).toHaveBeenCalledWith(['r1/m1/f0.jpg']);
  });

  it('insert 실패 시 throw + 해당 파일 포함 정리', async () => {
    photosInsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('rls') });
    const photos = [{ uri: 'a' }, { uri: 'b' }];

    await expect(
      uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos }),
    ).rejects.toThrow();

    // 업로드된 두 파일 모두 정리(2번째는 업로드 성공 후 insert 실패).
    expect(removeMock).toHaveBeenCalledWith(['r1/m1/f0.jpg', 'r1/m1/f1.jpg']);
  });

  it('startOrderIndex로 시작 order_index를 지정한다(편집 신규 사진용, plan §3.4)', async () => {
    const photos = [{ uri: 'a' }, { uri: 'b' }];
    await uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos, startOrderIndex: 3 });

    expect(photosInsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ storage_path: 'r1/m1/f0.jpg', order_index: 3 }),
    );
    expect(photosInsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ storage_path: 'r1/m1/f1.jpg', order_index: 4 }),
    );
  });

  it('startOrderIndex 미지정(기본 0)은 0,1,2로 회귀 동작한다', async () => {
    const photos = [{ uri: 'a' }, { uri: 'b' }];
    await uploadMuklogPhotos({ roomId: 'r1', muklogId: 'm1', photos });
    expect(photosInsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ order_index: 0 }),
    );
    expect(photosInsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ order_index: 1 }),
    );
  });
});
