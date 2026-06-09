// src/features/room/useMembership.spec.ts
// 멤버십 조회 훅 — 마운트 분기(in-room/no-room/error), 초기 loading, refresh 재조회, eq 인자 계약.
// (plan §5-1 (5), C3) 비용 가드레일: 폴링 없이 refresh 명시 호출로만 재조회.
import { act, renderHook, waitFor } from '@testing-library/react-native';

// from().select().eq().maybeSingle() 체인 모킹.
const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ select }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => fromProxy(...args) } }));

// jest.mock 팩토리는 외부 변수 참조 제약이 있어 프록시로 우회.
const fromProxy = (...args: unknown[]) => from(...(args as []));

import { useMembership } from './useMembership';

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
});

describe('useMembership', () => {
  it('1행이 있으면 in-room(roomId)으로 전이하고 user_id로 eq를 호출한다 (C3 경계)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useMembership({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'in-room', roomId: 'r1' });
    });
    expect(from).toHaveBeenCalledWith('room_members');
    expect(select).toHaveBeenCalledWith('room_id');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('0행이면 no-room으로 전이한다', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useMembership({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('no-room');
    });
  });

  it('조회 에러면 error 상태와 한국어 메시지로 전이한다', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('rls denied') });
    const { result } = renderHook(() => useMembership({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'error',
        message: '멤버십 조회에 실패했어요. 다시 시도해 주세요.',
      });
    });
  });

  it('초기 상태는 loading이다 (resolve 전)', () => {
    maybeSingle.mockReturnValueOnce(new Promise(() => {})); // 영원히 pending
    const { result } = renderHook(() => useMembership({ userId: 'u1' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('refresh() 명시 호출로만 재조회하여 no-room → in-room으로 전이한다 (폴링 없음)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useMembership({ userId: 'u1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('no-room');
    });

    maybeSingle.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state).toEqual({ status: 'in-room', roomId: 'r1' });
  });
});
