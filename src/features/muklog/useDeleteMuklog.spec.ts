// src/features/muklog/useDeleteMuklog.spec.ts
// 먹로그 삭제 훅 명세 (plan §3.6 / §7 작업⑤ d, §7-1 "useDeleteMuklog").
//   동작: Storage 파일 먼저 remove(best-effort) → muklogs.delete().eq('id') (FK CASCADE로 muklog_photos 자동).
//   순서 근거: row 먼저 지우면 크래시 시 orphan 단서(photoPaths) 상실 → Storage 먼저.
//   supabase from/storage 모킹 — 호출/순서/0행 처리만 검증.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

import { supabase } from '@/lib/supabase';
import { useDeleteMuklog } from './useDeleteMuklog';

const fromMock = supabase.from as jest.Mock;
const storageFromMock = supabase.storage.from as jest.Mock;

const removeMock = jest.fn();
const deleteEqMock = jest.fn();
const deleteMock = jest.fn((..._a: unknown[]) => ({ eq: (...a: unknown[]) => deleteEqMock(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  storageFromMock.mockReturnValue({ remove: (...a: unknown[]) => removeMock(...a) });
  fromMock.mockReturnValue({ delete: (...a: unknown[]) => deleteMock(...a) });
  removeMock.mockResolvedValue({ error: null });
  // delete().eq() → { error, count } 기본: count 1행 성공.
  deleteEqMock.mockResolvedValue({ error: null, count: 1 });
});

describe('useDeleteMuklog', () => {
  it('photoPaths 3장 → storage.remove(3) → muklogs.delete().eq(id) 순으로 호출', async () => {
    const order: string[] = [];
    removeMock.mockImplementation(async () => {
      order.push('remove');
      return { error: null };
    });
    deleteEqMock.mockImplementation(async () => {
      order.push('delete');
      return { error: null, count: 1 };
    });

    const { result } = renderHook(() => useDeleteMuklog());
    await act(async () => {
      await result.current.deleteMuklog({
        muklogId: 'm1',
        roomId: 'r1',
        photoPaths: ['r1/m1/a.jpg', 'r1/m1/b.jpg', 'r1/m1/c.jpg'],
      });
    });

    expect(removeMock).toHaveBeenCalledWith(['r1/m1/a.jpg', 'r1/m1/b.jpg', 'r1/m1/c.jpg']);
    expect(fromMock).toHaveBeenCalledWith('muklogs');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'm1');
    expect(order).toEqual(['remove', 'delete']);
  });

  it('photoPaths 0장 → storage.remove 미호출, delete만', async () => {
    const { result } = renderHook(() => useDeleteMuklog());
    await act(async () => {
      await result.current.deleteMuklog({ muklogId: 'm1', roomId: 'r1', photoPaths: [] });
    });
    expect(removeMock).not.toHaveBeenCalled();
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'm1');
  });

  it('delete error → throw + error 세팅(Storage는 이미 remove 호출됨)', async () => {
    deleteEqMock.mockResolvedValue({ error: new Error('boom'), count: null });
    const { result } = renderHook(() => useDeleteMuklog());
    await act(async () => {
      await expect(
        result.current.deleteMuklog({ muklogId: 'm1', roomId: 'r1', photoPaths: ['r1/m1/a.jpg'] }),
      ).rejects.toThrow();
    });
    expect(removeMock).toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it('Storage remove 실패해도 delete는 진행한다(best-effort)', async () => {
    removeMock.mockRejectedValue(new Error('storage down'));
    const { result } = renderHook(() => useDeleteMuklog());
    await act(async () => {
      await result.current.deleteMuklog({
        muklogId: 'm1',
        roomId: 'r1',
        photoPaths: ['r1/m1/a.jpg'],
      });
    });
    // remove가 던져도 delete는 호출됨.
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'm1');
    expect(result.current.error).toBeNull();
  });
});
