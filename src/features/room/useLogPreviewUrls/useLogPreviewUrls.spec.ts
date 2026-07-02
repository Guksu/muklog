// src/features/room/useLogPreviewUrls.spec.ts
// 로그 카드 썸네일 signed URL 배치 훅 — createSignedUrls 1회 호출·path→URL 맵·빈입력 no-op·에러 best-effort.
//   Storage SDK는 단위 대상 아님 → supabase.storage 모킹으로 클라 계약만 검증.
import { renderHook, waitFor } from '@testing-library/react-native';

const mockCreateSignedUrls = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) } },
}));

import { useLogPreviewUrls } from './useLogPreviewUrls';

beforeEach(() => {
  mockCreateSignedUrls.mockReset();
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

  it('발급 에러면 빈 맵(best-effort — 목록 막지 않음)', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useLogPreviewUrls({ paths: ['a.jpg'] }));
    await waitFor(() => expect(mockCreateSignedUrls).toHaveBeenCalled());
    expect(result.current.urls).toEqual({});
  });
});
