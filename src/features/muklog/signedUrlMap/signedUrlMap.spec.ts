// src/features/muklog/signedUrlMap.spec.ts
// createSignedUrlMap — 비공개 버킷 사진 경로들의 signed URL 배치 발급 공용 유틸 명세.
//   useMuklogs·useMuklog·useLogPreviewUrls 에 중복되던 (createSignedUrls → path→URL 맵 → best-effort catch)를 흡수.
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { MUKLOG_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from '../photoPath';
import { createSignedUrlMap } from './signedUrlMap';

const fromMock = supabase.storage.from as jest.Mock;
const createSignedUrlsMock = jest.fn();

beforeEach(() => {
  fromMock.mockReset();
  createSignedUrlsMock.mockReset();
  fromMock.mockReturnValue({ createSignedUrls: createSignedUrlsMock });
});

describe('createSignedUrlMap', () => {
  it('빈 경로면 조회 없이 빈 맵', async () => {
    const map = await createSignedUrlMap({ paths: [] });
    expect(map).toEqual({});
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('비공개 버킷에서 TTL로 배치 발급하고 path→URL 맵을 만든다', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'r1/m1/a.jpg', signedUrl: 'https://s/a' },
        { path: 'r1/m2/b.jpg', signedUrl: 'https://s/b' },
      ],
      error: null,
    });
    const map = await createSignedUrlMap({ paths: ['r1/m1/a.jpg', 'r1/m2/b.jpg'] });

    expect(fromMock).toHaveBeenCalledWith(MUKLOG_PHOTOS_BUCKET);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ['r1/m1/a.jpg', 'r1/m2/b.jpg'],
      SIGNED_URL_TTL_SECONDS,
    );
    expect(map).toEqual({ 'r1/m1/a.jpg': 'https://s/a', 'r1/m2/b.jpg': 'https://s/b' });
  });

  it('error 응답이면 빈 맵(best-effort)', async () => {
    createSignedUrlsMock.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await createSignedUrlMap({ paths: ['r1/m1/a.jpg'] })).toEqual({});
  });

  it('일부 항목만 signedUrl 있으면 그 항목만 맵에 담는다', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'r1/m1/a.jpg', signedUrl: 'https://s/a' },
        { path: 'r1/m2/b.jpg', signedUrl: null },
      ],
      error: null,
    });
    expect(await createSignedUrlMap({ paths: ['r1/m1/a.jpg', 'r1/m2/b.jpg'] })).toEqual({
      'r1/m1/a.jpg': 'https://s/a',
    });
  });

  it('throw(예외)여도 던지지 않고 빈 맵(best-effort)', async () => {
    createSignedUrlsMock.mockRejectedValue(new Error('network'));
    expect(await createSignedUrlMap({ paths: ['r1/m1/a.jpg'] })).toEqual({});
  });
});
