// src/features/profile/uploadAvatarFromUri.spec.ts
// 아바타 업로드 공용 함수 (picker-recovery AC5) — 정상/복구 양쪽이 재사용하는 단일 업로드 로직.
//   supabase / processAvatarImage / fetch / createAvatarFileId 모킹.
const updateEq = jest.fn();
const update = jest.fn(() => ({ eq: updateEq }));
const selMaybeSingle = jest.fn();
const selEq = jest.fn(() => ({ maybeSingle: selMaybeSingle }));
const select = jest.fn(() => ({ eq: selEq }));
const from = jest.fn(() => ({ update, select }));

const upload = jest.fn();
const getPublicUrl = jest.fn();
const remove = jest.fn();
const storageFrom = jest.fn(() => ({ upload, getPublicUrl, remove }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => fromProxy(...a),
    storage: { from: (...a: unknown[]) => storageProxy(...a) },
  },
}));
const fromProxy = (...a: unknown[]) => from(...(a as []));
const storageProxy = (...a: unknown[]) => storageFrom(...(a as []));

jest.mock('./image', () => ({ processAvatarImage: jest.fn() }));
import { processAvatarImage } from './image';
const process = processAvatarImage as jest.Mock;

jest.mock('./avatarPath', () => {
  const actual = jest.requireActual('./avatarPath');
  return { ...actual, createAvatarFileId: jest.fn(() => 'fixed') };
});

import { uploadAvatarFromUri } from './uploadAvatarFromUri';

const OLD_URL = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/old.jpg';
const NEW_URL = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/fixed.jpg';

beforeEach(() => {
  jest.clearAllMocks();
  updateEq.mockResolvedValue({ error: null });
  selMaybeSingle.mockResolvedValue({ data: { avatar_url: OLD_URL }, error: null });
  upload.mockResolvedValue({ data: { path: 'u1/fixed.jpg' }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: NEW_URL } });
  remove.mockResolvedValue({ error: null });
  process.mockResolvedValue({ uri: 'file:///processed.jpg', width: 512, height: 512 });
  global.fetch = jest
    .fn()
    .mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }) as jest.Mock;
});

describe('uploadAvatarFromUri (AC5)', () => {
  it('정상: process→upload(처리본·jpeg)→getPublicUrl→update→이전파일 remove + avatarUrl 반환', async () => {
    const out = await uploadAvatarFromUri({ uri: 'file:///orig.png', userId: 'u1' });

    expect(process).toHaveBeenCalledWith({ uri: 'file:///orig.png' });
    expect(global.fetch).toHaveBeenCalledWith('file:///processed.jpg');
    expect(storageFrom).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith('u1/fixed.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(getPublicUrl).toHaveBeenCalledWith('u1/fixed.jpg');
    expect(update).toHaveBeenCalledWith({ avatar_url: NEW_URL });
    expect(updateEq).toHaveBeenCalledWith('id', 'u1');
    expect(remove).toHaveBeenCalledWith(['u1/old.jpg']);
    expect(out).toEqual({ avatarUrl: NEW_URL });
  });

  it('업로드 실패 → AVATAR_UPLOAD_FAILED throw + 새 파일 정리, update 미호출', async () => {
    upload.mockResolvedValueOnce({ data: null, error: new Error('storage 500') });
    await expect(uploadAvatarFromUri({ uri: 'file:///o.png', userId: 'u1' })).rejects.toThrow(
      'AVATAR_UPLOAD_FAILED',
    );
    expect(update).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(['u1/fixed.jpg']);
  });

  it('URL 갱신(update) 실패 → AVATAR_UPLOAD_FAILED + 새 파일 정리', async () => {
    updateEq.mockResolvedValueOnce({ error: new Error('update failed') });
    await expect(uploadAvatarFromUri({ uri: 'file:///o.png', userId: 'u1' })).rejects.toThrow(
      'AVATAR_UPLOAD_FAILED',
    );
    expect(remove).toHaveBeenCalledWith(['u1/fixed.jpg']);
  });

  it('이전 avatar_url 없으면 정리(remove) 스킵', async () => {
    selMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: null }, error: null });
    await uploadAvatarFromUri({ uri: 'file:///o.png', userId: 'u1' });
    expect(remove).not.toHaveBeenCalled();
  });
});
