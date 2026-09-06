// src/lib/queryClient/testQueryWrapper.tsx
// 훅 spec 전용 하네스 (query-cache plan §5 T1 AC1-4). 프로덕션 index.ts에서는 export하지 않는다.
//   renderHook(..., { wrapper: createQueryWrapper() })로 쓰고, spec마다 새 클라이언트를 만들어 캐시를 격리한다.
//   "재마운트 시 캐시 즉시 표시"(AC4-3)처럼 캐시 공유가 검증 대상인 케이스는 한 wrapper를 재사용한다.
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 테스트용 QueryClient를 만든다(재시도 0 · gc 없음 — 타이머 의존 제거).
 * @returns 테스트 격리용 QueryClient
 */
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: Infinity, // 테스트 도중 캐시가 수거되어 결과가 흔들리지 않게 한다.
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

/**
 * renderHook에 넘길 QueryClientProvider wrapper를 만든다.
 * @param client 공유할 클라이언트(생략 시 새로 만든다 — 케이스 간 캐시 격리)
 * @returns { wrapper, client } — 같은 캐시를 재사용해야 하는 케이스는 client를 다음 렌더에 다시 넘긴다
 */
export const createQueryWrapper = ({
  client,
}: { client?: QueryClient } = {}): {
  wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement;
  client: QueryClient;
} => {
  const queryClient = client ?? createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, client: queryClient };
};
