// src/features/auth/useClearCachesOnSignOut.spec.tsx
// 로그아웃 시 캐시 비움 명세 (query-cache plan §3.8 / T6, H17·H18).
//   seam = 관찰 가능한 효과(queryClient.clear · resetSignedUrlCache 호출)와 발화 조건(상태 전이).
//   E1(같은 기기에서 계정 전환) 방어선 — 이전 사용자의 목록·상세·사진 URL이 한 프레임도 남으면 안 된다.
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/features/muklog/signedUrlMap', () => ({ resetSignedUrlCache: jest.fn() }));

import { resetSignedUrlCache } from '@/features/muklog/signedUrlMap';
import { createTestQueryClient } from '@/lib/queryClient/testQueryWrapper';

import { useClearCachesOnSignOut } from './useClearCachesOnSignOut';

const resetSignedUrlCacheMock = resetSignedUrlCache as jest.Mock;

/** QueryClientProvider로 감싸고 clear 호출을 관찰할 수 있게 한다(훅은 useQueryClient로 클라이언트를 찾는다). */
const setup = ({ status }: { status: string }) => {
  const client = createTestQueryClient();
  const clear = jest.spyOn(client, 'clear');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ status: current }: { status: string }) =>
      useClearCachesOnSignOut({ status: current as never }),
    { wrapper, initialProps: { status } },
  );
  return { ...view, clear };
};

beforeEach(() => {
  resetSignedUrlCacheMock.mockReset();
});

describe('useClearCachesOnSignOut', () => {
  it('H17(AC6-4): authenticated → unauthenticated 전이에서 두 캐시를 각 1회 비운다', () => {
    const { rerender, clear } = setup({ status: 'authenticated' });
    expect(clear).not.toHaveBeenCalled();

    rerender({ status: 'unauthenticated' });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(resetSignedUrlCacheMock).toHaveBeenCalledTimes(1);
  });

  it('H18(AC6-5): 처음부터 unauthenticated로 마운트되면 아무것도 비우지 않는다(비울 게 없다)', () => {
    const { clear } = setup({ status: 'unauthenticated' });

    expect(clear).not.toHaveBeenCalled();
    expect(resetSignedUrlCacheMock).not.toHaveBeenCalled();
  });

  it('로그인 진행(unauthenticated → authenticating → authenticated)에서는 비우지 않는다', () => {
    const { rerender, clear } = setup({ status: 'unauthenticated' });

    rerender({ status: 'authenticating' });
    rerender({ status: 'authenticated' });

    expect(clear).not.toHaveBeenCalled();
    expect(resetSignedUrlCacheMock).not.toHaveBeenCalled();
  });

  it('같은 상태로 리렌더가 반복돼도 중복 호출하지 않는다(전이에서만 발화)', () => {
    const { rerender, clear } = setup({ status: 'authenticated' });
    rerender({ status: 'unauthenticated' });
    rerender({ status: 'unauthenticated' });
    rerender({ status: 'unauthenticated' });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(resetSignedUrlCacheMock).toHaveBeenCalledTimes(1);
  });

  it('재로그인 후 다시 로그아웃하면 또 비운다(계정 전환을 반복해도 잔재 0)', () => {
    const { rerender, clear } = setup({ status: 'authenticated' });
    rerender({ status: 'unauthenticated' });
    rerender({ status: 'authenticated' });
    rerender({ status: 'unauthenticated' });

    expect(clear).toHaveBeenCalledTimes(2);
    expect(resetSignedUrlCacheMock).toHaveBeenCalledTimes(2);
  });
});
