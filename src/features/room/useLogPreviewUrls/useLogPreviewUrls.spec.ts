// src/features/room/useLogPreviewUrls.spec.ts
// 로그 카드 썸네일 signed URL 배치 훅 — createSignedUrls 1회 호출·path→URL 맵·빈입력 no-op·에러 best-effort.
//   Storage SDK는 단위 대상 아님 → supabase.storage 모킹으로 클라 계약만 검증.
import { renderHook, waitFor } from '@testing-library/react-native';

const mockCreateSignedUrls = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) } },
}));

import { resetSignedUrlCache } from '@/features/muklog/signedUrlMap';

import { useLogPreviewUrls } from './useLogPreviewUrls';

beforeEach(() => {
  mockCreateSignedUrls.mockReset();
  // 서명 URL 재사용 캐시(모듈 싱글턴)는 케이스를 가로질러 산다 → 케이스마다 비워 격리한다(query-cache T2).
  resetSignedUrlCache();
});

describe('useLogPreviewUrls', () => {
  it('빈 경로면 호출 없이 빈 맵을 반환한다(폴링/불필요 호출 0)', async () => {
    const { result } = renderHook(() => useLogPreviewUrls({ paths: [] }));
    await waitFor(() => expect(result.current.urls).toEqual({}));
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('경로들의 signed URL을 1회 배치 발급해 path→URL 맵을 만든다(중복 제거)', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a.jpg', signedUrl: 'https://s/a' },
        { path: 'b.jpg', signedUrl: 'https://s/b' },
      ],
      error: null,
    });
    const { result } = renderHook(() => useLogPreviewUrls({ paths: ['b.jpg', 'a.jpg', 'a.jpg', ''] }));
    await waitFor(() =>
      expect(result.current.urls).toEqual({ 'a.jpg': 'https://s/a', 'b.jpg': 'https://s/b' }),
    );
    // 중복·빈 문자열 제거 + 정렬된 고유 경로로 1회 호출.
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], expect.any(Number));
  });

  it('H16(AC2-7): 언마운트 후 같은 경로로 재마운트하면 발급 호출 0이고 URL이 동일하다(코드 변경 0줄로 수혜)', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'a.jpg', signedUrl: 'https://s/a?token=1' }],
      error: null,
    });
    const first = renderHook(() => useLogPreviewUrls({ paths: ['a.jpg'] }));
    await waitFor(() => expect(first.result.current.urls).toEqual({ 'a.jpg': 'https://s/a?token=1' }));
    first.unmount();

    const second = renderHook(() => useLogPreviewUrls({ paths: ['a.jpg'] }));

    await waitFor(() => expect(second.result.current.urls).toEqual({ 'a.jpg': 'https://s/a?token=1' }));
    // 두 번째 마운트는 캐시 히트 — 발급은 첫 마운트의 1회뿐이다(썸네일이 다시 내려받아지지 않는다).
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('발급 에러면 빈 맵(best-effort — 목록 막지 않음)', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useLogPreviewUrls({ paths: ['a.jpg'] }));
    await waitFor(() => expect(mockCreateSignedUrls).toHaveBeenCalled());
    expect(result.current.urls).toEqual({});
  });
});
