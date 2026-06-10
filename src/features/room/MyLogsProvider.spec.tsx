// src/features/room/MyLogsProvider.spec.tsx
// 컨텍스트 가드 — Provider 밖에서 useMyLogsContext 호출 시 throw (plan §5 T2).
// useMyLogs 내부는 supabase.rpc에 의존하므로 모킹(Provider 렌더 시 effect 호출 방지/안정화).
import React from 'react';
import { renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) },
}));

import { MyLogsProvider, useMyLogsContext } from './MyLogsProvider';

describe('useMyLogsContext', () => {
  it('Provider 바깥에서 호출하면 throw 한다', () => {
    expect(() => renderHook(() => useMyLogsContext())).toThrow(
      'useMyLogsContext()는 <MyLogsProvider> 트리 안에서만 호출할 수 있습니다.',
    );
  });

  it('Provider 안에서 호출하면 state/refresh를 반환한다', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MyLogsProvider userId="u1">{children}</MyLogsProvider>
    );
    const { result } = renderHook(() => useMyLogsContext(), { wrapper });
    expect(result.current).toHaveProperty('state');
    expect(typeof result.current.refresh).toBe('function');
  });
});
