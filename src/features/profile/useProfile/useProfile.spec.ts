// src/features/profile/useProfile.spec.ts
// 프로필 조회 훅 — 마운트 분기(ready/0행/error), 초기 loading, refresh 재조회, snake→camel (plan §3.3 / §5-1, T5 / P1).
// 비용 가드레일: 진입 1회 + refresh만(폴링 없음). supabase from().select().eq().maybeSingle() 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ select }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => fromProxy(...args) } }));

// jest.mock 팩토리는 외부 변수 참조 제약이 있어 프록시로 우회.
const fromProxy = (...args: unknown[]) => from(...(args as []));

import { useProfile } from './useProfile';

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe('useProfile', () => {
  it('1행이 있으면 ready로 전이하고 snake(avatar_url)→camel(avatarUrl)로 매핑한다 (P1 경계)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { nickname: 'x', avatar_url: 'u' }, error: null });
    const { result } = renderHook(() => useProfile({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'ready',
        profile: { nickname: 'x', avatarUrl: 'u' },
      });
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('nickname, avatar_url');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('0행이면 nickname/avatarUrl 모두 null인 ready', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useProfile({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'ready',
        profile: { nickname: null, avatarUrl: null },
      });
    });
  });

  it('조회 에러면 error 상태와 메시지로 전이한다', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('rls denied') });
    const { result } = renderHook(() => useProfile({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
  });

  it('초기 상태는 loading이다 (resolve 전)', () => {
    maybeSingle.mockReturnValueOnce(new Promise(() => {})); // 영원히 pending
    const { result } = renderHook(() => useProfile({ userId: 'u1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회한다 (폴링 없음)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { nickname: 'old', avatar_url: null }, error: null });
    const { result } = renderHook(() => useProfile({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });

    maybeSingle.mockResolvedValueOnce({ data: { nickname: 'new', avatar_url: 'u2' }, error: null });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state).toEqual({
      status: 'ready',
      profile: { nickname: 'new', avatarUrl: 'u2' },
    });
  });
});
