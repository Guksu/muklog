// src/features/room/useJoinRoom.spec.ts
// 방 입장 훅 — p_code 인자 계약, roomId 매핑, 토큰별 에러, error 리셋 (plan §5-1 (4), C1·C2).
//   invite-share(U24 ①, plan R13 — AC20): clearError()로 실패 문구를 지운다(코드가 바뀌면 화면이 호출). rpc·loading 불변.
//   join-push(U74, plan AC16 · R2): 입장 성공 직후 send-join-push 를 1회 부른다(기다리지 않음). 실패 경로는 0회.
//     대역은 외부 SDK 경계(supabase.rpc · supabase.functions.invoke)에만 둔다.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), functions: { invoke: jest.fn() } } }));
import { supabase } from '@/lib/supabase';
import { useJoinRoom } from './useJoinRoom';

const rpc = supabase.rpc as jest.Mock;
const invokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ data: { sent: 0 }, error: null });
});

describe('useJoinRoom', () => {
  it('성공 시 join_room을 p_code 인자로 호출하고 roomId를 매핑한다 (C1 경계)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    let res: { roomId: string } | undefined;
    await act(async () => {
      res = await result.current.joinRoom({ code: 'ABCDEF' });
    });

    expect(rpc).toHaveBeenCalledWith('join_room', { p_code: 'ABCDEF' });
    expect(res).toEqual({ roomId: 'r1' });
  });

  it('INVALID_CODE 토큰 → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_CODE') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('ROOM_FULL 토큰(정원 초과) → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('ROOM_FULL') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('로그 정원(5명)이 가득 찼어요.');
  });

  it('INVALID_CODE — jsonb { error } 반환 계약(실패 카운터 커밋용)도 토큰 throw + 한국어 메시지', async () => {
    // invite-code-hardening: raise는 트랜잭션 롤백으로 실패 카운터를 지우므로
    // join_room이 INVALID_CODE를 jsonb { error }로 반환한다 — 훅이 토큰 throw로 변환.
    rpc.mockResolvedValueOnce({ data: { error: 'INVALID_CODE' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toThrow('INVALID_CODE');
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('TOO_MANY_ATTEMPTS 토큰(시도 제한 초과) → 한국어 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('TOO_MANY_ATTEMPTS') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('입장 시도가 너무 많았어요. 1시간 뒤에 다시 시도해 주세요.');
  });

  it('bad-response(room_id 누락)는 reject하고 error는 기본 메시지', async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toThrow('JOIN_ROOM_BAD_RESPONSE');
    });
    expect(result.current.error).toBe('연결에 실패했어요. 다시 시도해 주세요.');
  });

  it('이전 실패로 세팅된 error를 다음 성공 호출 시작 시 null로 리셋한다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('INVALID_CODE') });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toBeTruthy();
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');

    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    await act(async () => {
      await result.current.joinRoom({ code: 'ABCDEF' });
    });
    expect(result.current.error).toBeNull();
  });
});

describe('useJoinRoom — clearError (invite-share AC20)', () => {
  it('실패로 세팅된 error를 null로 되돌리고 rpc를 다시 부르지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: { error: 'INVALID_CODE' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ZZZZZZ' })).rejects.toThrow('INVALID_CODE');
    });
    expect(result.current.error).toBe('초대코드를 다시 확인해 주세요.');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('loading을 바꾸지 않는다 — 입장 중에 불러도 loading은 true로 남는다', async () => {
    let finishRpc: (value: { data: { room_id: string }; error: null }) => void = () => undefined;
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRpc = resolve;
        }),
    );
    const { result } = renderHook(() => useJoinRoom());

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.joinRoom({ code: 'ABCDEF' });
    });
    expect(result.current.loading).toBe(true);

    act(() => result.current.clearError());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      finishRpc({ data: { room_id: 'r1' }, error: null });
      await pending;
    });
    expect(result.current.loading).toBe(false);
  });

  it('error가 없을 때 불러도 아무 일이 없다(null 유지, rpc 0)', () => {
    const { result } = renderHook(() => useJoinRoom());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('useJoinRoom — 합류 알림 요청(join-push U74 · AC16)', () => {
  it('입장 성공 → send-join-push 를 { roomId: 응답 room_id } 로 정확히 1회 부른다', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await result.current.joinRoom({ code: 'ABCDEF' });
    });

    expect(invokeMock.mock.calls).toEqual([['send-join-push', { body: { roomId: 'r1' } }]]);
  });

  it.each([
    ['INVALID_CODE 반환(jsonb { error })', { data: { error: 'INVALID_CODE' }, error: null }],
    ['ROOM_FULL', { data: null, error: new Error('ROOM_FULL') }],
    ['TOO_MANY_ATTEMPTS', { data: null, error: new Error('TOO_MANY_ATTEMPTS') }],
    ['rpc 오류', { data: null, error: new Error('Network request failed') }],
    ['room_id 없음', { data: {}, error: null }],
  ])('입장 실패(%s) → 합류 알림 요청 0회', async (_label, response) => {
    rpc.mockResolvedValueOnce(response);
    const { result } = renderHook(() => useJoinRoom());

    await act(async () => {
      await expect(result.current.joinRoom({ code: 'ABCDEF' })).rejects.toBeTruthy();
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('알림 요청이 끝나지 않아도 joinRoom 은 { roomId } 로 끝나고 loading 은 false 다(기다리지 않음)', async () => {
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    // 끝나지 않는 발송 — 기다리면 이 테스트는 시간 초과로 실패한다.
    invokeMock.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useJoinRoom());

    let res: { roomId: string } | undefined;
    await act(async () => {
      res = await result.current.joinRoom({ code: 'ABCDEF' });
    });

    expect(res).toEqual({ roomId: 'r1' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('알림 요청이 reject 해도 입장 결과는 그대로다({ roomId }, error null)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: { room_id: 'r1' }, error: null });
    invokeMock.mockRejectedValueOnce(new Error('Network request failed'));
    const { result } = renderHook(() => useJoinRoom());

    let res: { roomId: string } | undefined;
    await act(async () => {
      res = await result.current.joinRoom({ code: 'ABCDEF' });
    });

    expect(res).toEqual({ roomId: 'r1' });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    warn.mockRestore();
  });
});
