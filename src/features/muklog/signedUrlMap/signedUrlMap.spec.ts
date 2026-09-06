// src/features/muklog/signedUrlMap.spec.ts
// createSignedUrlMap — 비공개 버킷 사진 경로들의 signed URL 배치 발급 공용 유틸 명세.
//   useMuklogs·useMuklog·useLogPreviewUrls 에 중복되던 (createSignedUrls → path→URL 맵 → best-effort catch)를 흡수.
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { MUKLOG_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from '../photoPath';
import { SIGNED_URL_REUSE_MARGIN_MS } from '../signedUrlCache';
import { createSignedUrlMap, resetSignedUrlCache } from './signedUrlMap';

const fromMock = supabase.storage.from as jest.Mock;
const createSignedUrlsMock = jest.fn();

beforeEach(() => {
  fromMock.mockReset();
  createSignedUrlsMock.mockReset();
  fromMock.mockReturnValue({ createSignedUrls: createSignedUrlsMock });
  // 모듈 싱글턴 캐시 격리(로그아웃 정리와 같은 함수 — 테스트 전용 후크가 아니다).
  resetSignedUrlCache();
  jest.restoreAllMocks();
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

// ── 재사용 캐시 (query-cache T2 / H1~H4) ────────────────────────────────────────
// 핵심 계약: 같은 storage_path에는 같은 URL 문자열을 준다 → RN Image가 이미 받은 사진을 다시 받지 않는다.
describe('createSignedUrlMap 재사용 캐시', () => {
  it('H1(AC2-1): 같은 경로를 두 번 요청하면 두 번째는 발급 호출 0이고 URL이 완전히 동일하다', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [{ path: 'r1/m1/a.jpg', signedUrl: 'https://s/a?token=1' }],
      error: null,
    });

    const first = await createSignedUrlMap({ paths: ['r1/m1/a.jpg'] });
    const second = await createSignedUrlMap({ paths: ['r1/m1/a.jpg'] });

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second['r1/m1/a.jpg']).toBe('https://s/a?token=1');
  });

  it('H2(AC2-2): 부분 히트면 miss 경로만 발급 인자로 넘기고 반환 맵에는 둘 다 담긴다', async () => {
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'A', signedUrl: 'https://s/A' }],
      error: null,
    });
    await createSignedUrlMap({ paths: ['A'] });

    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'B', signedUrl: 'https://s/B' }],
      error: null,
    });
    const map = await createSignedUrlMap({ paths: ['A', 'B'] });

    expect(createSignedUrlsMock).toHaveBeenLastCalledWith(['B'], SIGNED_URL_TTL_SECONDS);
    expect(map).toEqual({ A: 'https://s/A', B: 'https://s/B' });
  });

  it('H3(AC2-5): 발급 실패한 경로는 캐시에 남지 않아 다음 호출에서 다시 시도된다', async () => {
    createSignedUrlsMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await createSignedUrlMap({ paths: ['A'] })).toEqual({});

    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'A', signedUrl: 'https://s/A' }],
      error: null,
    });
    expect(await createSignedUrlMap({ paths: ['A'] })).toEqual({ A: 'https://s/A' });
    expect(createSignedUrlsMock).toHaveBeenCalledTimes(2);
  });

  it('H4(AC2-6): 빈 입력은 캐시 도입 후에도 네트워크 호출 0으로 빈 맵', async () => {
    expect(await createSignedUrlMap({ paths: [] })).toEqual({});
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('AC2-3: 잔여 유효시간이 마진(10분) 미만이면 같은 경로라도 재발급한다', async () => {
    const base = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'A', signedUrl: 'https://s/A1' }],
      error: null,
    });
    await createSignedUrlMap({ paths: ['A'] });

    // 잔여가 마진보다 1ms 짧은 시점으로 이동.
    nowSpy.mockReturnValue(base + SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REUSE_MARGIN_MS + 1);
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ path: 'A', signedUrl: 'https://s/A2' }],
      error: null,
    });
    const map = await createSignedUrlMap({ paths: ['A'] });

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(2);
    expect(map).toEqual({ A: 'https://s/A2' });
  });

  it('resetSignedUrlCache(): 로그아웃 정리 후에는 같은 경로도 다시 발급한다(계정 전환 잔재 0, E1)', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [{ path: 'A', signedUrl: 'https://s/A' }],
      error: null,
    });
    await createSignedUrlMap({ paths: ['A'] });

    resetSignedUrlCache();
    await createSignedUrlMap({ paths: ['A'] });

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(2);
  });
});
