// src/features/profile/useDeleteAccount.spec.ts
// 회원 탈퇴 훅 — delete-account Edge Function invoke, loading/error 전이, 성공 결과 노출 (plan §3, AC4).
//   생산자: delete-account Edge Function(service_role) → { deleted: true }(200) 또는 { error: <TOKEN> }.
//   소비자: ProfileScreen 확인 시트 → deleteAccount() 성공 시 호출부가 signOut(훅은 signOut 안 함, 폴링 0).
//   ⚠️ 본인 인증은 invoke 가 Authorization 헤더(JWT) 자동 첨부 → 함수가 getUser()로 검증(클라는 userId 미전송).
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { supabase } from '@/lib/supabase';
import { useDeleteAccount } from './useDeleteAccount';

const invokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  invokeMock.mockReset();
});

describe('useDeleteAccount', () => {
  it("delete-account 를 body 없이(또는 빈 body) 호출한다 — userId 를 클라가 보내지 않는다(보안: JWT 본인만)", async () => {
    invokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.deleteAccount();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [fnName, options] = invokeMock.mock.calls[0];
    expect(fnName).toBe('delete-account');
    // body 가 있어도 userId 류 식별자를 싣지 않는다(본문 신뢰 금지 — 함수가 JWT로 판정).
    const body = options?.body ?? {};
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('user_id');
  });

  it('성공(200 { deleted:true }) 시 true 반환, error 는 null, loading 은 false 복귀', async () => {
    invokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteAccount();
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('loading 은 호출 전 false, 완료(finally) 후 false 로 복귀한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    const { result } = renderHook(() => useDeleteAccount());

    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(result.current.loading).toBe(false);
  });

  it('invoke error(FunctionsHttpError 등) → reject + error 에 한국어 메시지(세션 유지)', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('DELETE_FAILED') });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toBeTruthy();
    });
    expect(result.current.error).not.toBeNull();
  });

  it('네트워크 reject(invoke 자체 throw) → reject + error 세팅', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network request failed'));
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toBeTruthy();
    });
    expect(result.current.error).not.toBeNull();
  });

  it('응답이 { deleted:true } 가 아니면(bad shape) reject 한다 — 미완료 삭제를 성공으로 처리하지 않음', async () => {
    invokeMock.mockResolvedValueOnce({ data: { deleted: false }, error: null });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toBeTruthy();
    });
    expect(result.current.error).not.toBeNull();
  });

  it('이전 실패로 세팅된 error 를 다음 호출 시작 시 null 로 리셋한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('DELETE_FAILED') });
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toBeTruthy();
    });
    expect(result.current.error).not.toBeNull();

    invokeMock.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(result.current.error).toBeNull();
  });
});
